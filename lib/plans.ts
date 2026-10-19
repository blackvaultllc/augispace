export const planTiers = {
  observer: { label: 'Observer', monthlyChecks: 3, evidence: false, ai: false },
  analyst: { label: 'Analyst', monthlyChecks: 30, evidence: true, ai: false },
  command: { label: 'Command', monthlyChecks: 150, evidence: true, ai: true },
} as const

export type PlanTier = keyof typeof planTiers

export function isPlanTier(value: string): value is PlanTier {
  return Object.hasOwn(planTiers, value)
}

export const OWNER_EMAIL = 'blackhatterxvi@gmail.com'

export function isOwnerEmail(email: string) {
  return (email ?? '').trim().toLowerCase() === OWNER_EMAIL
}

export function getUtcMonthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}
