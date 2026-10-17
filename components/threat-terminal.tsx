'use client'

import { useState, type CSSProperties, type FormEvent } from 'react'
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Crosshair,
  Fingerprint,
  Globe2,
  LockKeyhole,
  Network,
  Radio,
  ScanLine,
  Send,
  ShieldAlert,
  ShieldCheck,
  TerminalSquare,
} from 'lucide-react'

type ThreatRecord = {
  ip: string
  reputation: string
  inbound: number
  outbound: number
  engine: string
  routing: string
  asn: string
  hostname: string
  country: string
  risk: 'LOW' | 'ELEVATED' | 'CRITICAL'
}

type Report = {
  id: number
  ip: string
  vector: string
  note: string
  time: string
}

const records: Record<string, ThreatRecord> = {
  '86.206.98.41': {
    ip: '86.206.98.41',
    reputation: 'SUSPICIOUS',
    inbound: 82,
    outbound: 37,
    engine: 'Residential proxy',
    routing: 'AS2856 · British Telecom',
    asn: 'AS2856',
    hostname: 'host-86-206-98-41.range86-206.btcentralplus.com',
    country: 'United Kingdom · GB',
    risk: 'ELEVATED',
  },
  '8.8.8.8': {
    ip: '8.8.8.8',
    reputation: 'NO KNOWN ABUSE',
    inbound: 8,
    outbound: 4,
    engine: 'Public DNS resolver',
    routing: 'AS15169 · Google LLC',
    asn: 'AS15169',
    hostname: 'dns.google',
    country: 'United States · US',
    risk: 'LOW',
  },
  '185.220.101.1': {
    ip: '185.220.101.1',
    reputation: 'HOSTILE',
    inbound: 96,
    outbound: 91,
    engine: 'Tor exit relay',
    routing: 'AS60729 · Zwiebelfreunde e.V.',
    asn: 'AS60729',
    hostname: 'tor-exit-185-220-101-1',
    country: 'Germany · DE',
    risk: 'CRITICAL',
  },
}

const initialReports: Report[] = [
  { id: 1, ip: '185.220.101.1', vector: 'TOR EXIT RELAY', note: 'Repeated credential spray · 64 attempts', time: '14:32:08Z' },
  { id: 2, ip: '45.155.205.110', vector: 'SSH BRUTE FORCE', note: 'Authentication sweep across 22/tcp', time: '14:28:41Z' },
  { id: 3, ip: '86.206.98.41', vector: 'BOTNET TELEMETRY', note: 'Unusual outbound beacon interval', time: '14:19:16Z' },
]

function formatTime(date: Date) {
  return `${date.toISOString().slice(11, 19)}Z`
}

function MetricGauge({ label, value, direction }: { label: string; value: number; direction: 'inbound' | 'outbound' }) {
  const angle = (value / 100) * 270
  const indicatorColor = value >= 80 ? 'var(--risk-red)' : value >= 55 ? 'var(--risk-amber)' : 'var(--gold)'

  return (
    <div className="metric-gauge">
      <div className="gauge-visual" style={{ '--gauge-angle': `${angle}deg`, '--gauge-offset': `${203 - (value / 100) * 203}px`, '--gauge-color': indicatorColor } as CSSProperties}>
        <svg viewBox="0 0 112 112" role="img" aria-label={`${label}: ${value} percent`}>
          <circle className="gauge-track" cx="56" cy="56" r="43" />
          <circle className="gauge-progress" cx="56" cy="56" r="43" />
          <circle className="gauge-center" cx="56" cy="56" r="31" />
        </svg>
        <span className="gauge-value">{value}<small>%</small></span>
        <span className="gauge-direction" aria-hidden="true">
          {direction === 'inbound' ? <ArrowDownLeft /> : <ArrowUpRight />}
        </span>
      </div>
      <span className="gauge-label">{label}</span>
      <span className="gauge-sub">{value >= 80 ? 'ANOMALOUS' : value >= 55 ? 'REVIEW SIGNAL' : 'WITHIN BASELINE'}</span>
    </div>
  )
}

function DataField({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Network }) {
  return (
    <div className="data-field">
      <span className="field-icon" aria-hidden="true"><Icon /></span>
      <div className="field-copy">
        <span className="field-label">{label}</span>
        <span className="field-value" title={value}>{value}</span>
      </div>
      <span className="field-mark" aria-hidden="true"><ArrowUpRight /></span>
    </div>
  )
}

