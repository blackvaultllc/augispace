import { LockKeyhole } from 'lucide-react'
import { DomainDemo } from '@/components/domain-demo'
import { AugiPageShell } from '@/components/augi-page-shell'

export const metadata = { title: 'Live Domain Check' }

export default function DemoPage() {
  return <AugiPageShell eyebrow="TRY AUGI / LIVE DOMAIN CHECK" title={<>One address.<br /><span>A clearer picture.</span></>} description="Enter an email address to check its domain’s public mail-security configuration. The mailbox name stays in your browser; only the domain is checked."><section className="demo-section section-wrap inner-demo-section" aria-labelledby="demo-title"><div className="demo-intro"><div className="demo-privacy"><LockKeyhole aria-hidden="true" /><span>No inbox access. No passwords. No personal-data lookup.</span></div></div><DomainDemo /></section></AugiPageShell>
}
