'use client'

import { useState, type FormEvent } from 'react'
import { CircleAlert, Clipboard, Crosshair, Download, FileJson, FileText, Globe2, LoaderCircle, Mail, Network, Save, Search, Trash2 } from 'lucide-react'
import { dossierMailto, downloadDossier, formatDossierText, type IpDossier } from '@/lib/ip-dossier'

type Props = {
  dossiers: IpDossier[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onChange: (update: (current: IpDossier[]) => IpDossier[]) => void
  onShowOnRadar: (dossier: IpDossier) => void
}

export function DossierActions({ dossier }: { dossier: IpDossier }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(formatDossierText(dossier))
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="dossier-actions">
      <a className="dossier-action is-primary" href={dossierMailto(dossier)}><Mail aria-hidden="true" /> EMAIL</a>
      <button className="dossier-action" type="button" onClick={() => downloadDossier(dossier, 'txt')}><FileText aria-hidden="true" /> TXT</button>
      <button className="dossier-action" type="button" onClick={() => downloadDossier(dossier, 'json')}><FileJson aria-hidden="true" /> JSON</button>
      <button className="dossier-action" type="button" onClick={copy}><Clipboard aria-hidden="true" /> {copied ? 'COPIED' : 'COPY'}</button>
    </div>
  )
}

