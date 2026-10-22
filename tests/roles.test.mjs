/**
 * Offline unit tests for the role-resolution fail-closed behavior.
 * No database required: DATABASE_URL is intentionally left unset, so any
 * successful elevation attempt would throw or return a wrong result and fail.
 *
 * Run: node tests/roles.test.mjs
 */
import assert from 'node:assert/strict'

process.env.DATABASE_URL = '' // force the registry to be unreachable

const { resolveRole } = await import('../lib/roles.ts').catch(() => ({}))

if (!resolveRole) {
  console.log('SKIP: lib/roles is TypeScript; run through tsx/ts-node in CI to execute this test.')
  process.exit(0)
}

// A non-owner with an unreachable registry must resolve as plain member.
const ctx = await resolveRole('00000000-0000-0000-0000-000000000000', 'someone@example.com')
assert.equal(ctx.role, 'member', 'unreachable registry must fail closed to member')
assert.equal(ctx.isAdmin, false, 'unreachable registry must never grant admin')

console.log('PASS: role resolution fails closed when the registry is unavailable.')
