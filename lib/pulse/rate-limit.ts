import { pool } from "@/lib/db";

/**
 * Simple DB-backed fixed-window rate limiter.
 *
 * Backed by a small table so limits hold across serverless invocations
 * (in-memory limits do not survive isolates). If the table is missing
 * (migration not yet applied), the limiter fails OPEN but logs — availability
 * is preferred over locking out legitimate users; the DB-level quotas in the
 * provider cache and trend retention provide the real cost bound.
 */

type LimitResult = { allowed: boolean; remaining: number };

export async function rateLimit(opts: {
  key: string;
  max: number;
  windowMinutes: number;
}): Promise<LimitResult> {
  try {
    const result = await pool.query<{ allowed: boolean; remaining: number }>(
      `select count(*) < $2::int as allowed, $2::int - count(*)::int as remaining
       from public.pulse_rate_limit
       where bucket = $1 and window_start > now() - ($3::text || ' minutes')::interval`,
      [opts.key, opts.max, String(opts.windowMinutes)],
    );
    const row = result.rows[0];
    if (!row?.allowed) return { allowed: false, remaining: 0 };
    await pool.query(
      `insert into public.pulse_rate_limit (bucket, window_start)
       values ($1, coalesce((select window_start from public.pulse_rate_limit where bucket = $1 order by window_start desc limit 1), now()))`,
      [opts.key],
    );
    return { allowed: true, remaining: row.remaining };
  } catch {
    // Fail open (logged) when the limiter table is unavailable.
    console.error("[pulse] rate limiter unavailable; failing open");
    return { allowed: true, remaining: -1 };
  }
}
