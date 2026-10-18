'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Check, CircleAlert, Clock3, Command, Fingerprint, LoaderCircle, LockKeyhole, LogOut, Mail, Radar, ShieldCheck, Sparkles } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { IpLocationMap } from '@/components/ip-location-map'
import { SecurityCopilot } from '@/components/security-copilot'

type DomainCheck = {
  label: string
  status: 'present' | 'missing' | 'monitoring' | 'unavailable'
  detail: string
}

export type InvestigationReport = {
  domain: string
  score: number
  summary: string
  checkedAt: string
  checks: DomainCheck[]
  evidence: { mx: string[]; spf: string | null; dmarc: string | null } | null
  aiExplanation: string | null
  locations?: { ip: string; city: string | null; region: string | null; country: string | null; latitude: number; longitude: number; source: string }[]
}

export type SavedInvestigation = {
  id: string
  domain: string
  score: number
  createdAt: string
  report: InvestigationReport
}

type Props = {
  name: string
  email: string
  owner: boolean
  tier: 'observer' | 'analyst' | 'command'
  tierLabel: string
  used: number
  limit: number | null
  investigations: SavedInvestigation[]
}

const statusLabels: Record<DomainCheck['status'], string> = {
  present: 'PRESENT',
  missing: 'MISSING',
  monitoring: 'MONITORING',
  unavailable: 'UNAVAILABLE',
}

function ReportDetails({ report }: { report: InvestigationReport }) {
  return (
    <section className="workspace-report" aria-label={`Investigation report for ${report.domain}`} aria-live="polite">
      <div className="workspace-report-heading">
        <div><span className="workspace-micro-label">PUBLIC DNS POSTURE / EVIDENCE-LED</span><h2>{report.domain}</h2></div>
        <div className="workspace-score"><strong>{report.score}</strong><span>/ 100</span></div>
      </div>
      <p className="workspace-report-summary"><ShieldCheck aria-hidden="true" />{report.summary}</p>
      <div className="workspace-checks">
        {report.checks.map((check) => (
          <article className="workspace-check" key={check.label}>
            <span className={`workspace-status status-${check.status}`}>{check.status === 'present' ? <Check aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}{statusLabels[check.status]}</span>
            <div><strong>{check.label}</strong><p>{check.detail}</p></div>
          </article>
        ))}
      </div>
      {report.evidence && (
        <details className="workspace-evidence" open>
          <summary>DNS evidence <ArrowDownRight aria-hidden="true" /></summary>
          <dl>
            <div><dt>MX</dt><dd>{report.evidence.mx.length ? report.evidence.mx.join(' · ') : 'No MX answer returned'}</dd></div>
            <div><dt>SPF</dt><dd>{report.evidence.spf ?? 'No SPF record found'}</dd></div>
            <div><dt>DMARC</dt><dd>{report.evidence.dmarc ?? 'No DMARC record found'}</dd></div>
          </dl>
        </details>
      )}
      {report.locations && <IpLocationMap locations={report.locations} />}
      {report.aiExplanation && (
        <section className="workspace-ai-card" aria-labelledby="ai-explanation-title">
          <div className="workspace-ai-title"><Sparkles aria-hidden="true" /><div><span className="workspace-micro-label">AUGI / EVIDENCE-LED ANALYSIS</span><h3 id="ai-explanation-title">What these signals mean</h3></div></div>
          <p>{report.aiExplanation}</p>
        </section>
      )}
      <p className="workspace-disclaimer">DNS configuration is not proof of sender identity, intent, reputation, or compromise. Review evidence before acting.</p>
    </section>
  )
}

