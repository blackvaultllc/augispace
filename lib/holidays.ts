import { pool } from "@/lib/db";

/**
 * Holiday calendar & seasonal experience.
 *
 * The directive's 30-day rule: a holiday "activates" 30 days before its
 * occurrence date and stays active through the end of occurrence day.
 * Active holiday themes drive seasonal radar markers and page banners —
 * always as presentation layered on top of unchanged location/vendor data.
 *
 * All reads go through the direct pool (RLS deny-all at the API layer).
 * Nothing here requires AI generation — ordinary calendar content only.
 */

export type Holiday = {
  slug: string;
  name: string;
  occurrence_date: string;
  regions: string[];
  source_ref: string;
  enabled: boolean;
  days_until: number;
  active: boolean;
};

export type HolidayTheme = {
  radar_marker: string;
  accent_color: string;
  banner_emoji: string;
  page_copy: string;
};

export const RADAR_MARKERS = [
  "default",
  "pumpkin",
  "snowflake",
  "heart",
  "firework",
  "star",
  "leaf",
  "clover",
  "flag",
] as const;

const PREPARE_WINDOW_DAYS = 30;

/** All enabled holidays in the current cycle, with computed countdown/active. */
export async function listHolidays(): Promise<Holiday[]> {
  const result = await pool.query<{
    slug: string;
    name: string;
    occurrence_date: string;
    regions: string[];
    source_ref: string;
    enabled: boolean;
  }>(
    `select slug, name, occurrence_date::text, regions, source_ref, enabled
     from public.holidays where enabled = true order by occurrence_date`,
  );
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return result.rows.map((row) => {
    const date = new Date(`${row.occurrence_date}T00:00:00Z`);
    const daysUntil = Math.round(
      (date.getTime() - today.getTime()) / 86_400_000,
    );
    return {
      ...row,
      occurrence_date: row.occurrence_date,
      days_until: daysUntil,
      // Active from 30 days before through the end of the occurrence day.
      active: daysUntil <= PREPARE_WINDOW_DAYS && daysUntil >= 0,
    };
  });
}

/**
 * The currently active holiday (nearest within the 30-day window), with its
 * theme. Returns null when nothing is active — pages then render normally.
 */
export async function getActiveHoliday(): Promise<{
  holiday: Holiday;
  theme: HolidayTheme;
} | null> {
  const holidays = await listHolidays().catch(() => []);
  const active = holidays
    .filter((h) => h.active)
    .sort((a, b) => a.days_until - b.days_until)[0];
  if (!active) return null;
  const theme = await getTheme(active.slug);
  return { holiday: active, theme: theme ?? defaultTheme() };
}

export async function getTheme(slug: string): Promise<HolidayTheme | null> {
  if (!/^[a-z0-9_-]{1,60}$/.test(slug)) return null;
  const result = await pool.query<HolidayTheme>(
    `select radar_marker, accent_color, banner_emoji, page_copy
     from public.holiday_themes where holiday_slug = $1`,
    [slug],
  );
  return result.rows[0] ?? null;
}

export function defaultTheme(): HolidayTheme {
  return {
    radar_marker: "default",
    accent_color: "#8ce8dc",
    banner_emoji: "",
    page_copy: "",
  };
}

/** Admin: toggle a holiday's enabled state and edit its theme/content. */
export async function upsertTheme(opts: {
  holidaySlug: string;
  radarMarker: string;
  accentColor: string;
  bannerEmoji: string;
  pageCopy: string;
  userId: string;
}) {
  if (
    !RADAR_MARKERS.includes(opts.radarMarker as (typeof RADAR_MARKERS)[number])
  )
    return { ok: false as const, error: "Unknown radar marker." };
  if (!/^#[0-9a-f]{6}$/i.test(opts.accentColor))
    return { ok: false as const, error: "Accent color must be a hex value." };
  await pool.query(
    `insert into public.holiday_themes (holiday_slug, radar_marker, accent_color, banner_emoji, page_copy, updated_by, updated_at)
     values ($1, $2, $3, $4, $5, $6, now())
     on conflict (holiday_slug) do update
     set radar_marker = excluded.radar_marker, accent_color = excluded.accent_color,
         banner_emoji = excluded.banner_emoji, page_copy = excluded.page_copy,
         updated_by = excluded.updated_by, updated_at = now()`,
    [
      opts.holidaySlug,
      opts.radarMarker,
      opts.accentColor,
      opts.bannerEmoji.slice(0, 8),
      opts.pageCopy.slice(0, 500),
      opts.userId,
    ],
  );
  return { ok: true as const };
}

export async function setHolidayEnabled(
  slug: string,
  enabled: boolean,
  userId: string,
) {
  if (!/^[a-z0-9_-]{1,60}$/.test(slug))
    return { ok: false as const, error: "Unknown holiday." };
  await pool.query(
    `update public.holidays set enabled = $2, updated_at = now() where slug = $1`,
    [slug, enabled],
  );
  return { ok: true as const };
}

export async function setOccurrenceDate(
  slug: string,
  date: string,
  userId: string,
) {
  if (!/^[a-z0-9_-]{1,60}$/.test(slug))
    return { ok: false as const, error: "Unknown holiday." };
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())
  )
    return {
      ok: false as const,
      error: "A valid date is required (YYYY-MM-DD).",
    };
  await pool.query(
    `update public.holidays set occurrence_date = $2, updated_at = now() where slug = $1`,
    [slug, date],
  );
  return { ok: true as const };
}

/** Body content for a holiday's public page (admin-authored markdown). */
export async function getHolidayContent(slug: string): Promise<string | null> {
  if (!/^[a-z0-9_-]{1,60}$/.test(slug)) return null;
  const result = await pool.query<{ body_md: string }>(
    "select body_md from public.holiday_content where holiday_slug = $1",
    [slug],
  );
  return result.rows[0]?.body_md ?? null;
}
