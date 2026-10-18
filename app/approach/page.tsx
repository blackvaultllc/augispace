import { Approach, IntelligenceBand, TrustSection } from '@/components/augi-landing'
import { AugiPageShell } from '@/components/augi-page-shell'

export const metadata = { title: 'Our Approach' }

export default function ApproachPage() {
  return <AugiPageShell eyebrow="THE AUGI APPROACH" title={<>Security context,<br /><span>without the noise.</span></>} description="AUGI turns public email-domain signals into clear, evidence-led context without probing private inboxes or exposing personal identity data."><Approach /><IntelligenceBand /><TrustSection /></AugiPageShell>
}
