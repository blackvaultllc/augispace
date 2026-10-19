import { NextResponse } from 'next/server'
import { getOwnerContext } from '@/lib/supabase/owner'

export async function GET() {
  const context = await getOwnerContext()
  if (!context) return NextResponse.json({ error: 'Owner access required.' }, { status: 403 })

  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  const since = start.toISOString()
  const [checksResult, messagesResult] = await Promise.all([
    context.supabase
      .from('investigations')
      .select('domain, score, created_at')
      .eq('user_id', context.user.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false }),
    context.supabase
      .from('assistant_messages')
      .select('role, content, created_at')
      .eq('user_id', context.user.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false }),
  ])

  if (checksResult.error || messagesResult.error) {
    return NextResponse.json({ error: 'The daily report could not be loaded.' }, { status: 500 })
  }

  const checks = checksResult.data ?? []
  const messages = messagesResult.data ?? []
  return NextResponse.json({
    date: since.slice(0, 10),
    checks,
    assistantMessages: messages,
    totals: { checks: checks.length, assistantMessages: messages.length },
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}