export function DossierFacts({ dossier }: { dossier: IpDossier }) {
  const { report } = dossier
  const place = [report.location.city, report.location.region, report.location.country].filter(Boolean).join(', ') || 'Unknown'
  const rows: [string, string][] = [
    ['VERSION', report.version],
    ['ASN', report.connection.asn ? `AS${report.connection.asn}` : 'Unknown'],
    ['ORGANIZATION', report.connection.org ?? 'Unknown'],
    ['ISP', report.connection.isp ?? 'Unknown'],
    ['NETWORK DOMAIN', report.connection.domain ?? 'Unknown'],
    ['REVERSE DNS', report.reverseDns === null ? 'Lookup unavailable' : report.reverseDns.length ? report.reverseDns.join(', ') : 'No PTR record'],
    ['NETWORK AREA', place],
    ['POSTAL', report.location.postal ?? 'Unknown'],
    ['APPROX. COORDS', report.location.latitude !== null && report.location.longitude !== null ? `${report.location.latitude.toFixed(4)}, ${report.location.longitude.toFixed(4)}` : 'Unknown'],
    ['TIME ZONE', [report.location.timezone, report.location.utcOffset].filter(Boolean).join(' ') || 'Unknown'],
    ['LOOKUPS SAVED', String(dossier.lookupCount)],
    ['LAST OBSERVED', new Date(report.observedAt).toLocaleString()],
  ]
  return (
    <dl className="dossier-facts">
      {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>
  )
}

export function IpDossierDesk({ dossiers, selectedId, onSelect, onChange, onShowOnRadar }: Props) {
  const [ipInput, setIpInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notesDraft, setNotesDraft] = useState<{ id: string; value: string } | null>(null)
  const [notesState, setNotesState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const selected = dossiers.find((dossier) => dossier.id === selectedId) ?? null
  const notesValue = selected && notesDraft?.id === selected.id ? notesDraft.value : selected?.notes ?? ''

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const response = await fetch('/api/ip-dossiers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip: ipInput }) })
      const payload = await response.json() as { dossier?: IpDossier; error?: string }
      if (!response.ok || !payload.dossier) throw new Error(payload.error || 'The IP lookup failed.')
      const dossier = payload.dossier
      onChange((current) => [dossier, ...current.filter((item) => item.id !== dossier.id)])
      onSelect(dossier.id)
      setNotesDraft(null)
      setIpInput('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The IP lookup failed.')
    } finally {
      setBusy(false)
    }
  }

  async function saveNotes() {
    if (!selected) return
    setNotesState('saving')
    try {
      const response = await fetch('/api/ip-dossiers', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selected.id, notes: notesValue }) })
      const payload = await response.json() as { dossier?: IpDossier }
      if (!response.ok || !payload.dossier) throw new Error()
      const dossier = payload.dossier
      onChange((current) => current.map((item) => (item.id === dossier.id ? dossier : item)))
      setNotesDraft(null)
      setNotesState('saved')
    } catch {
      setNotesState('error')
    }
  }

  async function remove(dossier: IpDossier) {
    if (!window.confirm(`Delete the saved dossier for ${dossier.ip}? This cannot be undone.`)) return
    const response = await fetch(`/api/ip-dossiers?id=${encodeURIComponent(dossier.id)}`, { method: 'DELETE' })
    if (!response.ok) {
      setError('The dossier could not be deleted.')
      return
    }
    onChange((current) => current.filter((item) => item.id !== dossier.id))
    onSelect(null)
  }

  return (
    <section className="dossier-desk" aria-labelledby="dossier-title">
      <div className="workspace-section-heading">
        <div><span className="workspace-micro-label">IP INTELLIGENCE / SAVED BY ADDRESS</span><h2 id="dossier-title">IP dossiers</h2></div>
        <span className="history-count">{String(dossiers.length).padStart(2, '0')}</span>
      </div>
      <p className="workspace-section-copy">Each public IP keeps one dossier: network owner, ASN, reverse DNS, registered area, observation history, and your notes. Re-running a lookup adds to its history.</p>

      <form className="dossier-form" onSubmit={lookup}>
        <label htmlFor="dossier-ip" className="sr-only">Public IP address</label>
        <div className="workspace-input"><Network aria-hidden="true" /><input id="dossier-ip" value={ipInput} onChange={(event) => setIpInput(event.target.value)} placeholder="8.8.8.8 or 2001:4860:4860::8888" autoComplete="off" spellCheck={false} maxLength={45} required /><span>IP</span></div>
        <button className="workspace-submit" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin-icon" aria-hidden="true" /> : <Search aria-hidden="true" />}{busy ? 'QUERYING REGISTRY' : 'LOOK UP AND SAVE'}</button>
      </form>
      {error && <p className="workspace-error" role="alert"><CircleAlert aria-hidden="true" />{error}</p>}

      <div className="dossier-layout">
        <ul className="dossier-list" aria-label="Saved IP dossiers">
          {dossiers.length ? dossiers.map((dossier) => (
            <li key={dossier.id}>
              <button type="button" className={dossier.id === selectedId ? 'is-current' : ''} aria-pressed={dossier.id === selectedId} onClick={() => { onSelect(dossier.id); setNotesState('idle') }}>
                <strong>{dossier.ip}</strong>
                <small>{[dossier.report.location.city, dossier.report.location.country].filter(Boolean).join(', ') || 'Unknown area'} · {dossier.report.connection.org ?? 'Unknown org'}</small>
              </button>
            </li>
          )) : <li className="dossier-empty"><Globe2 aria-hidden="true" /><p>No IP dossiers yet. Look up a public IP to start one.</p></li>}
        </ul>

        {selected ? (
          <article className="dossier-detail" aria-label={`Dossier for ${selected.ip}`}>
            <header>
              <div><span className="workspace-micro-label">DOSSIER</span><h3>{selected.ip}</h3></div>
              <div className="dossier-detail-tools">
                <button type="button" onClick={() => onShowOnRadar(selected)} disabled={selected.report.location.latitude === null}><Crosshair aria-hidden="true" /> RADAR</button>
                <button type="button" onClick={() => remove(selected)} aria-label={`Delete dossier for ${selected.ip}`}><Trash2 aria-hidden="true" /></button>
              </div>
            </header>
            <DossierFacts dossier={selected} />
            {selected.report.history.length > 1 && (
              <details className="dossier-history">
                <summary>Observation history ({selected.report.history.length})</summary>
                <ol>{selected.report.history.map((entry) => <li key={entry.observedAt}><time>{new Date(entry.observedAt).toLocaleString()}</time><span>{[entry.city, entry.country].filter(Boolean).join(', ') || 'Unknown'} · {entry.org ?? 'Unknown org'}</span></li>)}</ol>
              </details>
            )}
            <label className="dossier-notes-label" htmlFor="dossier-notes">ANALYST NOTES</label>
            <textarea id="dossier-notes" className="dossier-notes" value={notesValue} maxLength={4000} onChange={(event) => { setNotesDraft({ id: selected.id, value: event.target.value }); setNotesState('idle') }} placeholder="Case context, linked domains, next steps…" />
            <div className="dossier-notes-row">
              <button type="button" className="dossier-action" onClick={saveNotes} disabled={notesState === 'saving' || notesValue === selected.notes}><Save aria-hidden="true" /> {notesState === 'saving' ? 'SAVING' : 'SAVE NOTES'}</button>
              <span role="status">{notesState === 'saved' ? 'Notes saved to this dossier.' : notesState === 'error' ? 'Notes could not be saved.' : ''}</span>
            </div>
            <DossierActions dossier={selected} />
            <p className="workspace-disclaimer"><Download aria-hidden="true" /> {selected.report.accuracyNote}</p>
          </article>
        ) : (
          <div className="workspace-awaiting"><span><Network aria-hidden="true" /></span><div><strong>Select a dossier</strong><p>Open a saved IP to review, annotate, export, or email it.</p></div></div>
        )}
      </div>
    </section>
  )
}
