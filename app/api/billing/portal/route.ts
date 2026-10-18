import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAppUrl, getStripe } from '@/lib/billing'

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  const account = await db.select({ stripeCustomerId: user.stripeCustomerId }).from(user).where(eq(user.id, session.user.id)).limit(1)
  if (!account[0]?.stripeCustomerId) return NextResponse.json({ error: 'No paid subscription found.' }, { status: 400 })
  const portal = await getStripe().billingPortal.sessions.create({ customer: account[0].stripeCustomerId, return_url: `${getAppUrl()}/workspace` })
  return NextResponse.json({ url: portal.url })
}
