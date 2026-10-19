import { NextResponse } from 'next/server'

export const revalidate = 3600

const CISA_KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json'

type KevItem = { dateAdded?: string }

export async function GET() {
  try {
    const response = await fetch(CISA_KEV_URL, { next: { revalidate: 3600 } })
    if (!response.ok) throw new Error(`CISA feed returned ${response.status}`)

    const feed = (await response.json()) as { vulnerabilities?: KevItem[] }
    const vulnerabilities = feed.vulnerabilities ?? []
    const now = new Date()
    const points = Array.from({ length: 12 }, (_, index) => {
      const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + index, 1))
      const nextMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1))
      const count = vulnerabilities.filter((item) => {
        const date = item.dateAdded ? new Date(`${item.dateAdded}T00:00:00Z`) : null
        return date && date >= month && date < nextMonth
      }).length
      return { label: month.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }), count }
    })

    return NextResponse.json({
      source: 'CISA Known Exploited Vulnerabilities Catalog',
      sourceUrl: CISA_KEV_URL,
      updatedAt: new Date().toISOString(),
      points,
      totalInWindow: points.reduce((sum, point) => sum + point.count, 0),
    })
  } catch {
    return NextResponse.json({ error: 'The public CISA threat feed is temporarily unavailable.' }, { status: 503 })
  }
}
