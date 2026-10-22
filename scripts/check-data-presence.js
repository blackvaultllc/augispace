// Read-only data-presence check. Never prints emails, IDs, or secret values.
const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const q = async (label, sql) => {
  try {
    const r = await pool.query(sql)
    console.log(label, JSON.stringify(r.rows))
  } catch (e) {
    console.log(label, 'ERR', String(e.message).replace(/postgres(ql)?:\/\/\S+/g, '<redacted>').split('\n')[0])
  }
}
  ; (async () => {
    await q('app_users roles      :', "select role, count(*)::int n from app_users group by role order by role")
    await q('profiles rows        :', 'select tier, count(*)::int n from profiles group by tier')
    await q('staff_invites states :', 'select status, role, count(*)::int n from staff_invites group by status, role')
    await q('food_trucks          :', 'select count(*)::int n, count(*) filter (where verified)::int verified from food_trucks')
    await q('truck locations      :', 'select count(*)::int n, count(*) filter (where active)::int active from food_truck_locations')
    await q('truck comments       :', 'select count(*)::int n from food_truck_comments')
    await q('integration_settings :', 'select key, updated_at is not null as set from integration_settings')
    await q('media_assets         :', 'select count(*)::int n from media_assets')
    await q('incident_events      :', 'select count(*)::int n from incident_events')
    await pool.end()
  })()

// Additional read-only consistency checks (counts only, no personal data).
;(async () => {
  await q('profiles matching auth users:', 'select count(*)::int n from public.profiles pf join auth.users u on u.id = pf.user_id')
  await q('auth users WITHOUT profile  :', 'select count(*)::int n from auth.users u left join public.profiles pf on pf.user_id = u.id where pf.user_id is null')
  await q('auth users WITHOUT app_users:', 'select count(*)::int n from auth.users u left join public.app_users a on a.user_id = u.id where a.user_id is null')
  await q('duplicate emails in auth     :', 'select lower(email), count(*)::int n from auth.users group by lower(email) having count(*) > 1')
  await q('duplicate profile rows       :', 'select lower(email), count(*)::int n from public.profiles group by lower(email) having count(*) > 1')
  await pool.end()
})()
