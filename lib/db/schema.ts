import { boolean, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  role: text('role').notNull().default('member'),
  tier: text('tier').notNull().default('observer'),
  stripeCustomerId: text('stripeCustomerId').unique(),
  stripeSubscriptionId: text('stripeSubscriptionId').unique(),
  stripeSubscriptionStatus: text('stripeSubscriptionStatus'),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).defaultNow(),
})

export const assistantMessages = pgTable('augi_assistant_message', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
})

export const investigations = pgTable('augi_investigation', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  domain: text('domain').notNull(),
  score: integer('score').notNull(),
  report: jsonb('report').notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Processed Stripe webhook event IDs (idempotency).
 * Stripe retries deliveries; without this table, duplicate events re-apply
 * the same state change. A unique primary key makes replays a no-op.
 */
export const processedWebhookEvents = pgTable('processed_webhook_event', {
  id: text('id').primaryKey(), // Stripe event id, e.g. evt_...
  type: text('type').notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
})
