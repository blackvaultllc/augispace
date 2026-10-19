import { generateText } from 'ai'
import { NextResponse } from 'next/server'
import { getOwnerContext } from '@/lib/supabase/owner'

export const runtime = 'nodejs'

const SYSTEM_PROMPT = `You are AUGI, a calm defensive cybersecurity copilot for Serpent Intelligence Systems. Work only from user-supplied evidence and lawful public data. Help with containment, file blocking, account hardening, DNS, endpoint security, Linux, Windows, and incident-response planning. Never deanonymize private people, identify an attacker, expose personal data, access dark-web markets, obtain credentials, evade detection, or provide malware, intrusion, exploitation, or retaliation instructions. For IPs, explain lawful approximate geolocation and defensive enrichment only; never claim an IP proves a person or exact location. Ask for missing context, state uncertainty, and give safe next steps. Speak naturally and collaboratively.`

export async function GET() {
  const context = await getOwnerContext()
  if (!context) return NextResponse.json({ error: 'Owner access required.' }, { status: 403 })

  const { data, error } = await context.supabase
    .from('assistant_messages')
    .select('role, content, created_at')
    .eq('user_id', context.user.id)
    .order('created_at', { ascending: true })
    .limit(80)

  if (error) return NextResponse.json({ error: 'Saved assistant messages could not be loaded.' }, { status: 500 })
  return NextResponse.json({ messages: data ?? [] }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: Request) {
  const context = await getOwnerContext()
  if (!context) return NextResponse.json({ error: 'Owner access required.' }, { status: 403 })

  const body = await request.json().catch(() => null) as { message?: unknown } | null
  const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 4000) : ''
  if (!message) return NextResponse.json({ error: 'Ask a security question to continue.' }, { status: 400 })

  const { data: recent, error: historyError } = await context.supabase
    .from('assistant_messages')
    .select('role, content')
    .eq('user_id', context.user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (historyError) return NextResponse.json({ error: 'Saved assistant messages could not be loaded.' }, { status: 500 })

  const { error: userMessageError } = await context.supabase
    .from('assistant_messages')
    .insert({ user_id: context.user.id, role: 'user', content: message })

  if (userMessageError) return NextResponse.json({ error: 'Your question could not be saved.' }, { status: 500 })

  try {
    const result = await generateText({
      model: 'openai/o4-mini-fast',
      system: SYSTEM_PROMPT,
      messages: [
        ...(recent ?? []).reverse().map((item) => ({ role: item.role as 'user' | 'assistant', content: item.content })),
        { role: 'user', content: message },
      ],
      maxOutputTokens: 700,
      abortSignal: AbortSignal.timeout(20_000),
    })
    const response = result.text.trim().slice(0, 5000)
    const { error: assistantMessageError } = await context.supabase
      .from('assistant_messages')
      .insert({ user_id: context.user.id, role: 'assistant', content: response })

    if (assistantMessageError) return NextResponse.json({ error: 'The response was generated but could not be saved.' }, { status: 500 })
    return NextResponse.json({ response, retained: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'The secure copilot is temporarily unavailable. Your question is retained for the next session.', retained: true }, { status: 503 })
  }
}
