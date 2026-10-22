// Read-only schema inspection (no data modification). Run: node scripts/inspect-schema.js
const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const q = async (label, sql) => {
  try {
    const r = await pool.query(sql)
    console.log(`## ${label}`)
    for (const row of r.rows) console.log(' ', JSON.stringify(row))
  } catch (e) {
    console.log(`## ${label} -- ERROR: ${e.message}`)
  }
}

  ; (async () => {
    await q('version', 'select version()')
    await q(
      'public tables',
      `select table_name from information_schema.tables where table_schema='public' order by 1`,
    )
    await q(
      'app_users',
      `select column_name, data_type from information_schema.columns where table_schema='public' and table_name='app_users' order by ordinal_position`,
    )
    await q('app_users rows (roles only)', `select user_id, role, email = 'redacted' as has_email from app_users`)
    await q('profiles columns', `select column_name from information_schema.columns where table_schema='public' and table_name='profiles' order by ordinal_position`)
    await q('triggers', `select event_object_table, trigger_name from information_schema.triggers where trigger_schema='public' order by 1`)
    await q('functions', `select routine_name from information_schema.routines where routine_schema='public' order by 1`)
    await q('rls enabled', `select relname, relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where nspname='public' and relkind='r' order by 1`)
    await q('policies', `select tablename, policyname, cmd, roles from pg_policies where schemaname='public' order by 1,2`)
    await q('auth user count', `select count(*)::int as n from auth.users`)
    await pool.end()
  })()
