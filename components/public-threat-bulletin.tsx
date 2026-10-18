'use client'

import { useEffect, useState } from 'react'
import { ArrowUpRight, Radio, ShieldAlert } from 'lucide-react'

const bulletins = [
  { ip: '185.220.101.1', label: 'Tor exit relay', detail: 'Treat unexpected authentication traffic as a review signal.', source: 'Public relay directory / verify before blocking' },
  { ip: '45.155.205.110', label: 'Reported SSH brute-force activity', detail: 'Check your access logs, MFA coverage, and exposed SSH services.', source: 'Community abuse reports / context required' },
  { ip: '86.206.98.41', label: 'Unusual outbound beacon pattern', detail: 'Compare timestamps and process logs before taking action.', source: 'AUGI field report / not an identity claim' },
]

export function PublicThreatBulletin() {
  const [index, setIndex] = useState(0)
  const bulletin = bulletins[index]

  useEffect(() => {
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % bulletins.length), 7000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <aside className="public-bulletin" aria-label="Public defensive security bulletin">
      <div className="public-bulletin-top"><span className="public-bulletin-live"><Radio aria-hidden="true" /> PUBLIC DEFENSIVE BULLETIN</span><span>{String(index + 1).padStart(2, '0')} / {String(bulletins.length).padStart(2, '0')}</span></div>
      <div className="public-bulletin-body"><ShieldAlert aria-hidden="true" /><div><strong>{bulletin.ip}</strong><span>{bulletin.label}</span><p>{bulletin.detail}</p><small>{bulletin.source}</small></div><a href="/demo" aria-label={`Investigate ${bulletin.ip}`}><ArrowUpRight aria-hidden="true" /></a></div>
      <div className="public-bulletin-disclaimer">Signals are public, time-sensitive, and probabilistic. An IP address does not identify a person. Verify with your own logs before blocking.</div>
    </aside>
  )
}
