// Read-only post-migration verification: tables, bucket, policies, trigger count.
const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  ; (async () => {
    const q = async (label, sql) => {
      try {
        const r = await pool.query(sql)
        console.log(label, JSON.stringify(r.rows))
      } catch (e) {
        console.log(label, 'ERR', String(e.message).replace(/postgres(ql)?:\/\/\S+/g, '<redacted>').split('\n')[0])
      }
    }
    await q('tables:', "select tablename from pg_tables where tablename in ('processed_webhook_event','awards')")
    await q('bucket:', "select id, public from storage.buckets where id = 'award-files'")
    await q('awards policies:', "select policyname, cmd from pg_policies where tablename = 'awards'")
    await q('verification trigger count:', "select count(*)::int n from pg_trigger where tgrelid = 'public.food_trucks'::regclass and tgname = 'food_trucks_protect_verification'")
    await q('webhook prune trigger:', "select tgname from pg_trigger where tgrelid = 'public.processed_webhook_event'::regclass and not tgisinternal")
    await pool.end()
  })()
