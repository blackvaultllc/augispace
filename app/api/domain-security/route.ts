import { generateText } from 'ai'
import { domainToASCII } from 'node:url'
import { NextResponse } from 'next/server'
import { AI_MODELS, ensureAiCredentials } from '@/lib/ai'
import { getUtcMonthStart, isOwnerEmail } from '@/lib/plans'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const EMAIL_DOMAIN_LIMIT = 253
const DNS_TIMEOUT_MS = 4000

type DnsAnswer = {
  data?: unknown
  type?: number
}

type DnsResponse = {
  Answer?: DnsAnswer[]
  Status?: number
}

type PublicLocation = { ip: string; city: string | null; region: string | null; country: string | null; latitude: number; longitude: number; source: string }

async function resolvePublicLocations(mxRecords: string[]) {
  const hosts = mxRecords.map((record) => record.replace(/^\d+\s+/, '').replace(/\.$/, '')).slice(0, 4)
  const answers = await Promise.allSettled(hosts.map((host) => queryDns(host, 'A')))
  const ips = [...new Set(answers.flatMap((answer) => answer.status === 'fulfilled' ? answersFor(answer.value, 1) : []))].filter((ip) => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)).slice(0, 4)
  const locations = await Promise.allSettled(ips.map(async (ip) => {
    const response = await fetch(`https://ipwho.is/${ip}`, { signal: AbortSignal.timeout(DNS_TIMEOUT_MS), next: { revalidate: 3600 } })
    if (!response.ok) throw new Error('IP location unavailable')
    const data = await response.json() as { success?: boolean; city?: string; region?: string; country?: string; latitude?: number; longitude?: number }
    if (!data.success || typeof data.latitude !== 'number' || typeof data.longitude !== 'number') throw new Error('IP location unavailable')
    return { ip, city: data.city ?? null, region: data.region ?? null, country: data.country ?? null, latitude: data.latitude, longitude: data.longitude, source: 'ipwho.is' }
  }))
  return locations.flatMap((location) => location.status === 'fulfilled' ? [location.value] : [])
}

type Check = {
  label: string
  status: 'present' | 'missing' | 'monitoring' | 'unavailable'
  detail: string
}

