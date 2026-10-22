// Read-only inspection of auth-related DB objects. Prints definitions and
// counts only — no emails, IDs, tokens, or secrets.
const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const q = async (label, sql) => {
  try {
    const r = await pool.query(sql)
    console.log(`## ${label}`)
    for (const row of r.rows) console.log(' ', JSON.stringify(row).slice(0, 1200))
  } catch (e) {
    console.log(`## ${label} -- ERR`, String(e.message).replace(/postgres(ql)?:\/\/\S+/g, '<redacted>').split('\n')[0])
  }
}
  ; (async () => {
    await q('handle_new_user definition', `select prosrc from pg_proc where proname = 'handle_new_user'`)
    await q('triggers in auth schema', `select event_object_table, trigger_name, action_timing, event_manipulation from information_schema.triggers where trigger_schema = 'auth'`)
    await q('profiles_legacy columns', `select column_name from information_schema.columns where table_schema='public' and table_name='profiles_legacy' order by ordinal_position`)
    await q('profiles_legacy row count', `select count(*)::int n from public.profiles_legacy`)
    await q('on_auth_user_created trigger?', `select tgname, tgrelid::regclass as on_table from pg_trigger where not tgisinternal and tgname ilike '%user%' or tgname ilike '%auth%'`)
    await q('email confirmation pending? (counts)', `select count(*)::int n from auth.users where email_confirmed_at is null`)
    await q('identity providers present', `select provider, count(*)::int n from auth.identities group by provider`)
    await pool.end()
  })()
