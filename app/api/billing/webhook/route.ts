import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getStripe, isPaidPlan } from '@/lib/billing'

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!signature || !secret) return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 400 })
  let event: Stripe.Event
  try { event = getStripe().webhooks.constructEvent(await request.text(), signature, secret) } catch { return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 }) }

  if (event.type === 'checkout.session.completed') {
    const checkout = event.data.object as Stripe.Checkout.Session
    const userId = checkout.metadata?.userId || checkout.client_reference_id
    const plan = checkout.metadata?.plan
    if (userId && plan && isPaidPlan(plan)) await db.update(user).set({ tier: plan, stripeCustomerId: typeof checkout.customer === 'string' ? checkout.customer : null, stripeSubscriptionId: typeof checkout.subscription === 'string' ? checkout.subscription : null, stripeSubscriptionStatus: 'active', updatedAt: new Date() }).where(eq(user.id, userId))
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.created') {
    const subscription = event.data.object as Stripe.Subscription
    const userId = subscription.metadata?.userId
    const plan = subscription.metadata?.plan
    if (userId && plan && isPaidPlan(plan)) await db.update(user).set({ tier: plan, stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : null, stripeSubscriptionId: subscription.id, stripeSubscriptionStatus: subscription.status, updatedAt: new Date() }).where(eq(user.id, userId))
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    await db.update(user).set({ tier: 'observer', stripeSubscriptionStatus: 'canceled', stripeSubscriptionId: null, updatedAt: new Date() }).where(eq(user.stripeSubscriptionId, subscription.id))
  }

  return NextResponse.json({ received: true })
}