function normalizeDomain(value: unknown) {
  if (typeof value !== 'string' || value.length > EMAIL_DOMAIN_LIMIT) return null

  const ascii = domainToASCII(value.trim().replace(/\.$/, '').toLowerCase())
  if (!ascii || ascii.length > EMAIL_DOMAIN_LIMIT || !ascii.includes('.')) return null

  const labels = ascii.split('.')
  if (labels.some((label) => !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) return null
  if (!/^[a-z0-9-]+$/.test(labels.at(-1) ?? '') || (labels.at(-1)?.length ?? 0) < 2) return null

  return ascii
}

async function queryDns(name: string, type: 'A' | 'MX' | 'TXT') {
  const url = new URL('https://dns.google/resolve')
  url.searchParams.set('name', name)
  url.searchParams.set('type', type)
  const response = await fetch(url, {
    headers: { Accept: 'application/dns-json' },
    signal: AbortSignal.timeout(DNS_TIMEOUT_MS),
    next: { revalidate: 900 },
  })
  if (!response.ok) throw new Error('DNS lookup unavailable')
  return await response.json() as DnsResponse
}

function answersFor(data: DnsResponse | null, type: number) {
  return (data?.Answer ?? [])
    .filter((answer) => answer.type === type && typeof answer.data === 'string')
    .map((answer) => (answer.data as string).replace(/^"|"$/g, '').replace(/\\"/g, '"').trim())
}

function jsonError(message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('A valid domain is required.', 400)
  }

  const domain = normalizeDomain((body as { domain?: unknown } | null)?.domain)
  if (!domain) return jsonError('Enter a valid public email domain.', 400)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isOwner = !!user && isOwnerEmail(user.email ?? '')
  const userId = isOwner ? user.id : null
  let used = 0
  const limit: number | null = null

  if (userId) {
    const { count: usageCount, error: usageError } = await supabase
      .from('investigations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', getUtcMonthStart().toISOString())

    if (usageError) return jsonError('Saved investigation usage could not be loaded.', 500)
    used = usageCount ?? 0
  }

  const [mxResult, txtResult, dmarcResult] = await Promise.allSettled([
    queryDns(domain, 'MX'),
    queryDns(domain, 'TXT'),
    queryDns(`_dmarc.${domain}`, 'TXT'),
  ])

  const available = [mxResult, txtResult, dmarcResult].filter((result) => result.status === 'fulfilled').length
  if (available === 0) return jsonError('Public DNS lookup is temporarily unavailable.', 502)

  const mxAnswers = mxResult.status === 'fulfilled' ? answersFor(mxResult.value, 15).slice(0, 8) : []
  const txtAnswers = txtResult.status === 'fulfilled' ? answersFor(txtResult.value, 16) : []
  const dmarcAnswers = dmarcResult.status === 'fulfilled' ? answersFor(dmarcResult.value, 16) : []
  const spfRecord = txtAnswers.find((answer) => answer.toLowerCase().startsWith('v=spf1')) ?? null
  const dmarcRecord = dmarcAnswers.find((answer) => answer.toLowerCase().startsWith('v=dmarc1')) ?? null
  const policy = dmarcRecord?.match(/(?:^|;)\s*p\s*=\s*(none|quarantine|reject)/i)?.[1]?.toLowerCase() ?? null
  const mxAvailable = mxResult.status === 'fulfilled'
  const txtAvailable = txtResult.status === 'fulfilled'
  const dmarcAvailable = dmarcResult.status === 'fulfilled'
  const checks: Check[] = [
    {
      label: 'Mail routing (MX)',
      status: !mxAvailable ? 'unavailable' : mxAnswers.length ? 'present' : 'missing',
      detail: !mxAvailable ? 'The public MX query did not return a response.' : mxAnswers.length ? `${mxAnswers.length} public mail exchanger${mxAnswers.length === 1 ? '' : 's'} found.` : 'No public MX records were returned.',
    },
    {
      label: 'Sender policy (SPF)',
      status: !txtAvailable ? 'unavailable' : spfRecord ? 'present' : 'missing',
      detail: !txtAvailable ? 'The public TXT query did not return a response.' : spfRecord ? 'An SPF policy is published in the domain TXT records.' : 'No SPF policy was found in the domain TXT records.',
    },
    {
      label: 'Abuse reporting policy (DMARC)',
      status: !dmarcAvailable ? 'unavailable' : !dmarcRecord || !policy ? 'missing' : policy === 'none' ? 'monitoring' : 'present',
      detail: !dmarcAvailable ? 'The public DMARC query did not return a response.' : !dmarcRecord ? 'No DMARC policy was found at the standard DNS location.' : !policy ? 'A DMARC record was found, but it does not declare a recognizable policy.' : policy === 'none' ? 'A monitoring policy is published; it does not request quarantine or rejection.' : `A ${policy} policy is present at the standard DNS location.`,
    },
  ]

  let score = 100
  if (mxAvailable && !mxAnswers.length) score -= 30
  if (txtAvailable && !spfRecord) score -= 30
  if (dmarcAvailable && (!dmarcRecord || !policy)) score -= 30
  if (dmarcRecord && policy === 'none') score -= 20
  if (!mxAvailable || !txtAvailable || !dmarcAvailable) score = Math.min(score, 75)
  score = Math.max(0, score)

  const summary = score >= 85
    ? 'A solid baseline is visible in the DNS signals checked.'
    : score >= 55
      ? 'Some protective signals are present; review the gaps below.'
      : 'Several baseline signals need attention in the public DNS configuration.'
  const checkedAt = new Date().toISOString()
  const evidenceAllowed = !!userId
  const evidence = evidenceAllowed
    ? { mx: mxAnswers.map((answer) => answer.slice(0, 240)), spf: spfRecord?.slice(0, 240) ?? null, dmarc: dmarcRecord?.slice(0, 240) ?? null }
    : null

  let aiExplanation: string | null = null
  if (userId) {
    const credentialsReady = await ensureAiCredentials()
    try {
      if (!credentialsReady) throw new Error('AI credentials are not configured.')
      const result = await generateText({
        model: AI_MODELS.domainAnalyst,
        system: 'You are AUGI, a defensive email-domain security analyst. Explain only the public DNS evidence supplied. Never infer a person’s identity, intent, reputation, or compromise. Do not make unsupported claims. Give one short paragraph explaining the signals and two concise, prioritized actions for the domain owner. State uncertainty clearly and remain neutral.',
        prompt: JSON.stringify({ domain, score, summary, checks, evidence }),
        maxOutputTokens: 420,
        abortSignal: AbortSignal.timeout(12_000),
      })
      aiExplanation = result.text.trim().slice(0, 2400) || null
    } catch {
      aiExplanation = 'The evidence-based AI explanation is temporarily unavailable. The DNS findings above remain available for review.'
    }
  }

  const locations = mxAnswers.length ? await resolvePublicLocations(mxAnswers) : []
  const report = { domain, score, summary, checkedAt, checks, evidence, aiExplanation, locations }
  let savedInvestigation: { id: string; domain: string; score: number; createdAt: string; report: typeof report } | null = null

  if (userId) {
    const { data: saved, error: saveError } = await supabase
      .from('investigations')
      .insert({ user_id: userId, domain, score, report })
      .select('id, created_at')
      .single()

    if (saveError || !saved) return jsonError('The investigation was completed, but could not be saved.', 500)
    used += 1
    savedInvestigation = { id: saved.id, domain, score, createdAt: saved.created_at, report }
  }

  return NextResponse.json({
    ...report,
    result: report,
    saved: !!userId,
    tier: userId ? 'owner' : 'public',
    investigation: savedInvestigation,
    usage: userId ? { used, limit, remaining: limit === null ? null : Math.max(0, limit - used) } : null,
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}
