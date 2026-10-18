import { and, desc, eq, gte } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { assistantMessages, investigations } from '@/lib/db/schema'

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  const start = new Date(); start.setUTCHours(0, 0, 0, 0)
  const [checks, messages] = await Promise.all([
    db.select({ domain: investigations.domain, score: investigations.score, createdAt: investigations.createdAt }).from(investigations).where(and(eq(investigations.userId, session.user.id), gte(investigations.createdAt, start))).orderBy(desc(investigations.createdAt)),
    db.select({ role: assistantMessages.role, content: assistantMessages.content, createdAt: assistantMessages.createdAt }).from(assistantMessages).where(and(eq(assistantMessages.userId, session.user.id), gte(assistantMessages.createdAt, start))).orderBy(desc(assistantMessages.createdAt)),
  ])
  return NextResponse.json({ date: start.toISOString().slice(0, 10), checks, assistantMessages: messages, totals: { checks: checks.length, assistantMessages: messages.length } }, { headers: { 'Cache-Control': 'private, no-store' } })
}
