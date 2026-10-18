import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAppUrl, getStripe, isPaidPlan, paidPlans } from '@/lib/billing'

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as { plan?: string }
  if (!body.plan || !isPaidPlan(body.plan)) return NextResponse.json({ error: 'That plan is not available.' }, { status: 400 })
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'Billing is not configured yet.' }, { status: 503 })

  const current = await db.select({ stripeCustomerId: user.stripeCustomerId, tier: user.tier }).from(user).where(eq(user.id, session.user.id)).limit(1)
  const account = current[0]
  const plan = paidPlans[body.plan]
  const customer = account?.stripeCustomerId ? { customer: account.stripeCustomerId } : { customer_email: session.user.email }
  const checkout = await getStripe().checkout.sessions.create({
    ...customer,
    mode: 'subscription',
    ui_mode: 'hosted_page',
    line_items: [{ price_data: { currency: 'usd', product_data: { name: plan.name, description: plan.description }, recurring: { interval: 'month' }, unit_amount: plan.amount }, quantity: 1 }],
    client_reference_id: session.user.id,
    metadata: { userId: session.user.id, plan: body.plan },
    subscription_data: { metadata: { userId: session.user.id, plan: body.plan } },
    success_url: `${getAppUrl()}/workspace?billing=success`,
    cancel_url: `${getAppUrl()}/workspace?billing=cancelled`,
  })
  return NextResponse.json({ url: checkout.url })
}
