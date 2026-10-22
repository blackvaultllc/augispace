import { LockKeyhole } from 'lucide-react'
import Link from 'next/link'
import { DomainDemo } from '@/components/domain-demo'
import { LiveThreatMap } from '@/components/live-threat-map'
import { BudgetPlanner } from '@/components/budget-planner'
import { AugiPageShell } from '@/components/augi-page-shell'

export const metadata = { title: 'Live Threat Map, Domain Check & Budget Demo' }
export const revalidate = 300

export default function DemoPage() {
  return <AugiPageShell eyebrow="TRY AUGI / LIVE INTELLIGENCE" title={<>Real feeds.<br /><span>Real map.</span></>} description="A live, evidence-based threat map from verified public sources, a domain check that reads public DNS, and a hands-on budget planner. No simulated traffic, no invented contacts."><section className="demo-section section-wrap inner-demo-section" aria-labelledby="demo-title"><div className="demo-intro"><div className="demo-privacy"><LockKeyhole aria-hidden="true" /><span>No account needed for the public view. No inbox access. No personal-data lookup.</span></div></div><LiveThreatMap /><DomainDemo /><section className="demo-budget-section" aria-labelledby="budget-demo-title"><div className="demo-budget-head"><span className="section-label">TRY AUGI / MEMBER PROGRAM PREVIEW</span><h2 id="budget-demo-title">Play with the<br /><span>budget planner.</span></h2><p>The full interactive planner from the AUGI member program — enter your income, plan rent, electricity, water, and savings, and see your month on one screen. Everything runs in your browser; <Link href="/sign-up">create an account</Link> to save your plan.</p></div><BudgetPlanner canSave={false} signedInLabel="Create a free account to save your plan and unlock the member program." /></section></section></AugiPageShell>
}
