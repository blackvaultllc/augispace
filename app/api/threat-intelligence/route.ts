import { isIP } from 'node:net'
import { NextResponse, type NextRequest } from 'next/server'
import { getIntegrationSecret, INTEGRATION_KEYS } from '@/lib/integration-secrets'
import { resolveRole } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

function isNonPublicIp(ip: string, version: number) {
  if (version === 4) {
    const [a, b, c] = ip.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113)
  }

  const lower = ip.toLowerCase()
  return lower === '::' || lower === '::1' ||
    /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower) ||
    lower.startsWith('ff') || lower.startsWith('::ffff:')
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (!user) {
    return reply({ error: 'Sign in is required.' }, 401)
  }

  const role = await resolveRole(user.id, user.email)
  if (!role.isAdmin) {
    return reply({
      error: 'This lookup is available to AUGI owner and staff accounts.',
    }, 403)
  }

  const ip = request.nextUrl.searchParams.get('ip')?.trim() ?? ''
  const version = isIP(ip)

  if (!version || isNonPublicIp(ip, version)) {
    return reply({ error: 'Enter a valid public IPv4 or IPv6 address.' }, 400)
  }

  // Priority: encrypted back-office storage, then the environment variable.
  const apiKey = (await getIntegrationSecret(INTEGRATION_KEYS.abuseipdb).catch(() => null))
    ?? process.env.ABUSEIPDB_API_KEY
    ?? null
  if (!apiKey) {
    return reply({ error: 'AbuseIPDB is not configured. Add the key in the admin integrations panel.' }, 503)
  }

  try {
    const url = new URL('https://api.abuseipdb.com/api/v2/check')
    url.searchParams.set('ipAddress', ip)
    url.searchParams.set('maxAgeInDays', '90')
    url.searchParams.set('verbose', 'true')

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Key: apiKey,
      },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })

    if (!response.ok) {
      return reply({
        error: response.status === 429
          ? 'AbuseIPDB rate limit reached. Try again later.'
          : 'AbuseIPDB could not complete this lookup.',
      }, response.status === 429 ? 429 : 502)
    }

    const result = await response.json() as {
      data?: {
        ipAddress?: string
        isPublic?: boolean
        ipVersion?: number
        isWhitelisted?: boolean | null
        abuseConfidenceScore?: number
        countryCode?: string | null
        usageType?: string | null
        isp?: string | null
        domain?: string | null
        totalReports?: number
        numDistinctUsers?: number
        lastReportedAt?: string | null
      }
    }

    const data = result.data
    if (!data) return reply({ error: 'AbuseIPDB returned no reputation data.' }, 502)

    return reply({
      source: 'AbuseIPDB',
      sourceUrl: 'https://www.abuseipdb.com/',
      retrievedAt: new Date().toISOString(),
      data: {
        ipAddress: data.ipAddress ?? ip,
        isPublic: data.isPublic ?? null,
        ipVersion: data.ipVersion ?? version,
        isWhitelisted: data.isWhitelisted ?? null,
        abuseConfidenceScore: data.abuseConfidenceScore ?? null,
        countryCode: data.countryCode ?? null,
        usageType: data.usageType ?? null,
        isp: data.isp ?? null,
        domain: data.domain ?? null,
        totalReports: data.totalReports ?? 0,
        numDistinctUsers: data.numDistinctUsers ?? 0,
        lastReportedAt: data.lastReportedAt ?? null,
      },
      interpretation:
        'Abuse confidence and reports reflect AbuseIPDB submissions during its reporting window. They do not prove that this IP is attacking you now or identify the person using it.',
    })
  } catch {
    return reply({ error: 'The AbuseIPDB lookup timed out or is temporarily unavailable.' }, 502)
  }
}
