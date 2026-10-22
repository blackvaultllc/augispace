// Read-only: list non-internal triggers on public.food_trucks.
const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
pool
  .query(`select tgname, tgenabled from pg_trigger where tgrelid = 'public.food_trucks'::regclass and not tgisinternal`)
  .then((r) => { console.log(JSON.stringify(r.rows)); return pool.end() })
  .catch((e) => { console.log('ERR', String(e.message).replace(/postgres(ql)?:\/\/\S+/g, '<redacted>')); return pool.end() })
