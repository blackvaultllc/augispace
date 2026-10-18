import type { Metadata } from 'next'
import { and, count, desc, eq, gte } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { MemberWorkspace, type SavedInvestigation } from '@/components/member-workspace'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { investigations, user } from '@/lib/db/schema'
import { getUtcMonthStart, isOwnerEmail, isPlanTier, planTiers } from '@/lib/plans'

export const metadata: Metadata = { title: 'Member workspace' }

export default async function WorkspacePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  const [account] = await db
    .select({ role: user.role, tier: user.tier })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)

  if (!account) redirect('/sign-in')

  const owner = isOwnerEmail(session.user.email) || account.role === 'owner'
  const tier = owner ? 'command' : isPlanTier(account.tier) ? account.tier : 'observer'
  const plan = planTiers[tier]
  const monthStart = getUtcMonthStart()
  const [usage] = await db
    .select({ total: count() })
    .from(investigations)
    .where(and(eq(investigations.userId, session.user.id), gte(investigations.createdAt, monthStart)))
  const savedRows = await db
    .select()
    .from(investigations)
    .where(eq(investigations.userId, session.user.id))
    .orderBy(desc(investigations.createdAt))
    .limit(12)

  const used = Number(usage?.total ?? 0)
  const limit = owner ? null : plan.monthlyChecks
  const saved: SavedInvestigation[] = savedRows.map((row) => ({
    id: row.id,
    domain: row.domain,
    score: Number(row.score),
    createdAt: row.createdAt.toISOString(),
    report: row.report as SavedInvestigation['report'],
  }))

  return (
    <MemberWorkspace
      name={session.user.name}
      email={session.user.email}
      owner={owner}
      tier={tier}
      tierLabel={owner ? 'Owner access' : plan.label}
      used={used}
      limit={limit}
      investigations={saved}
    />
  )
}
