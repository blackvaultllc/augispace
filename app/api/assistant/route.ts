import { generateText } from 'ai'
import { and, asc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { assistantMessages, user } from '@/lib/db/schema'
import { isOwnerEmail } from '@/lib/plans'

export const runtime = 'nodejs'

const SYSTEM_PROMPT = `You are AUGI, a calm defensive cybersecurity copilot for Serpent Intelligence Systems. Work only from user-supplied evidence and lawful public data. Help with containment, file blocking, account hardening, DNS, endpoint security, Linux, Windows, and incident-response planning. Never deanonymize private people, identify an attacker, expose personal data, access dark-web markets, obtain credentials, evade detection, or provide malware, intrusion, exploitation, or retaliation instructions. For IPs, explain lawful approximate geolocation and defensive enrichment only; never claim an IP proves a person or exact location. Ask for missing context, state uncertainty, and give safe next steps. Speak naturally and collaboratively.`

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  const messages = await db.select({ role: assistantMessages.role, content: assistantMessages.content, createdAt: assistantMessages.createdAt }).from(assistantMessages).where(eq(assistantMessages.userId, session.user.id)).orderBy(asc(assistantMessages.createdAt)).limit(80)
  return NextResponse.json({ messages }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  const body = await request.json().catch(() => null) as { message?: unknown } | null
  const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 4000) : ''
  if (!message) return NextResponse.json({ error: 'Ask a security question to continue.' }, { status: 400 })
  const member = await db.select({ role: user.role }).from(user).where(eq(user.id, session.user.id)).limit(1)
  const owner = isOwnerEmail(session.user.email) || member[0]?.role === 'owner'
  const recent = await db.select({ role: assistantMessages.role, content: assistantMessages.content }).from(assistantMessages).where(eq(assistantMessages.userId, session.user.id)).orderBy(asc(assistantMessages.createdAt)).limit(20)
  await db.insert(assistantMessages).values({ id: crypto.randomUUID(), userId: session.user.id, role: 'user', content: message })
  try {
    const result = await generateText({ model: 'openai/gpt-6.1-sol', system: SYSTEM_PROMPT, messages: [...recent.map((item) => ({ role: item.role as 'user' | 'assistant', content: item.content })), { role: 'user', content: message }], maxOutputTokens: 700, abortSignal: AbortSignal.timeout(20_000) })
    const response = result.text.trim().slice(0, 5000)
    await db.insert(assistantMessages).values({ id: crypto.randomUUID(), userId: session.user.id, role: 'assistant', content: response })
    return NextResponse.json({ response, owner, retained: true })
  } catch {
    return NextResponse.json({ error: 'The secure copilot is temporarily unavailable. Your question is retained for the next session.', retained: true }, { status: 503 })
  }
}