export function MemberWorkspace({ name, email, owner, tier, tierLabel, used, limit, investigations: initialInvestigations }: Props) {
  const router = useRouter()
  const [emailInput, setEmailInput] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<InvestigationReport | null>(null)
  const [investigations, setInvestigations] = useState(initialInvestigations)
  const [usedCount, setUsedCount] = useState(used)
  const remaining = limit === null ? null : Math.max(0, limit - usedCount)

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setReport(null)
    const normalizedEmail = emailInput.trim().toLowerCase()
    const atIndex = normalizedEmail.lastIndexOf('@')
    if (atIndex < 1 || atIndex === normalizedEmail.length - 1) {
      setError('Enter a valid email address to continue.')
      return
    }

    setBusy(true)
    try {
      const response = await fetch('/api/domain-security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: normalizedEmail.slice(atIndex + 1) }),
      })
      const payload = await response.json() as {
        error?: string
        saved?: boolean
        result?: InvestigationReport
        investigation?: SavedInvestigation
        usage?: { used: number; remaining: number | null }
      }
      if (!response.ok || !payload.result) throw new Error(payload.error || 'The investigation could not be completed.')
      setReport(payload.result)
      setEmailInput('')
      if (payload.investigation) setInvestigations((current) => [payload.investigation!, ...current.filter((item) => item.id !== payload.investigation!.id)].slice(0, 12))
      if (payload.usage) setUsedCount(payload.usage.used)
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The investigation could not be completed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    await authClient.signOut()
    router.push('/')
    router.refresh()
  }

  async function openBilling(path: '/api/billing/checkout' | '/api/billing/portal', plan?: 'analyst' | 'command') {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(plan ? { plan } : {}) })
    const payload = await response.json() as { url?: string; error?: string }
    if (!response.ok || !payload.url) { setError(payload.error || 'Billing could not be opened.'); return }
    window.location.href = payload.url
  }

  return (
    <main className="workspace-page">
      <div className="workspace-shell">
        <header className="workspace-header">
          <Link className="workspace-brand" href="/" aria-label="AUGI home"><span className="workspace-brand-mark" aria-hidden="true"><span /></span><span>AUGI<span className="workspace-brand-caption"> / MEMBER INTELLIGENCE</span></span></Link>
          <div className="workspace-header-actions">
            <span className="workspace-tier"><span />{tierLabel.toUpperCase()}</span>
            <button className="workspace-signout" type="button" onClick={signOut}><LogOut aria-hidden="true" /> Sign out</button>
          </div>
        </header>

        <section className="workspace-welcome" aria-labelledby="workspace-title">
          <div>
            <p className="workspace-eyebrow"><span className="pulse-dot" /> SECURE MEMBER WORKSPACE / {owner ? 'OWNER ACCESS' : 'PERSONAL ACCOUNT'}</p>
            <h1 id="workspace-title">Welcome, <span>{name || 'Analyst'}.</span></h1>
            <p className="workspace-welcome-copy">Your saved domain investigations and evidence, in one private place.</p>
          </div>
          <div className="workspace-profile"><span className="workspace-avatar"><Fingerprint aria-hidden="true" /></span><div><strong>{name}</strong><span>{email}</span></div></div>
        </section>

        <div className="workspace-metrics" aria-label="Account overview">
          <article className="workspace-metric"><span className="workspace-metric-icon"><Radar aria-hidden="true" /></span><div><span>PLAN</span><strong>{tierLabel}</strong><small>{tier === 'observer' ? 'Public DNS surface view' : tier === 'analyst' ? 'Expanded DNS evidence' : 'Evidence plus AUGI analysis'}</small></div></article>
          <article className="workspace-metric"><span className="workspace-metric-icon"><Activity aria-hidden="true" /></span><div><span>THIS MONTH</span><strong>{limit === null ? `${usedCount} / ∞` : `${usedCount} / ${limit}`}</strong><small>{remaining === null ? 'Unlimited owner investigations' : `${remaining} checks remaining this month`}</small></div></article>
          <article className="workspace-metric"><span className="workspace-metric-icon"><LockKeyhole aria-hidden="true" /></span><div><span>ACCOUNT</span><strong>{owner ? 'Owner' : 'Protected'}</strong><small>Private, account-scoped reports</small></div></article>
        </div>

        <SecurityCopilot />

        <div className="workspace-content-grid">
          <section className="workspace-console" aria-labelledby="investigation-title">
            <div className="workspace-section-heading"><div><span className="workspace-micro-label">NEW INVESTIGATION / PUBLIC SIGNALS</span><h2 id="investigation-title">Read the domain.</h2></div><span className="workspace-readonly"><span /> READ ONLY</span></div>
            <p className="workspace-section-copy">Enter an email address. The mailbox name stays in your browser; AUGI checks public DNS records for its domain only.</p>
            <form className="workspace-form" onSubmit={analyze}>
              <label htmlFor="workspace-email">EMAIL ADDRESS</label>
              <div className="workspace-input"><Mail aria-hidden="true" /><input id="workspace-email" type="email" autoComplete="email" inputMode="email" maxLength={254} required value={emailInput} onChange={(event) => setEmailInput(event.target.value)} placeholder="you@company.com" /><span>EMAIL</span></div>
              <button className="workspace-submit" type="submit" disabled={busy || remaining === 0}>
                {busy ? <LoaderCircle className="spin-icon" aria-hidden="true" /> : <Radar aria-hidden="true" />}
                {busy ? 'READING PUBLIC SIGNALS' : remaining === 0 ? 'MONTHLY LIMIT REACHED' : 'ANALYZE AND SAVE'}
                {!busy && <ArrowUpRight aria-hidden="true" />}
              </button>
              <p className="workspace-privacy-note"><LockKeyhole aria-hidden="true" />No inbox access. Only the domain and public DNS responses are stored.</p>
            </form>
            {error && <p className="workspace-error" role="alert"><CircleAlert aria-hidden="true" />{error}</p>}
            {report ? <ReportDetails report={report} /> : <div className="workspace-awaiting"><span><Radar aria-hidden="true" /></span><div><strong>Awaiting a domain signal</strong><p>Run an investigation or open a saved report.</p></div></div>}
          </section>

          <aside className="workspace-history" aria-labelledby="history-title">
            <div className="workspace-section-heading"><div><span className="workspace-micro-label">PRIVATE TO YOUR ACCOUNT</span><h2 id="history-title">Saved reports</h2></div><span className="history-count">{investigations.length.toString().padStart(2, '0')}</span></div>
            {investigations.length ? (
              <div className="workspace-history-list">
                {investigations.map((item) => (
                  <button className="workspace-history-item" type="button" key={item.id} onClick={() => setReport(item.report)}>
                    <span className="history-item-icon"><Command aria-hidden="true" /></span>
                    <span className="history-item-copy"><strong>{item.domain}</strong><small><Clock3 aria-hidden="true" />{new Date(item.createdAt).toLocaleDateString()}</small></span>
                    <span className="history-item-score">{item.score}<small>/100</small></span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="workspace-history-empty"><span><Clock3 aria-hidden="true" /></span><p>Your saved investigations will appear here after your first check.</p></div>
            )}
            {tier === 'observer' && <div className="workspace-billing-actions"><button type="button" onClick={() => openBilling('/api/billing/checkout', 'analyst')}>Upgrade to Analyst <ArrowUpRight aria-hidden="true" /></button><button type="button" onClick={() => openBilling('/api/billing/checkout', 'command')}>Upgrade to Command <ArrowUpRight aria-hidden="true" /></button></div>}
            {tier !== 'observer' && <button className="workspace-plan-link workspace-manage-billing" type="button" onClick={() => openBilling('/api/billing/portal')}>Manage subscription <ArrowRight aria-hidden="true" /></button>}
            {owner && <Link className="workspace-plan-link" href="/admin"><Command aria-hidden="true" /> Open admin control plane <ArrowRight aria-hidden="true" /></Link>}
            <Link className="workspace-plan-link" href="/#plans">Explore plan access <ArrowRight aria-hidden="true" /></Link>
            <div className="workspace-plan-note"><Sparkles aria-hidden="true" /><p>{tier === 'observer' ? 'Analyst unlocks raw DNS evidence and 30 monthly checks. Command adds AUGI explanations and 150 checks.' : tier === 'analyst' ? 'Command adds evidence-led AI explanations and 150 monthly checks.' : 'AUGI explanations connect each recommendation back to public DNS evidence.'}</p></div>
            <div className="workspace-scope-note"><Check aria-hidden="true" /><p>Configuration signals are not identity verification or proof of compromise. Use findings for defensive action.</p></div>
          </aside>
        </div>

        <footer className="workspace-footer"><span>© 2026 SERPENT INTELLIGENCE SYSTEMS</span><span><span className="pulse-dot" /> DEFENSIVE USE · PUBLIC RECORDS ONLY</span><Link href="/">AUGI HOME <ArrowUpRight aria-hidden="true" /></Link></footer>
      </div>
    </main>
  )
}
