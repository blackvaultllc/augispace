/**
 * Awards & Achievements — pure logic tests (no database, no network).
 *
 * Covers the transformation and aggregation rules the workspace UI relies on:
 *  - year derivation (year_group > received_on year > created_at year)
 *  - category counting
 *  - filter behavior (category, year)
 *
 * Run: npx tsx tests/awards.test.mts
 */
import assert from "node:assert/strict";

type AwardItem = {
  id: string;
  category: string;
  receivedOn: string;
  yearGroup: number | null;
  createdAt: string;
};

function yearOf(award: AwardItem): number | null {
  return (
    award.yearGroup ??
    (award.receivedOn
      ? Number(award.receivedOn.slice(0, 4))
      : award.createdAt
        ? Number(award.createdAt.slice(0, 4))
        : null)
  );
}

function groupByYear(awards: AwardItem[]): Map<number, AwardItem[]> {
  const map = new Map<number, AwardItem[]>();
  for (const award of awards) {
    const year = yearOf(award);
    if (!year) continue;
    const list = map.get(year) ?? [];
    list.push(award);
    map.set(year, list);
  }
  return map;
}

function applyFilters(
  awards: AwardItem[],
  categoryFilter: string,
  yearFilter: string,
): AwardItem[] {
  return awards.filter((a) => {
    if (categoryFilter !== "all" && a.category !== categoryFilter) return false;
    if (yearFilter !== "all") {
      const year =
        a.yearGroup ?? (a.receivedOn ? Number(a.receivedOn.slice(0, 4)) : null);
      if (String(year) !== yearFilter) return false;
    }
    return true;
  });
}

// -- Fixtures ---------------------------------------------------------------
const awards: AwardItem[] = [
  {
    id: "1",
    category: "academic",
    receivedOn: "2024-05-01",
    yearGroup: null,
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "2",
    category: "athletics",
    receivedOn: "2025-03-15",
    yearGroup: null,
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "3",
    category: "academic",
    receivedOn: "",
    yearGroup: 2025,
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "4",
    category: "creative",
    receivedOn: "",
    yearGroup: null,
    createdAt: "2023-06-10T00:00:00Z",
  },
];

// 1. Year derivation: explicit year_group wins, then received_on, then created_at.
const grouped = groupByYear(awards);
assert.equal(
  grouped.get(2024)?.length,
  1,
  "2024 groups the dated academic award",
);
assert.equal(
  grouped.get(2025)?.length,
  2,
  "2025 groups athletics + explicit year_group award",
);
assert.equal(
  grouped.get(2023)?.length,
  1,
  "2023 falls back to created_at year",
);

// 2. Category breakdown counts real records only.
const counts = new Map<string, number>();
for (const award of awards)
  counts.set(award.category, (counts.get(award.category) ?? 0) + 1);
assert.equal(counts.get("academic"), 2);
assert.equal(counts.get("athletics"), 1);
assert.equal(counts.get("creative"), 1);
assert.equal(counts.get("community"), undefined);

// 3. Filters.
assert.equal(
  applyFilters(awards, "academic", "all").length,
  2,
  "category filter",
);
assert.equal(applyFilters(awards, "all", "2025").length, 2, "year filter");
assert.equal(
  applyFilters(awards, "athletics", "2025").length,
  1,
  "combined filters",
);
assert.equal(applyFilters(awards, "all", "all").length, 4, "no filters");

// 4. Empty state: no records -> no fabricated years or stats.
assert.equal(groupByYear([]).size, 0);
assert.equal(applyFilters([], "academic", "2024").length, 0);

console.log(
  "PASS: awards grouping, filtering, and aggregation rules behave as specified.",
);
