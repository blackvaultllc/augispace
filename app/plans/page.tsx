import { Plans } from '@/components/augi-landing'
import { AugiPageShell } from '@/components/augi-page-shell'

export const metadata = { title: 'Plans' }

export default function PlansPage() {
  return <AugiPageShell eyebrow="ACCESS THAT GROWS WITH YOU" title={<>Start with a signal.<br /><span>Go deeper when ready.</span></>} description="Choose the level of context that fits your work. Every tier is built around public evidence, clear boundaries, and defensive use."><Plans /></AugiPageShell>
}
