'use client'

import { type FormEvent, useState } from 'react'
import { ArrowUpRight, Check, CircleAlert, LoaderCircle, LockKeyhole, Mail, ShieldAlert, ShieldCheck } from 'lucide-react'

type DomainCheck = {
  label: string
  status: 'present' | 'missing' | 'monitoring' | 'unavailable'
  detail: string
}

type DomainResult = {
  domain: string
  score: number
  summary: string
  checkedAt: string
  checks: DomainCheck[]
  evidence: { mx: string[]; spf: string | null; dmarc: string | null }
  error?: string
}

const statusLabels: Record<DomainCheck['status'], string> = {
  present: 'PRESENT',
  missing: 'MISSING',
  monitoring: 'MONITORING',
  unavailable: 'UNAVAILABLE',
}

export function DomainDemo() {
  const [email, setEmail] = useState('')
  const [result, setResult] = useState<DomainResult | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function runCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setResult(null)

    const normalizedEmail = email.trim().toLowerCase()
    const atIndex = normalizedEmail.lastIndexOf('@')
    if (atIndex < 1 || atIndex === normalizedEmail.length - 1) {
      setError('Enter a valid email address to continue.')
      return
    }

    const domain = normalizedEmail.slice(atIndex + 1)
    setIsLoading(true)
    try {
      const response = await fetch('/api/domain-security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      })
      const payload = await response.json() as DomainResult
      if (!response.ok) throw new Error(payload.error || 'The domain check could not be completed.')
      setResult(payload)
      setEmail('')
    } catch {
      setError('We could not complete this domain check right now. Please try again shortly.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="demo-console">
      <div className="console-topbar"><span><span className="console-live-dot" /> AUGI SIGNAL CONSOLE</span><span>PUBLIC DNS / READ ONLY</span></div>
      <form className="demo-form" onSubmit={runCheck}>
        <label htmlFor="demo-email">EMAIL ADDRESS</label>
        <div className="demo-input-wrap"><Mail aria-hidden="true" /><input id="demo-email" type="email" autoComplete="email" inputMode="email" maxLength={254} placeholder="you@company.com" required value={email} onChange={(event) => setEmail(event.target.value)} /><span className="input-tail">EMAIL</span></div>
        <button className="demo-submit" type="submit" disabled={isLoading}>
          {isLoading ? <LoaderCircle className="spin-icon" aria-hidden="true" /> : <ShieldAlert aria-hidden="true" />}
          <span>{isLoading ? 'READING SIGNALS' : 'ANALYZE DOMAIN'}</span>
          {!isLoading && <ArrowUpRight aria-hidden="true" />}
        </button>
        <p className="demo-form-note"><LockKeyhole aria-hidden="true" /> Only the domain is sent to check public DNS records.</p>
      </form>

      {error && <p className="demo-error" role="alert"><CircleAlert aria-hidden="true" />{error}</p>}

      {result ? (
        <section className="domain-result" aria-label={`Domain security results for ${result.domain}`} aria-live="polite">
          <div className="result-heading"><div><span className="result-overline">DOMAIN POSTURE / PUBLIC RECORDS</span><strong>{result.domain}</strong></div><span className={result.score >= 85 ? 'result-score score-strong' : result.score >= 55 ? 'result-score score-review' : 'result-score score-low'}><b>{result.score}</b><small>/ 100</small></span></div>
          <div className="result-summary">{result.score >= 85 ? <ShieldCheck aria-hidden="true" /> : <ShieldAlert aria-hidden="true" />}<span>{result.summary}</span></div>
          <div className="result-checks">
            {result.checks.map((check) => <div className="result-check" key={check.label}><span className={`check-status status-${check.status}`}>{check.status === 'present' ? <Check aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}{statusLabels[check.status]}</span><div><strong>{check.label}</strong><p>{check.detail}</p></div></div>)}
          </div>
          <details className="result-evidence">
            <summary>View DNS evidence <ArrowUpRight aria-hidden="true" /></summary>
            <dl>
              <div><dt>MX</dt><dd>{result.evidence.mx.length ? result.evidence.mx.join(' · ') : 'No MX answer returned'}</dd></div>
              <div><dt>SPF</dt><dd>{result.evidence.spf ?? 'No SPF record found'}</dd></div>
              <div><dt>DMARC</dt><dd>{result.evidence.dmarc ?? 'No DMARC record found'}</dd></div>
            </dl>
          </details>
          <div className="result-footer"><span>CHECKED {new Date(result.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' })}</span><span>DNS EVIDENCE ONLY</span></div>
          <p className="result-disclaimer">This is a configuration snapshot, not a reputation verdict or proof of compromise.</p>
        </section>
      ) : (
        <div className="demo-empty"><span className="empty-radar"><span /><i /><b /></span><div><strong>Awaiting a domain</strong><span>Public DNS signals will appear here.</span></div><span className="empty-code">MX / SPF / DMARC</span></div>
      )}
    </div>
  )
}
