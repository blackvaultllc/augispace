import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { db } from '@/lib/db'
import { processedWebhookEvents, user } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { getStripe, isPaidPlan, type PaidPlan } from '@/lib/billing'

/**
 * Resolve which application user a Stripe event concerns.
 *
 * Resolution order (most to least reliable):
 *  1. user with the matching subscription id
 *  2. user with the matching Stripe customer id
 *  3. metadata userId (set explicitly by our own checkout route; a last resort
 *     because Stripe does not reliably copy checkout metadata to the
 *     subscription object)
 *
 * Returns null when nothing matches; the event is then ignored rather than
 * guessing and mutating the wrong account.
 */
async function resolveUserId(opts: {
  subscriptionId: string | null
  customerId: string | null
  metadataUserId: string | null
}) {
  if (opts.subscriptionId) {
    const bySub = await db.select({ id: user.id }).from(user).where(eq(user.stripeSubscriptionId, opts.subscriptionId)).limit(1)
    if (bySub[0]) return bySub[0].id
  }
  if (opts.customerId) {
    const byCustomer = await db.select({ id: user.id }).from(user).where(eq(user.stripeCustomerId, opts.customerId)).limit(1)
    if (byCustomer[0]) return byCustomer[0].id
  }
  return opts.metadataUserId
}

/**
 * Mark this Stripe event as processed and report whether it was already seen.
 * Returns false for a duplicate delivery so state changes are not re-applied.
 */
async function claimEvent(eventId: string, type: string): Promise<boolean> {
  const inserted = await db
    .insert(processedWebhookEvents)
    .values({ id: eventId, type })
    .onConflictDoNothing({ target: processedWebhookEvents.id })
    .returning({ id: processedWebhookEvents.id })
  return inserted.length > 0
}

async function applyTier(opts: {
  userId: string
  tier: PaidPlan
  customerId: string | null
  subscriptionId: string | null
  status: string
}) {
  await db
    .update(user)
    .set({
      tier: opts.tier,
      stripeCustomerId: opts.customerId,
      stripeSubscriptionId: opts.subscriptionId,
      stripeSubscriptionStatus: opts.status,
      updatedAt: new Date(),
    })
    .where(eq(user.id, opts.userId))
}

async function findUserIdByCustomer(customerId: string | null) {
  if (!customerId) return null
  const rows = await db.select({ id: user.id }).from(user).where(eq(user.stripeCustomerId, customerId)).limit(1)
  return rows[0]?.id ?? null
}

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!signature || !secret) return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 400 })
  let event: Stripe.Event
  try { event = getStripe().webhooks.constructEvent(await request.text(), signature, secret) } catch { return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 }) }

  // Idempotency: Stripe retries deliveries; replays must not re-apply changes.
  // Fail closed if the idempotency log is unreachable: skip application and
  // let Stripe retry rather than risk duplicate state changes.
  let firstDelivery: boolean
  try {
    firstDelivery = await claimEvent(event.id, event.type)
  } catch (error) {
    console.error('[billing] event claim failed; skipping application', event.id, String(error).replace(/\S+:\/\/\S+/g, '<redacted>'))
    return NextResponse.json({ error: 'Event log unavailable.' }, { status: 503 })
  }
  if (!firstDelivery) return NextResponse.json({ received: true, duplicate: true })

  if (event.type === 'checkout.session.completed') {
    const checkout = event.data.object as Stripe.Checkout.Session
    const userId = checkout.metadata?.userId || checkout.client_reference_id || null
    const plan = checkout.metadata?.plan
    if (userId && plan && isPaidPlan(plan)) {
      await applyTier({
        userId,
        tier: plan,
        customerId: typeof checkout.customer === 'string' ? checkout.customer : null,
        subscriptionId: typeof checkout.subscription === 'string' ? checkout.subscription : null,
        status: 'active',
      })
    }
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.created') {
    const subscription = event.data.object as Stripe.Subscription
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : null
    const userId = await resolveUserId({
      subscriptionId: subscription.id,
      customerId,
      metadataUserId: subscription.metadata?.userId ?? null,
    })
    const plan = subscription.metadata?.plan
    if (userId && plan && isPaidPlan(plan)) {
      await applyTier({ userId, tier: plan, customerId, subscriptionId: subscription.id, status: subscription.status })
    } else if (userId) {
      // Subscription without our plan metadata (e.g. created outside the
      // checkout flow): record status; only downgrade when it ends.
      if (subscription.status !== 'active' && subscription.status !== 'trialing') {
        await db.update(user).set({ stripeSubscriptionStatus: subscription.status, updatedAt: new Date() }).where(eq(user.id, userId))
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    const userId = await resolveUserId({
      subscriptionId: subscription.id,
      customerId: typeof subscription.customer === 'string' ? subscription.customer : null,
      metadataUserId: subscription.metadata?.userId ?? null,
    })
    if (userId) {
      await db.update(user).set({ tier: 'observer', stripeSubscriptionStatus: 'canceled', stripeSubscriptionId: null, updatedAt: new Date() }).where(eq(user.id, userId))
    }
  }

  // Payment failure: keep entitlement during Stripe's retry window but reflect
  // the status so the UI can warn the customer.
  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice
    const userId = await findUserIdByCustomer(typeof invoice.customer === 'string' ? invoice.customer : null)
    if (userId) {
      await db.update(user).set({ stripeSubscriptionStatus: 'past_due', updatedAt: new Date() }).where(eq(user.id, userId))
    }
  }

  // Dispute opened: mark the account (conservative, visible in the workspace).
  if (event.type === 'charge.dispute.created') {
    const dispute = event.data.object as Stripe.Dispute
    const userId = await findUserIdByCustomer(typeof dispute.charge === 'object' && dispute.charge ? (typeof dispute.charge.customer === 'string' ? dispute.charge.customer : null) : null)
    if (userId) {
      await db.update(user).set({ stripeSubscriptionStatus: 'disputed', updatedAt: new Date() }).where(eq(user.id, userId))
    }
  }

  // Dispute closed in our favor: clear the marker only; lifecycle events
  // reconcile tier and status afterwards.
  if (event.type === 'charge.dispute.closed') {
    const dispute = event.data.object as Stripe.Dispute
    if (dispute.status === 'won' || dispute.status === 'warning_closed') {
      const userId = await findUserIdByCustomer(typeof dispute.charge === 'object' && dispute.charge ? (typeof dispute.charge.customer === 'string' ? dispute.charge.customer : null) : null)
      if (userId) {
        await db.update(user).set({ stripeSubscriptionStatus: 'active', updatedAt: new Date() }).where(and(eq(user.id, userId), eq(user.stripeSubscriptionStatus, 'disputed')))
      }
    }
  }

  return NextResponse.json({ received: true })
}
