import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { MemberWorkspace, type SavedInvestigation } from '@/components/member-workspace'
import { getUtcMonthStart } from '@/lib/plans'
import { createClient } from '@/lib/supabase/server'
import { isOwnerEmail } from '@/lib/plans'

export const metadata: Metadata = { title: 'Geolocation Command Center' }

export default async function WorkspacePage() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/sign-in')
  if (!isOwnerEmail(user.email ?? '')) redirect('/sign-in?error=owner_only')

  const monthStart = getUtcMonthStart().toISOString()
  const [{ count: usageCount, error: usageError }, { data: savedRows, error: savedError }] = await Promise.all([
    supabase.from('investigations').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', monthStart),
    supabase.from('investigations').select('id, domain, score, report, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(12),
  ])

  if (usageError || savedError) throw new Error('The owner workspace data could not be loaded.')

  const saved: SavedInvestigation[] = (savedRows ?? []).map((row) => ({
    id: row.id,
    domain: row.domain,
    score: Number(row.score),
    createdAt: row.created_at,
    report: row.report as SavedInvestigation['report'],
  }))

  return (
    <MemberWorkspace
      name={typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : user.email ?? 'Owner'}
      email={user.email ?? ''}
      owner
      tier="command"
      tierLabel="Owner access"
      used={usageCount ?? 0}
      limit={null}
      investigations={saved}
    />
  )
}
