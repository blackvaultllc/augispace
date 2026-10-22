// Applies a SQL migration file against DATABASE_URL (direct Postgres).
// Usage: node scripts/apply-migration.mjs supabase/migrations/NNN_file.sql
// Prints only pass/fail and the server-reported error message (secrets redacted).
import { readFileSync } from 'node:fs'
import pg from 'pg'

const file = process.argv[2]
if (!file) { console.error('Usage: node scripts/apply-migration.mjs <migration.sql>'); process.exit(2) }

const sql = readFileSync(file, 'utf8')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
try {
  await pool.query('begin')
  await pool.query(sql)
  await pool.query('commit')
  console.log(`APPLIED: ${file}`)
} catch (error) {
  await pool.query('rollback').catch(() => undefined)
  const message = String(error?.message ?? error).replace(/postgres(ql)?:\/\/\S+/g, '<redacted>')
  console.error(`FAILED: ${file}\n${message.split('\n').slice(0, 4).join('\n')}`)
  process.exitCode = 1
} finally {
  await pool.end()
}
