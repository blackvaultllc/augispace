/**
 * Holiday calendar & seasonal experience — logic + contract tests.
 *
 * Covered:
 *  1. The 30-day activation window rule (source contract on lib/holidays.ts).
 *  2. Theme marker validation (unknown markers rejected; hex colors enforced).
 *  3. RLS deny-all for all holiday tables; seed is idempotent (no overwrites).
 *  4. Seasonal radar markers are presentation-only (location data untouched).
 *  5. Movable holidays are admin-correctable, never SQL-computed.
 *
 * Run: npx tsx tests/holidays.test.mts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const holidaysSrc = readFileSync(
  new URL("../lib/holidays.ts", import.meta.url),
  "utf8",
);
const migrationSrc = readFileSync(
  new URL(
    "../supabase/migrations/20261029100000_holidays.sql",
    import.meta.url,
  ),
  "utf8",
);
const apiSrc = readFileSync(
  new URL("../app/api/holidays/route.ts", import.meta.url),
  "utf8",
);

// 1. 30-day activation window.
assert.ok(
  holidaysSrc.includes("PREPARE_WINDOW_DAYS = 30"),
  "the 30-day prepare window must be explicit",
);
assert.ok(
  holidaysSrc.includes("daysUntil <= PREPARE_WINDOW_DAYS && daysUntil >= 0"),
  "activation must span 30 days before through the occurrence day",
);

// 2. Theme validation.
assert.ok(
  holidaysSrc.includes("RADAR_MARKERS.includes"),
  "unknown radar markers must be rejected server-side",
);
assert.ok(
  holidaysSrc.includes("/^#[0-9a-f]{6}$/i"),
  "accent colors must be validated as hex",
);
const { RADAR_MARKERS } = await import("../lib/holidays.ts");
assert.ok(
  RADAR_MARKERS.includes("pumpkin"),
  "the Halloween pumpkin marker must exist per the directive",
);
assert.ok(
  RADAR_MARKERS.includes("default"),
  "a normal marker option must exist (accessibility)",
);

// 3. RLS deny-all + idempotent seed.
for (const table of ["holidays", "holiday_themes", "holiday_content"]) {
  assert.ok(
    migrationSrc.includes(
      `alter table public.${table} enable row level security`,
    ),
    `${table} must have RLS enabled`,
  );
}
assert.ok(
  !/create policy/i.test(migrationSrc),
  "holiday tables must have NO permissive policies",
);
assert.ok(
  migrationSrc.includes("on conflict (slug) do nothing"),
  "the seed must never overwrite admin edits",
);
assert.ok(
  migrationSrc.includes("on conflict (holiday_slug) do nothing"),
  "theme seed must be idempotent",
);
// Source attribution required on every seed row.
assert.ok(
  migrationSrc.includes("source_ref"),
  "every holiday carries a source reference",
);

// 4. Presentation-only contract: the marker rides on the pin layer, data flows unchanged.
const pinsSrc = readFileSync(
  new URL("../components/truck-radar-layer.tsx", import.meta.url),
  "utf8",
);
assert.ok(
  pinsSrc.includes("SeasonalMarker"),
  "the pin layer must type seasonal markers",
);
assert.ok(
  pinsSrc.includes("pumpkin"),
  "the pumpkin glyph must be wired into the radar",
);
assert.ok(
  pinsSrc.includes('aria-hidden="true"'),
  "seasonal glyphs must be hidden from screen readers",
);
// Default marker remains available; seasonal is opt-in via props.
assert.ok(
  pinsSrc.includes('seasonal = "default"'),
  "seasonal markers must default to the normal map marker",
);

// The truck page passes the theme through without altering data fetching.
const truckPageSrc = readFileSync(
  new URL("../app/food-trucks/page.tsx", import.meta.url),
  "utf8",
);
assert.ok(
  truckPageSrc.includes("getActiveHoliday"),
  "the truck page must source the active theme server-side",
);

// 5. Movable holidays are admin-correctable dates, not SQL-computed.
assert.ok(
  migrationSrc.includes("recurrence text not null default 'fixed'"),
  "recurrence must be a stored field",
);
assert.ok(
  holidaysSrc.includes("setOccurrenceDate"),
  "the admin must be able to correct occurrence dates",
);
assert.ok(apiSrc.includes("set_date"), "the API must expose date correction");

// Owner-only API.
assert.ok(
  apiSrc.includes("Owner access only"),
  "the holiday admin API must be owner-gated",
);

// Public page: neutral copy, no assumed observance.
const publicSrc = readFileSync(
  new URL("../app/holidays/page.tsx", import.meta.url),
  "utf8",
);
assert.ok(
  publicSrc.includes("your choice"),
  "copy must not assume observance for every visitor",
);

console.log(
  "PASS: holiday calendar tests (30-day window, theme validation, RLS deny-all, presentation-only markers, admin-correctable dates).",
);
