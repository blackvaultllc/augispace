import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AdminConsole } from '@/components/admin-console'
import { SiteFooter } from '@/components/augi-landing'
import { SiteHeader } from '@/components/augi-landing'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { isOwnerEmail } from '@/lib/plans'

export const metadata: Metadata = { title: 'Admin control plane' }

export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')
  const [account] = await db.select({ role: user.role }).from(user).where(eq(user.id, session.user.id)).limit(1)
  if (!account || (!isOwnerEmail(session.user.email) && !['owner', 'admin', 'technical'].includes(account.role))) redirect('/workspace')
  return <main className="admin-page"><SiteHeader /><div className="admin-shell"><div className="inner-hero"><div className="inner-hero-copy"><span className="section-label">OWNER / TECHNICAL TEAM ACCESS</span><h1>Control with<br /><span>accountability.</span></h1><p>Manage approved operational access, understand the terminology, and keep every sensitive action attributable.</p></div><div className="inner-hero-index"><strong>ADMIN</strong><span>ROLE-SCOPED / VERIFIED</span></div></div><AdminConsole email={session.user.email} role={account.role} /></div><SiteFooter /></main>
}
