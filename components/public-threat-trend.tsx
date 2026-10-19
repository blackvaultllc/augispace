'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, ExternalLink, LoaderCircle } from 'lucide-react'

type Point = { label: string; count: number }
type Trend = { source: string; sourceUrl: string; updatedAt: string; points: Point[]; totalInWindow: number }

function makePath(points: Point[], width: number, height: number) {
  const max = Math.max(...points.map((point) => point.count), 1)
  return points.map((point, index) => {
    const x = (index / Math.max(points.length - 1, 1)) * width
    const y = height - (point.count / max) * (height - 18) - 9
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
}

export function PublicThreatTrend() {
  const [trend, setTrend] = useState<Trend | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/public-threat-trend')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('feed unavailable')))
      .then(setTrend)
      .catch(() => setError(true))
  }, [])

  const path = useMemo(() => trend ? makePath(trend.points, 760, 260) : '', [trend])
  const area = trend ? `${path} L 760 260 L 0 260 Z` : ''
  const change = trend && trend.points.length > 1 && trend.points[0].count > 0
    ? ((((trend.points.at(-1)?.count ?? 0) - trend.points[0].count) / trend.points[0].count) * 100).toFixed(1)
    : null

  return <div className="posture-chart" aria-label="Monthly additions to the CISA Known Exploited Vulnerabilities Catalog over the last twelve months">
    <div className="chart-toolbar"><span><Activity aria-hidden="true" /> CISA KEV ADDITIONS</span>{trend ? <strong>{change ? `${Number(change) >= 0 ? '+' : ''}${change}%` : `${trend.totalInWindow} total`}</strong> : <LoaderCircle className="spin-icon" aria-label="Loading" />}<small>12M / VERIFIED FEED</small></div>
    <div className="chart-plot">
      <span className="chart-axis-label chart-axis-top">{trend ? Math.max(...trend.points.map((point) => point.count)) : '—'}</span><span className="chart-axis-label chart-axis-mid">{trend ? Math.round(Math.max(...trend.points.map((point) => point.count)) / 2) : '—'}</span><span className="chart-axis-label chart-axis-bottom">0</span>
      {trend && <svg viewBox="0 0 760 260" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="liveSignalFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--cyan)" stopOpacity=".26" /><stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" /></linearGradient></defs><path className="chart-area" fill="url(#liveSignalFill)" d={area} /><path className="chart-line" d={path} /><circle className="chart-point" cx="760" cy={260 - ((trend.points.at(-1)?.count ?? 0) / Math.max(...trend.points.map((point) => point.count), 1)) * 242 - 9} r="5" /></svg>}
    </div>
    <div className="chart-footer">{trend ? trend.points.map((point) => <span key={point.label}>{point.label}</span>) : <span>LOADING PUBLIC DATA</span>}<span className="chart-source">{error ? 'FEED UNAVAILABLE' : <><a href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog" target="_blank" rel="noreferrer">CISA KEV CATALOG <ExternalLink aria-hidden="true" /></a></>}</span></div>
  </div>
}
