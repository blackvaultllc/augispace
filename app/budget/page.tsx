import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Banknote, PiggyBank, ShieldCheck } from 'lucide-react'
import { BudgetPlanner } from '@/components/budget-planner'
import { SiteHeader, SiteFooter } from '@/components/augi-landing'
import { resolveRole } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Budgeting — AUGI member program' }

const highlights = [
  { icon: Banknote, title: 'Income you can see', body: 'List fixed commitments, seasonal utilities, and living costs, then see exactly what is left before the month spends it for you.' },
  { icon: PiggyBank, title: 'Future you, funded on purpose', body: 'The planner tracks your savings and debt share against the 20% guideline and tells you when it is on target.' },
  { icon: ShieldCheck, title: 'Private by design', body: 'Your numbers never leave this browser tab. Nothing is stored on our servers — the plan saves locally on your own device.' },
]

export default async function BudgetPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in?next=/budget')
  const role = await resolveRole(user.id, user.email)
  if (!role.isAdmin) redirect('/sign-in?error=owner_only')

  return (
    <main className="budget-page">
      <SiteHeader />
      <div className="budget-shell">
        <div className="inner-hero">
          <div className="inner-hero-copy">
            <span className="section-label">AUGI / MEMBER PROGRAM · BUDGETING</span>
            <h1>Secure your<br /><span>financial future.</span></h1>
            <p>A practical budgeting program: calibrate every paycheck, cover rent, electricity, and water with intention, and build the habit of funding the future first. Included with the member program.</p>
          </div>
          <div className="inner-hero-index"><strong>BUDGET</strong><span>{role.role === 'owner' ? 'OWNER ACCESS' : 'STAFF ACCESS'}</span></div>
        </div>

        <div className="budget-highlights">
          {highlights.map(({ icon: Icon, title, body }) => (
            <article key={title}>
              <Icon aria-hidden="true" />
              <strong>{title}</strong>
              <p>{body}</p>
            </article>
          ))}
        </div>

        <BudgetPlanner canSave />
      </div>
      <SiteFooter />
    </main>
  )
}
