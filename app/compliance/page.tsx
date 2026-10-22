import type { Metadata } from 'next'
import { Scale, BellRing, ScrollText, ShieldCheck } from 'lucide-react'
import { AugiPageShell } from '@/components/augi-page-shell'

export const metadata: Metadata = { title: 'Law & Compliance Radar — AUGI' }

const watchSources = [
  {
    name: 'CISA / federal cyber directives',
    url: 'https://www.cisa.gov/laws-regulations',
    what: 'Binding incident-reporting rules for critical infrastructure (CIRCIA), SEC cyber-disclosure timelines, and federal breach-notification proposals.',
  },
  {
    name: 'State breach-notification laws (all 50 states)',
    url: 'https://www.ncsl.org/technology-and-communications/security-breach-notification-laws',
    what: 'Each state defines who must notify, how fast, and to whom. NCSL tracks amendments session by session.',
  },
  {
    name: 'State consumer-privacy statutes',
    url: 'https://www.ncsl.org/technology-and-communications/state-laws-related-to-digital-privacy',
    what: 'California CCPA/CPRA and 20+ successor states: data-subject rights, sale opt-outs, and enforcement rules that apply to platforms serving residents.',
  },
  {
    name: 'FTC enforcement & rulemaking',
    url: 'https://www.ftc.gov/legal-library',
    what: 'Actions that define "unfair or deceptive" data practice — the fastest-moving de facto standard for US platforms.',
  },
  {
    name: 'Federal Register — proposed rules',
    url: 'https://www.federalregister.gov/',
    what: 'Proposed changes are published here with comment windows. AUGI reviews proposals and briefs the owner before any product change becomes necessary.',
  },
]

const commitments = [
  { icon: BellRing, title: 'Owner is briefed before changes ship', body: 'When a proposal or law would change how AUGI works — data handling, retention, disclosures — the change, its source, and its effective date go to the owner for review before any code ships. No silent compliance pivots.' },
  { icon: ScrollText, title: 'Plain-language briefings', body: 'Each watch item is summarized as: what changed, who it applies to, what AUGI must do, and by when. Legal citations included so a reviewer can read the source directly.' },
  { icon: ShieldCheck, title: 'Boundary by design', body: 'AUGI does not do person-level name, phone, or address lookups. That product decision is also a compliance decision: it keeps the platform outside consumer-reporting (FCRA) and data-broker registration regimes in most jurisdictions.' },
]

export default function CompliancePage() {
  return (
    <AugiPageShell
      eyebrow="AUGI / LAW & COMPLIANCE RADAR"
      title={<>Staying ahead<br /><span>of the rules.</span></>}
      description="A standing watch on the laws and regulations that shape what AUGI can do — reviewed continuously, briefed to the owner before changes, and published here in plain language."
    >
      <section className="compliance-section section-wrap" aria-label="How the compliance watch works">
        {commitments.map(({ icon: Icon, title, body }) => (
          <article key={title}><Icon aria-hidden="true" /><strong>{title}</strong><p>{body}</p></article>
        ))}
      </section>

      <section className="compliance-watch section-wrap" aria-label="Regulatory watchlist">
        <h2><Scale aria-hidden="true" /> The watchlist</h2>
        <p>Primary sources AUGI monitors. Each links to the official tracker — no aggregator, no spin.</p>
        <ul>
          {watchSources.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer">{source.name} ↗</a>
              <p>{source.what}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="compliance-note section-wrap" aria-label="Scope note">
        <p>
          This page describes AUGI&apos;s monitoring practice. It is not legal advice, and the summaries here are starting points for a qualified review —
          requirements differ by state, by customer type, and over time. The live briefing feed for the owner is maintained in the
          owner control plane.
        </p>
      </section>
    </AugiPageShell>
  )
}
