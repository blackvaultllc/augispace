// Derive the correct Supabase Postgres connection string TEMPLATE from the
// configured project URL, then test connectivity if a password is provided via
// SUPABASE_DB_PASSWORD (never printed). Secrets are never written anywhere.
// Usage: node scripts/derive-db-url.mjs
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { Pool } = require('pg')

function loadEnv() {
  const env = {}
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=')
    if (i > 0) env[line.slice(0, i)] = line.slice(i + 1)
  }
  return env
}

const env = loadEnv()
const ref = (env.NEXT_PUBLIC_SUPABASE_URL || '').match(/https:\/\/([a-z0-9]+)\.supabase\./)?.[1]
if (!ref) { console.log('No Supabase project URL configured.'); process.exit(0) }

const password = process.env.SUPABASE_DB_PASSWORD || ''
if (!password) {
  console.log(`project ref : ${ref}`)
  console.log('templates   :')
  console.log(`  direct (5432): postgresql://postgres:[PWD]@db.${ref}.supabase.co:5432/postgres`)
  console.log(`  pooler (6543): postgresql://postgres.${ref}:[PWD]@aws-0-<REGION>.pooler.supabase.com:6543/postgres?sslmode=require`)
  console.log('Set SUPABASE_DB_PASSWORD in the environment (not in any file) to test connectivity.')
  process.exit(0)
}

// Test both candidate endpoints; report only host:port and outcome.
const candidates = [
  `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres?sslmode=require`,
  `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require`,
  `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require`,
]
for (const cs of candidates) {
  const host = cs.match(/@([^:/]+)/)[1]
  const port = cs.match(/:(\d+)\//)[1]
  const pool = new Pool({ connectionString: cs, connectionTimeoutMillis: 8000 })
  try {
    const r = await pool.query('select current_user, version()')
    console.log(`OK   ${host}:${port} as ${r.rows[0].current_user}`)
  } catch (e) {
    console.log(`FAIL ${host}:${port} code=${e.code ?? '?'} ${e.message.split('\n')[0]}`)
  } finally {
    await pool.end().catch(() => { })
  }
}
