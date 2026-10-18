import { domainToASCII } from 'node:url'
import { NextResponse } from 'next/server'

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

function normalizeDomain(value: unknown) {
  if (typeof value !== 'string' || value.length > EMAIL_DOMAIN_LIMIT) return null

  const ascii = domainToASCII(value.trim().replace(/\.$/, '').toLowerCase())
  if (!ascii || ascii.length > EMAIL_DOMAIN_LIMIT || !ascii.includes('.')) return null

  const labels = ascii.split('.')
  if (labels.some((label) => !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) return null
  if (!/^[a-z0-9-]+$/.test(labels.at(-1) ?? '') || (labels.at(-1)?.length ?? 0) < 2) return null

  return ascii
}

async function queryDns(name: string, type: 'MX' | 'TXT') {
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

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'A valid domain is required.' }, { status: 400 })
  }

  const domain = normalizeDomain((body as { domain?: unknown } | null)?.domain)
  if (!domain) return NextResponse.json({ error: 'Enter a valid public email domain.' }, { status: 400 })

  const [mxResult, txtResult, dmarcResult] = await Promise.allSettled([
    queryDns(domain, 'MX'),
    queryDns(domain, 'TXT'),
    queryDns(`_dmarc.${domain}`, 'TXT'),
  ])

  const available = [mxResult, txtResult, dmarcResult].filter((result) => result.status === 'fulfilled').length
  if (available === 0) {
    return NextResponse.json({ error: 'Public DNS lookup is temporarily unavailable.' }, { status: 502 })
  }

  const mxAnswers = mxResult.status === 'fulfilled' ? answersFor(mxResult.value, 15).slice(0, 8) : []
  const txtAnswers = txtResult.status === 'fulfilled' ? answersFor(txtResult.value, 16) : []
  const dmarcAnswers = dmarcResult.status === 'fulfilled' ? answersFor(dmarcResult.value, 16) : []
  const spfRecord = txtAnswers.find((answer) => answer.toLowerCase().startsWith('v=spf1')) ?? null
  const dmarcRecord = dmarcAnswers.find((answer) => answer.toLowerCase().startsWith('v=dmarc1')) ?? null
  const policy = dmarcRecord?.match(/(?:^|;)\s*p\s*=\s*(none|quarantine|reject)/i)?.[1]?.toLowerCase() ?? null
  const mxAvailable = mxResult.status === 'fulfilled'
  const txtAvailable = txtResult.status === 'fulfilled'
  const dmarcAvailable = dmarcResult.status === 'fulfilled'
  const checks = [
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
  ] as const

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

  return NextResponse.json({
    domain,
    score,
    summary,
    checkedAt: new Date().toISOString(),
    checks,
    evidence: {
      mx: mxAnswers.map((answer) => answer.slice(0, 240)),
      spf: spfRecord?.slice(0, 240) ?? null,
      dmarc: dmarcRecord?.slice(0, 240) ?? null,
    },
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}
