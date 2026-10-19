import { isIP } from 'node:net'
import { NextResponse } from 'next/server'
import { isOwnerEmail } from '@/lib/plans'
import { createClient } from '@/lib/supabase/server'
import type { IpDossier, IpDossierReport } from '@/lib/ip-dossier'

export const runtime = 'nodejs'

const LOOKUP_TIMEOUT_MS = 5000
const HISTORY_LIMIT = 10
const NOTES_LIMIT = 4000

type IpWhoResponse = {
  success?: boolean
  message?: string
  type?: string
  continent?: string
  country?: string
  country_code?: string
  region?: string
  city?: string
  postal?: string
  latitude?: number
  longitude?: number
  calling_code?: string
  connection?: { asn?: number; org?: string; isp?: string; domain?: string }
  timezone?: { id?: string; abbr?: string; utc?: string }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

function isNonPublicIp(ip: string, version: number) {
  if (version === 4) {
    const [a, b] = ip.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
  }
  const lower = ip.toLowerCase()
  return lower === '::' || lower === '::1' || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower) || lower.startsWith('ff') || lower.startsWith('::ffff:')
}

function expandIpv6(ip: string) {
  const [head, tail = ''] = ip.split('::')
  const headParts = head ? head.split(':') : []
  const tailParts = tail ? tail.split(':') : []
  const missing = 8 - headParts.length - tailParts.length
  return [...headParts, ...Array(Math.max(0, missing)).fill('0'), ...tailParts].map((part) => part.padStart(4, '0')).join('')
}

function reverseName(ip: string, version: number) {
  if (version === 4) return `${ip.split('.').reverse().join('.')}.in-addr.arpa`
  return `${expandIpv6(ip).split('').reverse().join('.')}.ip6.arpa`
}

async function lookupReverseDns(ip: string, version: number) {
  try {
    const url = new URL('https://dns.google/resolve')
    url.searchParams.set('name', reverseName(ip, version))
    url.searchParams.set('type', 'PTR')
    const response = await fetch(url, { headers: { Accept: 'application/dns-json' }, signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS), cache: 'no-store' })
    if (!response.ok) return null
    const data = await response.json() as { Answer?: { type?: number; data?: unknown }[] }
    const names = (data.Answer ?? []).filter((answer) => answer.type === 12 && typeof answer.data === 'string').map((answer) => (answer.data as string).replace(/\.$/, '').slice(0, 253))
    return names.length ? names.slice(0, 4) : []
  } catch {
    return null
  }
}

const LOOKUP_HEADERS = { Accept: 'application/json', 'User-Agent': 'AUGI-IP-Dossier/1.0 (+https://augi.space)' }

async function lookupIpWho(ip: string): Promise<IpWhoResponse> {
  const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, { headers: LOOKUP_HEADERS, signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS), cache: 'no-store' })
  if (!response.ok) throw new Error(`ipwho.is returned HTTP ${response.status}`)
  const data = await response.json() as IpWhoResponse
  if (!data.success) throw new Error(data.message ?? 'ipwho.is has no record for this address.')
  return data
}

async function lookupGeoJs(ip: string): Promise<IpWhoResponse> {
  const response = await fetch(`https://get.geojs.io/v1/ip/geo/${encodeURIComponent(ip)}.json`, { headers: LOOKUP_HEADERS, signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS), cache: 'no-store' })
  if (!response.ok) throw new Error(`geojs returned HTTP ${response.status}`)
  const d = await response.json() as { country?: string; country_code?: string; region?: string; city?: string; latitude?: string | number; longitude?: string | number; timezone?: string; asn?: number; organization_name?: string; continent_code?: string }
  const lat = Number.parseFloat(String(d.latitude ?? ''))
  const lon = Number.parseFloat(String(d.longitude ?? ''))
  return {
    success: true,
    continent: d.continent_code,
    country: d.country,
    country_code: d.country_code,
    region: d.region,
    city: d.city,
    latitude: Number.isFinite(lat) ? lat : undefined,
    longitude: Number.isFinite(lon) ? lon : undefined,
    timezone: { id: d.timezone },
    connection: { asn: typeof d.asn === 'number' ? d.asn : undefined, org: d.organization_name, isp: d.organization_name },
  }
}

async function lookupNetwork(ip: string) {
  try {
    return await lookupIpWho(ip)
  } catch (primary) {
    console.error('IP lookup: ipwho.is failed', primary)
    try {
      return await lookupGeoJs(ip)
    } catch (secondary) {
      console.error('IP lookup: geojs failed', secondary)
      throw new Error('The public IP registry did not respond.')
    }
  }
}

function clean(value: unknown, max = 160) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null
}

async function requireOwner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isOwnerEmail(user.email ?? '')) return { supabase, user: null }
  return { supabase, user }
}

