/**
 * Infinity Pulse — logic + contract tests (no database, no network).
 *
 * Covered:
 *  1. Draft assembly: body contains ONLY sourced data (titles, publishers,
 *     retrieval timestamp); AI analysis is a separate field; no data -> null.
 *  2. Slug generation and article-id validation.
 *  3. Workflow transition table: illegal transitions rejected; publish
 *     requires approval; only the owner can approve/publish.
 *  4. Provider contract: categories valid; the provider adapter is modular
 *     (registry pattern); untrusted external content is length-capped; the
 *     provider is never claimed to be Google Trends.
 *  5. RLS deny-all contract for all pulse tables.
 *  6. Public visibility: the public hub/detail queries filter status='published'.
 *
 * Run: npx tsx tests/pulse.test.mts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const providerSrc = readFileSync(
  new URL("../lib/pulse/provider.ts", import.meta.url),
  "utf8",
);
const articlesSrc = readFileSync(
  new URL("../lib/pulse/articles.ts", import.meta.url),
  "utf8",
);
const trendsApiSrc = readFileSync(
  new URL("../app/api/pulse/trends/route.ts", import.meta.url),
  "utf8",
);
const articlesApiSrc = readFileSync(
  new URL("../app/api/pulse/articles/route.ts", import.meta.url),
  "utf8",
);
const migrationSrc = readFileSync(
  new URL(
    "../supabase/migrations/20261028100000_infinity_pulse.sql",
    import.meta.url,
  ),
  "utf8",
);
const trendingSrc = readFileSync(
  new URL("../app/trending/page.tsx", import.meta.url),
  "utf8",
);

// ---- 1. Draft assembly is fact-based --------------------------------------
const { buildDraftFromTrends } = await import("../lib/pulse/articles.ts");

const sampleTrends = [
  {
    externalKey: "sports:abc",
    title: "Championship final ends in overtime",
    url: "https://example.com/story/1",
    sourceLabel: "Example Sports Daily",
    publishedAt: "2026-10-28T10:00:00.000Z",
    region: "US (English edition)",
    related: [],
  },
  {
    externalKey: "sports:def",
    title: "Star player returns from injury",
    url: "https://example.com/story/2",
    sourceLabel: "Example Wire",
    publishedAt: "2026-10-28T08:00:00.000Z",
    region: null,
    related: [],
  },
];

const draft = buildDraftFromTrends({
  category: "sports",
  categoryLabel: "Sports",
  trends: sampleTrends,
  retrievedAt: "2026-10-28T12:00:00.000Z",
  providerMeasures: "News coverage volume & recency — not search interest.",
});

assert.ok(draft, "a draft must be produced from usable trends");
assert.ok(
  draft.body.includes("Example Sports Daily"),
  "body must attribute publishers",
);
assert.ok(
  draft.body.includes("https://example.com/story/1"),
  "body must link sources",
);
assert.ok(draft.body.includes("2026-10-28"), "body must carry dates");
assert.ok(
  !draft.body.includes("AI-generated"),
  "the sourced body must NOT contain AI commentary",
);
assert.ok(
  draft.analysis.startsWith("**AI-generated analysis"),
  "analysis must be explicitly labeled",
);
// No fabricated facts: the draft never invents scores or outcomes.
assert.ok(
  !/\d+\s*[-–]\s*\d+/.test(draft.body.replace(/2026-10-28/g, "")),
  "no invented scores in the sourced body",
);

// Empty results must produce NO draft (never a fabricated filler).
const empty = buildDraftFromTrends({
  category: "sports",
  categoryLabel: "Sports",
  trends: [],
  retrievedAt: "2026-10-28T12:00:00.000Z",
  providerMeasures: "x",
});
assert.equal(empty, null, "empty trend data must produce no draft");

// ---- 2. Slug + validation ---------------------------------------------------
const { slugify } = await import("../lib/pulse/articles.ts");
assert.equal(
  slugify("Championship Final — Ends in Overtime!"),
  "championship-final-ends-in-overtime",
);
assert.equal(slugify("!!!"), "untitled");

// ---- 3. Workflow transitions ------------------------------------------------
const { canTransition } = await import("../lib/pulse/articles.ts");
assert.ok(canTransition("draft", "in_review"));
assert.ok(canTransition("in_review", "approved"));
assert.ok(canTransition("approved", "published"));
assert.ok(!canTransition("draft", "published"), "cannot skip review+approval");
assert.ok(
  !canTransition("in_review", "published"),
  "cannot publish without approval step",
);
assert.ok(
  !canTransition("published", "draft"),
  "cannot unpublish by rewinding to draft",
);
assert.ok(!canTransition("archived", "published"), "archived stays archived");
assert.ok(!canTransition("archived", "draft"), "archived is terminal");

// The workflow service must enforce owner-only approval/publishing server-side
// (the gates live in lib/pulse/articles.ts changeStatus, behind the API).
assert.ok(
  articlesSrc.includes("Only the owner can publish"),
  "publish must be owner-gated server-side",
);
assert.ok(
  articlesSrc.includes("Only the owner can approve"),
  "approve must be owner-gated server-side",
);
assert.ok(
  articlesSrc.includes("Publishing requires explicit approval first"),
  "publishing requires a recorded approval",
);

// ---- 4. Provider contract ---------------------------------------------------
assert.ok(
  providerSrc.includes("google-news-rss"),
  "the default provider id must be documented",
);
assert.ok(
  providerSrc.includes("no public free tier"),
  "the Google Trends ineligibility rationale must be recorded",
);
assert.ok(
  providerSrc.includes("not search interest"),
  "the measures-not-search-interest distinction must be documented",
);
// Adapter registry pattern (modular swap).
assert.ok(
  providerSrc.includes("const ADAPTERS: ProviderAdapter[]"),
  "adapters must live in a registry",
);
// Untrusted content caps.
assert.ok(
  providerSrc.includes(".slice(0, 300)"),
  "titles must be length-capped",
);
assert.ok(
  providerSrc.includes(".slice(0, 1000)"),
  "URLs must be length-capped",
);
assert.ok(
  providerSrc.includes("MAX_ITEMS_PER_CATEGORY = 20"),
  "fetch size must be bounded",
);

// Category set matches the directive's nine categories.
const { isPulseCategory } = await import("../lib/pulse/provider.ts");
for (const id of [
  "sports",
  "stocks",
  "crypto",
  "weather",
  "tech",
  "science",
  "business",
  "culture",
  "general",
]) {
  assert.ok(isPulseCategory(id), `category ${id} must be supported`);
}
assert.ok(!isPulseCategory("invented"), "unknown categories must be rejected");

// Rate limits present on both APIs.
assert.ok(trendsApiSrc.includes("rateLimit"), "trends API must rate-limit");
assert.ok(articlesApiSrc.includes("rateLimit"), "workflow API must rate-limit");
assert.ok(
  trendsApiSrc.includes("Sign in to use Infinity Pulse"),
  "trend fetch must require a session",
);

// ---- 5. RLS deny-all --------------------------------------------------------
for (const table of [
  "pulse_provider_cache",
  "pulse_trends",
  "pulse_articles",
  "pulse_article_sources",
  "pulse_article_revisions",
  "pulse_article_history",
  "pulse_rate_limit",
]) {
  assert.ok(
    migrationSrc.includes(
      `alter table public.${table} enable row level security`,
    ),
    `${table} must have RLS enabled`,
  );
}
assert.ok(
  !/create policy/i.test(migrationSrc),
  "pulse tables must have NO permissive policies",
);

// ---- 6. Public visibility contract -----------------------------------------
assert.ok(
  trendingSrc.includes("status = 'published'") ||
    trendingSrc.includes("listPublishedArticles"),
  "the public hub must render only published articles",
);
const detailSrc = readFileSync(
  new URL("../app/trending/[slug]/page.tsx", import.meta.url),
  "utf8",
);
assert.ok(
  detailSrc.includes("getPublishedArticle"),
  "article detail must use the published-only query",
);

console.log(
  "PASS: Infinity Pulse tests (fact-based drafts, empty-data handling, transitions, provider contract, RLS, public visibility).",
);
