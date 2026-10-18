import Stripe from 'stripe'

export function getStripe() {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) throw new Error('Stripe is not configured')
  return new Stripe(secret)
}

export const paidPlans = {
  analyst: { name: 'AUGI Analyst', amount: 2900, description: '30 monthly domain investigations with raw DNS evidence.' },
  command: { name: 'AUGI Command', amount: 9900, description: '150 monthly investigations with evidence-led AUGI explanations.' },
} as const

export type PaidPlan = keyof typeof paidPlans

export function isPaidPlan(value: string): value is PaidPlan {
  return Object.hasOwn(paidPlans, value)
}

export function getAppUrl() {
  const host = process.env.BETTER_AUTH_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || process.env.V0_RUNTIME_URL || 'http://localhost:3000'
  return host.startsWith('http') ? host : `https://${host}`
}
