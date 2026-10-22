import { LockKeyhole } from 'lucide-react'
import { DomainDemo } from '@/components/domain-demo'
import { LiveThreatMap } from '@/components/live-threat-map'
import { AugiPageShell } from '@/components/augi-page-shell'

export const metadata = { title: 'Live Threat Map & Domain Check' }
export const revalidate = 300

export default function DemoPage() {
  return <AugiPageShell eyebrow="TRY AUGI / LIVE INTELLIGENCE" title={<>Real feeds.<br /><span>Real map.</span></>} description="A live, evidence-based threat map from verified public sources — plus a domain check that reads public DNS. No simulated traffic, no invented contacts."><section className="demo-section section-wrap inner-demo-section" aria-labelledby="demo-title"><div className="demo-intro"><div className="demo-privacy"><LockKeyhole aria-hidden="true" /><span>No account needed for the public view. No inbox access. No personal-data lookup.</span></div></div><LiveThreatMap /><DomainDemo /></section></AugiPageShell>
}
