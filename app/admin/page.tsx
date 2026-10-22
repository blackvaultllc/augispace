import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AdminConsole } from '@/components/admin-console'
import { SiteFooter, SiteHeader } from '@/components/augi-landing'
import { createClient } from '@/lib/supabase/server'
import { isOwnerEmail } from '@/lib/plans'
import { resolveRole } from '@/lib/roles'

export const metadata: Metadata = { title: 'Owner control plane' }

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/sign-in')
  const role = await resolveRole(user.id, user.email)
  if (role.role !== 'owner') redirect('/sign-in?error=owner_only')

  return <main className="admin-page"><SiteHeader /><div className="admin-shell"><div className="inner-hero"><div className="inner-hero-copy"><span className="section-label">AUGI / OWNER ACCESS</span><h1>Control with<br /><span>clarity.</span></h1><p>Manage staff access, encrypted integrations, and the verified intelligence sources behind the radar.</p></div><div className="inner-hero-index"><strong>OWNER</strong><span>SESSION VERIFIED</span></div></div><AdminConsole email={user.email ?? ''} role="owner" /></div><SiteFooter /></main>
}
