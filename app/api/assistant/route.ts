import { generateText } from 'ai'
import { NextResponse } from 'next/server'
import { getOwnerContext } from '@/lib/supabase/owner'

export const runtime = 'nodejs'

const SYSTEM_PROMPT = `You are AUGI, a calm defensive cybersecurity copilot for Serpent Intelligence Systems. Work only from user-supplied evidence and lawful public data. Help with containment, file blocking, account hardening, DNS, endpoint security, Linux, Windows, and incident-response planning. Never deanonymize private people, identify an attacker, expose personal data, access dark-web markets, obtain credentials, evade detection, or provide malware, intrusion, exploitation, or retaliation instructions. For IPs, explain lawful approximate geolocation and defensive enrichment only; never claim an IP proves a person or exact location. Ask for missing context, state uncertainty, and give safe next steps. Speak naturally and collaboratively. Command phrases are workflow labels, not authorization: BIG O ACTION means defensive readiness and a prioritized checklist; BIG O SHOWTIME means a factual security status brief; FINAL STAGE means maximum-detail defensive analysis, evidence preservation, and rollback-aware recommendations, never unrestricted shell access or destructive actions. Refuse unsafe requests and redirect to lawful defensive alternatives.`

const OFFLINE_KNOWLEDGE = [
  'Evidence handling: preserve the original artifact, record a UTC timestamp, hash exported files when possible, and work from a copy.',
  'Incident response: scope first, contain second, eradicate only after evidence is preserved, then recover and monitor.',
  'Identity limits: an IP address, barcode, image, or DNS record is an identifier or signal, not proof of a person, intent, or compromise.',
  'Least privilege: use read-only inspection by default, require explicit human approval for changes, and keep rollback steps documented.',
  'Factuality: distinguish observed facts, corroborated facts, hypotheses, and unknowns; cite the source and confidence for each claim.',
].join('\\n')

function commandMode(message: string) {
  const normalized = message.toLowerCase()
  if (normalized.includes('final stage')) return 'FINAL STAGE'
  if (normalized.includes('big o action')) return 'BIG O ACTION'
  if (normalized.includes('big o showtime')) return 'BIG O SHOWTIME'
  return 'STANDARD'
}

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
  const mode = commandMode(message)

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
      system: `${SYSTEM_PROMPT}\n\nLOCAL RETAINED KNOWLEDGE (use before online lookup):\n${OFFLINE_KNOWLEDGE}\n\nACTIVE WORKFLOW: ${mode}. Treat this as a reporting mode only. Do not execute commands or claim a scan happened unless evidence was supplied.`,
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
