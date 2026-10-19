export type IpDossierReport = {
  ip: string
  version: 'IPv4' | 'IPv6'
  observedAt: string
  location: {
    continent: string | null
    country: string | null
    countryCode: string | null
    region: string | null
    city: string | null
    postal: string | null
    latitude: number | null
    longitude: number | null
    timezone: string | null
    utcOffset: string | null
  }
  connection: { asn: number | null; org: string | null; isp: string | null; domain: string | null }
  reverseDns: string[] | null
  history: { observedAt: string; city: string | null; country: string | null; org: string | null; asn: number | null }[]
  sources: string[]
  accuracyNote: string
}

export type IpDossier = {
  id: string
  ip: string
  report: IpDossierReport
  notes: string
  lookupCount: number
  createdAt: string
  updatedAt: string
}

const MAILTO_BODY_LIMIT = 1800

export function formatDossierText(dossier: IpDossier) {
  const { report } = dossier
  const place = [report.location.city, report.location.region, report.location.country].filter(Boolean).join(', ') || 'Unknown'
  const lines = [
    `AGAMOSS IP DOSSIER — ${report.ip} (${report.version})`,
    `Last observed: ${new Date(report.observedAt).toUTCString()}`,
    `Lookups saved: ${dossier.lookupCount}`,
    '',
    'NETWORK',
    `  ASN: ${report.connection.asn ?? 'Unknown'}`,
    `  Organization: ${report.connection.org ?? 'Unknown'}`,
    `  ISP: ${report.connection.isp ?? 'Unknown'}`,
    `  Network domain: ${report.connection.domain ?? 'Unknown'}`,
    `  Reverse DNS: ${report.reverseDns === null ? 'Lookup unavailable' : report.reverseDns.length ? report.reverseDns.join(', ') : 'No PTR record'}`,
    '',
    'REGISTERED NETWORK AREA',
    `  Area: ${place}`,
    `  Postal: ${report.location.postal ?? 'Unknown'}`,
    `  Approx. coordinates: ${report.location.latitude ?? '?'}, ${report.location.longitude ?? '?'}`,
    `  Time zone: ${report.location.timezone ?? 'Unknown'} ${report.location.utcOffset ?? ''}`.trimEnd(),
    '',
    'OBSERVATION HISTORY',
    ...report.history.map((entry) => `  ${new Date(entry.observedAt).toUTCString()} — ${[entry.city, entry.country].filter(Boolean).join(', ') || 'Unknown'} — ${entry.org ?? 'Unknown org'}`),
    '',
    'ANALYST NOTES',
    `  ${dossier.notes.trim() || 'None'}`,
    '',
    `Sources: ${report.sources.join('; ')}`,
    report.accuracyNote,
  ]
  return lines.join('\n')
}

export function dossierMailto(dossier: IpDossier) {
  const text = formatDossierText(dossier)
  const body = text.length > MAILTO_BODY_LIMIT ? `${text.slice(0, MAILTO_BODY_LIMIT)}\n\n[Truncated — attach the exported file for the full dossier.]` : text
  return `mailto:?subject=${encodeURIComponent(`AGAMOSS IP dossier: ${dossier.ip}`)}&body=${encodeURIComponent(body)}`
}

export function downloadDossier(dossier: IpDossier, format: 'json' | 'txt') {
  const content = format === 'json' ? JSON.stringify(dossier, null, 2) : formatDossierText(dossier)
  const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/plain' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `agamoss-dossier-${dossier.ip.replace(/[^a-z0-9]/gi, '-')}.${format}`
  link.click()
  URL.revokeObjectURL(url)
}