function toDossier(row: { id: string; ip: string; report: unknown; notes: string; lookup_count: number; created_at: string; updated_at: string }): IpDossier {
  return { id: row.id, ip: row.ip, report: row.report as IpDossierReport, notes: row.notes, lookupCount: row.lookup_count, createdAt: row.created_at, updatedAt: row.updated_at }
}

export async function POST(request: Request) {
  const { supabase, user } = await requireOwner()
  if (!user) return jsonError('Owner sign-in is required to save IP dossiers.', 401)

  let body: { ip?: unknown }
  try {
    body = await request.json()
  } catch {
    return jsonError('Enter a valid public IP address.', 400)
  }

  const ip = typeof body.ip === 'string' ? body.ip.trim().toLowerCase() : ''
  const version = isIP(ip)
  if (!version) return jsonError('Enter a valid IPv4 or IPv6 address.', 400)
  if (isNonPublicIp(ip, version)) return jsonError('Private, loopback, and reserved addresses have no public registry record.', 400)

  let network: IpWhoResponse
  try {
    network = await lookupNetwork(ip)
  } catch (caught) {
    return jsonError(caught instanceof Error ? caught.message : 'The public IP registry is unavailable.', 502)
  }
  const reverseDns = await lookupReverseDns(ip, version)

  const { data: existing, error: existingError } = await supabase
    .from('ip_dossiers')
    .select('id, report, lookup_count')
    .eq('user_id', user.id)
    .eq('ip', ip)
    .maybeSingle()
  if (existingError) return jsonError('Saved dossier data could not be loaded.', 500)

  const observedAt = new Date().toISOString()
  const latitude = typeof network.latitude === 'number' ? network.latitude : null
  const longitude = typeof network.longitude === 'number' ? network.longitude : null
  const location = {
    continent: clean(network.continent),
    country: clean(network.country),
    countryCode: clean(network.country_code, 4),
    region: clean(network.region),
    city: clean(network.city),
    postal: clean(network.postal, 20),
    latitude,
    longitude,
    timezone: clean(network.timezone?.id),
    utcOffset: clean(network.timezone?.utc, 10),
  }
  const connection = {
    asn: typeof network.connection?.asn === 'number' ? network.connection.asn : null,
    org: clean(network.connection?.org),
    isp: clean(network.connection?.isp),
    domain: clean(network.connection?.domain),
  }
  const previous = existing?.report as IpDossierReport | undefined
  const history = [
    { observedAt, city: location.city, country: location.country, org: connection.org, asn: connection.asn },
    ...(previous?.history ?? []),
  ].slice(0, HISTORY_LIMIT)

  const report: IpDossierReport = {
    ip,
    version: version === 4 ? 'IPv4' : 'IPv6',
    observedAt,
    location,
    connection,
    reverseDns,
    history,
    sources: ['ipwho.is public registry', 'dns.google reverse DNS'],
    accuracyNote: 'IP geolocation points to the registered network area, often a city or ISP hub. It does not identify a person, home address, or device location.',
  }

  const query = existing
    ? supabase.from('ip_dossiers').update({ report, latitude, longitude, lookup_count: existing.lookup_count + 1, updated_at: observedAt }).eq('id', existing.id).eq('user_id', user.id)
    : supabase.from('ip_dossiers').insert({ user_id: user.id, ip, report, latitude, longitude })
  const { data: saved, error: saveError } = await query.select('id, ip, report, notes, lookup_count, created_at, updated_at').single()
  if (saveError || !saved) return jsonError('The lookup completed, but the dossier could not be saved.', 500)

  return NextResponse.json({ dossier: toDossier(saved) }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function PATCH(request: Request) {
  const { supabase, user } = await requireOwner()
  if (!user) return jsonError('Owner sign-in is required.', 401)

  let body: { id?: unknown; notes?: unknown }
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid dossier update.', 400)
  }
  if (typeof body.id !== 'string' || typeof body.notes !== 'string') return jsonError('Invalid dossier update.', 400)

  const { data: saved, error } = await supabase
    .from('ip_dossiers')
    .update({ notes: body.notes.slice(0, NOTES_LIMIT), updated_at: new Date().toISOString() })
    .eq('id', body.id)
    .eq('user_id', user.id)
    .select('id, ip, report, notes, lookup_count, created_at, updated_at')
    .single()
  if (error || !saved) return jsonError('Notes could not be saved.', 500)

  return NextResponse.json({ dossier: toDossier(saved) }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function DELETE(request: Request) {
  const { supabase, user } = await requireOwner()
  if (!user) return jsonError('Owner sign-in is required.', 401)
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return jsonError('Dossier id is required.', 400)

  const { error } = await supabase.from('ip_dossiers').delete().eq('id', id).eq('user_id', user.id)
  if (error) return jsonError('The dossier could not be deleted.', 500)
  return NextResponse.json({ deleted: true }, { headers: { 'Cache-Control': 'private, no-store' } })
}