export function ThreatTerminal() {
  const [target, setTarget] = useState('86.206.98.41')
  const [record, setRecord] = useState<ThreatRecord>(records['86.206.98.41'])
  const [lookupMessage, setLookupMessage] = useState('FEED SYNCHRONIZED · PUBLIC RECORD')
  const [vector, setVector] = useState('SSH BRUTE FORCE')
  const [note, setNote] = useState('')
  const [reports, setReports] = useState(initialReports)

  function resolveTarget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = target.trim()
    const ipv4Pattern = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/
    if (!ipv4Pattern.test(normalized)) {
      setLookupMessage('INVALID TARGET · ENTER A VALID IPV4 ADDRESS')
      return
    }

    const resolved = records[normalized] ?? {
      ip: normalized,
      reputation: 'UNCLASSIFIED',
      inbound: 12,
      outbound: 9,
      engine: 'No proxy indicators',
      routing: 'Routing data not indexed',
      asn: '—',
      hostname: 'No reverse DNS record',
      country: 'Unknown · —',
      risk: 'LOW' as const,
    }
    setRecord(resolved)
    setTarget(normalized)
    setLookupMessage(records[normalized] ? 'FEED SYNCHRONIZED · PUBLIC RECORD' : 'LOCAL LOOKUP · NO MATCHING PUBLIC RECORD')
  }

  function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanNote = note.trim()
    if (!cleanNote) return
    setReports((current) => [{
      id: Date.now(),
      ip: record.ip,
      vector,
      note: cleanNote,
      time: formatTime(new Date()),
    }, ...current])
    setNote('')
  }

  return (
    <main className="terminal-shell">
      <div className="terminal-frame">
        <header className="terminal-header">
          <a href="#overview" className="wordmark" aria-label="Aegis Intelligence home">
            <span className="wordmark-symbol"><Crosshair aria-hidden="true" /></span>
            <span>AEGIS<span className="wordmark-light"> / INTEL</span></span>
          </a>
          <div className="header-center"><span className="status-pulse" /> PRIVATE THREAT EXCHANGE <span className="header-divider">/</span> NODE 07</div>
          <div className="header-right"><span>OPERATOR</span><span className="operator-id">FIELD-01</span><span className="operator-mark">01</span></div>
        </header>

        <section className="intro-row" id="overview" aria-labelledby="page-title">
          <div>
            <div className="eyebrow"><span>DEFENSE SYSTEMS</span><span className="eyebrow-line" /><span>01 — INTELLIGENCE</span></div>
            <h1 id="page-title">IP <span>INTELLIGENCE</span></h1>
            <p className="intro-copy">Resolve an address. Read the signals. Submit field intelligence.</p>
          </div>
          <div className="intro-index" aria-hidden="true"><span>AEGIS / IR</span><span>THREAT RESOLUTION CONSOLE</span><span>51°30&apos;26.4&quot;N　00°07&apos;39.0&quot;W</span></div>
        </section>

        <form className="resolver" onSubmit={resolveTarget}>
          <label className="resolver-label" htmlFor="target-ip"><Crosshair aria-hidden="true" /><span>TARGET IP RESOLVER</span></label>
          <div className="resolver-control">
            <input id="target-ip" type="text" inputMode="decimal" spellCheck={false} autoComplete="off" value={target} onChange={(event) => setTarget(event.target.value)} aria-label="Target IPv4 address" />
            <span className="resolver-protocol">IPv4 / PUBLIC</span>
          </div>
          <button className="resolve-button" type="submit"><ScanLine aria-hidden="true" /><span>RESOLVE TARGET</span><span className="button-arrow" aria-hidden="true"><ArrowUpRight /></span></button>
        </form>
        <div className="resolver-meta"><span className={lookupMessage.startsWith('INVALID') ? 'message-error' : ''}>{lookupMessage}</span><span>LAST RESOLVED <b>JUST NOW</b></span></div>

        <div className="overview-grid">
          <section className="panel reputation-panel" aria-labelledby="reputation-title">
            <div className="panel-heading">
              <div className="panel-title-group"><span className="panel-number">01</span><div><h2 id="reputation-title">REPUTATION MATRIX</h2><p>BEHAVIORAL VECTOR ANALYSIS</p></div></div>
              <span className="panel-symbol" aria-hidden="true">◎</span>
            </div>
            <div className="matrix-target">
              <div className="matrix-coordinates" aria-hidden="true"><span>90°</span><span>00°</span><span>270°</span><span>180°</span></div>
              <div className="radar-grid" aria-hidden="true"><div className="radar-sweep" /><span className="radar-axis radar-axis-h" /><span className="radar-axis radar-axis-v" /><span className="radar-dot dot-one" /><span className="radar-dot dot-two" /><span className="radar-dot dot-three" /><span className="radar-dot dot-four" /></div>
              <div className="matrix-core"><span>REPUTATION</span><strong className={`risk-${record.risk.toLowerCase()}`}>{record.reputation}</strong><small>{record.ip}</small></div>
            </div>
            <div className="gauge-row">
              <MetricGauge label="INBOUND VECTOR INTEGRITY" value={record.inbound} direction="inbound" />
              <span className="gauge-divider" aria-hidden="true" />
              <MetricGauge label="OUTBOUND TELEMETRY PROFILE" value={record.outbound} direction="outbound" />
            </div>
            <div className="severity-strip"><span className="severity-square" /><span>THREAT POSTURE</span><strong className={`risk-${record.risk.toLowerCase()}`}>{record.risk}</strong><span className="severity-spacer" /><span className="confidence">CONFIDENCE <b>94.2%</b></span></div>
          </section>

          <section className="panel telemetry-panel" aria-labelledby="telemetry-title">
            <div className="panel-heading">
              <div className="panel-title-group"><span className="panel-number">02</span><div><h2 id="telemetry-title">SOVEREIGN OSINT TELEMETRY</h2><p>PASSIVE OBSERVATION / PUBLIC DATA</p></div></div>
              <span className="live-chip"><span className="status-pulse" /> LIVE</span>
            </div>
            <div className="telemetry-target"><Globe2 aria-hidden="true" /><span>RESOLVED SUBJECT</span><strong>{record.ip}</strong><span className={`subject-status risk-${record.risk.toLowerCase()}`}>{record.risk} RISK</span></div>
            <div className="data-grid">
              <DataField label="CONNECTION ENGINE" value={record.engine} icon={Radio} />
              <DataField label="ROUTING INFRASTRUCTURE" value={record.routing} icon={Network} />
              <DataField label="AUTONOMOUS SYSTEM / ASN" value={record.asn} icon={Activity} />
              <DataField label="HOSTNAME STRING" value={record.hostname} icon={TerminalSquare} />
              <DataField label="COUNTRY ORIGIN" value={record.country} icon={Globe2} />
              <DataField label="SIGNAL CLASSIFICATION" value={record.reputation} icon={Fingerprint} />
            </div>
            <div className="telemetry-foot"><LockKeyhole aria-hidden="true" /><span>NO ACTIVE PROBING · PASSIVE INTELLIGENCE ONLY</span><span className="telemetry-foot-right">SOURCE: PUBLIC FEEDS</span></div>
          </section>
        </div>

        <section className="panel reporting-panel" aria-labelledby="reporting-title">
          <div className="reporting-main">
            <div className="panel-heading reporting-heading">
              <div className="panel-title-group"><span className="panel-number">03</span><div><h2 id="reporting-title">INTERDICTION REPORTING LOG</h2><p>CONTRIBUTE VERIFIED FIELD INTELLIGENCE</p></div></div>
              <span className="secure-stamp"><ShieldCheck aria-hidden="true" /> SECURE CHANNEL</span>
            </div>
            <form className="report-form" onSubmit={submitReport}>
              <label className="report-field report-ip-field"><span>SUBJECT IP</span><input value={record.ip} readOnly aria-label="Subject IP address" /></label>
              <label className="report-field report-vector-field"><span>ATTACK VECTOR</span><select value={vector} onChange={(event) => setVector(event.target.value)}><option>SSH BRUTE FORCE</option><option>INJECTION ATTEMPT</option><option>BOTNET TELEMETRY</option><option>CREDENTIAL STUFFING</option><option>PORT SCAN</option><option>OTHER / UNCLASSIFIED</option></select></label>
              <label className="report-field report-note-field"><span>FIELD OBSERVATION</span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Describe observed behavior…" maxLength={180} required /></label>
              <button className="submit-report" type="submit"><Send aria-hidden="true" /><span>LOG INTEL</span></button>
            </form>
          </div>
          <div className="feed-column">
            <div className="feed-heading"><span><ShieldAlert aria-hidden="true" /> ACTIVITY FEED</span><span className="feed-count">{String(reports.length).padStart(2, '0')} RECORDS</span></div>
            <div className="feed-list" aria-live="polite" aria-relevant="additions">
              {reports.map((report) => (
                <article className="feed-entry" key={report.id}>
                  <span className="feed-marker" aria-hidden="true" />
                  <div className="feed-entry-body"><div className="feed-entry-top"><strong>{report.ip}</strong><time>{report.time}</time></div><span className="feed-vector">{report.vector}</span><p>{report.note}</p></div>
                </article>
              ))}
            </div>
            <div className="feed-footer"><span>END OF ENCRYPTED STREAM</span><span aria-hidden="true">•••</span></div>
          </div>
        </section>

        <footer className="terminal-footer"><span>AEGIS INTELLIGENCE SYSTEMS <b>© 2026</b></span><span>ALL DATA SHOWN IS SIMULATED FOR DEMONSTRATION</span><span><span className="status-pulse" /> SYSTEM NOMINAL <span className="footer-build">BUILD 7.04.1</span></span></footer>
      </div>
    </main>
  )
}
