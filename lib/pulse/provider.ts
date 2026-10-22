import { pool } from "@/lib/db";
import { createHash } from "node:crypto";

/**
 * Infinity Pulse — trend data provider adapters.
 *
 * Provider choice rationale (honest, documented):
 *  - The official Google Trends API has no public free tier; eligibility is
 *    restricted. We therefore do NOT scrape Google Trends.
 *  - Default adapter: Google News RSS (https://news.google.com/rss) — public,
 *    documented output, attributed with publisher and link-back, queried
 *    per category search term. This measures news volume/recency, NOT
 *    search interest; that distinction is surfaced in the UI.
 *  - The adapter registry below is the only place that knows about providers;
 *    swapping in a licensed API (GDELT, SerpApi, etc.) touches one file.
 *
 * All fetches are server-side, cached in pulse_provider_cache with a TTL,
 * and bounded (max items per category). Failures return typed errors —
 * the UI shows a clear unavailable state, never fabricated data.
 */

export const PULSE_CATEGORIES = [
  { id: "sports", label: "Sports", query: "sports news" },
  { id: "stocks", label: "Stocks & markets", query: "stock market" },
  { id: "crypto", label: "Cryptocurrency", query: "cryptocurrency" },
  { id: "weather", label: "Weather", query: "severe weather" },
  {
    id: "tech",
    label: "Tech & cybersecurity",
    query: "cybersecurity OR technology",
  },
  { id: "science", label: "Science & research", query: "science research" },
  { id: "business", label: "Business & economics", query: "business economy" },
  {
    id: "culture",
    label: "Entertainment & culture",
    query: "entertainment culture",
  },
  { id: "general", label: "General news", query: "breaking news" },
] as const;

export type PulseCategoryId = (typeof PULSE_CATEGORIES)[number]["id"];

export function isPulseCategory(value: string): value is PulseCategoryId {
  return PULSE_CATEGORIES.some((c) => c.id === value);
}

export type PulseTrend = {
  externalKey: string;
  title: string;
  url: string;
  sourceLabel: string;
  publishedAt: string | null;
  region: string | null;
  related: string[];
};

export type PulseFetchResult =
  | {
      ok: true;
      trends: PulseTrend[];
      fetchedAt: string;
      cached: boolean;
      provider: string;
    }
  | { ok: false; error: string; provider: string };

const CACHE_TTL_MINUTES = 30;
const MAX_ITEMS_PER_CATEGORY = 20;
const FETCH_TIMEOUT_MS = 8000;

type ProviderAdapter = {
  id: string;
  label: string;
  measures: string;
  fetch: (category: PulseCategoryId) => Promise<PulseTrend[]>;
};

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function tagText(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match ? decodeXmlEntities(match[1]).trim() : null;
}

/** Extract the real publisher from a Google News RSS description link. */
function cleanGoogleNewsTitle(title: string): {
  title: string;
  publisher: string;
} {
  const dashIdx = title.lastIndexOf(" - ");
  if (dashIdx > 20) {
    return {
      title: title.slice(0, dashIdx).trim(),
      publisher: title.slice(dashIdx + 3).trim(),
    };
  }
  return { title: title.trim(), publisher: "Google News" };
}

const googleNewsRss: ProviderAdapter = {
  id: "google-news-rss",
  label: "Google News (public RSS)",
  measures: "News coverage volume & recency — not search interest.",
  async fetch(category) {
    const def = PULSE_CATEGORIES.find((c) => c.id === category);
    if (!def) throw new Error("Unknown category");
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(def.query)}&hl=en-US&gl=US&ceid=US:en`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": "AUGI-InfinityPulse/1.0 (+https://augi.space)" },
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error(`Provider returned HTTP ${response.status}`);
    const xml = await response.text();
    const items = xml.split("<item>").slice(1, MAX_ITEMS_PER_CATEGORY + 1);
    const trends: PulseTrend[] = [];
    for (const item of items) {
      const rawTitle = tagText(item, "title");
      const link = tagText(item, "link");
      const pubDate = tagText(item, "pubDate");
      const sourceTag = tagText(item, "source");
      if (!rawTitle || !link) continue;
      const { title, publisher } = sourceTag
        ? { title: rawTitle, publisher: decodeXmlEntities(sourceTag) }
        : cleanGoogleNewsTitle(rawTitle);
      // Untrusted external content: hard length caps on everything stored.
      trends.push({
        externalKey: createHashKey(category, title),
        title: title.slice(0, 300),
        url: link.slice(0, 1000),
        sourceLabel: publisher.slice(0, 120) || "Unknown publisher",
        publishedAt: pubDate ? new Date(pubDate).toISOString() || null : null,
        region: "US (English edition)",
        related: [],
      });
    }
    return trends;
  },
};

function createHashKey(category: string, title: string): string {
  // Stable dedup key: category + normalized title (avoids URL churn).
  const normalized = title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) | 0;
  }
  return `${category}:${(hash >>> 0).toString(36)}`;
}

// ---- Adapter registry: swap or add providers here only -------------------
const ADAPTERS: ProviderAdapter[] = [googleNewsRss];

export function getProviderInfo() {
  return ADAPTERS.map(({ id, label, measures }) => ({ id, label, measures }));
}

/** Fetch with DB cache (TTL) and typed failure. */
export async function fetchTrends(
  category: PulseCategoryId,
): Promise<PulseFetchResult> {
  const adapter = ADAPTERS[0];
  try {
    const cached = await pool.query<{
      payload: PulseTrend[];
      fetched_at: string;
    }>(
      `select payload, fetched_at from public.pulse_provider_cache
       where provider = $1 and category = $2 and fetched_at > now() - interval '${CACHE_TTL_MINUTES} minutes'`,
      [adapter.id, category],
    );
    if (cached.rows[0]) {
      return {
        ok: true,
        trends: cached.rows[0].payload,
        fetchedAt: new Date(cached.rows[0].fetched_at).toISOString(),
        cached: true,
        provider: adapter.id,
      };
    }
  } catch {
    // Cache unavailable — proceed to a live fetch rather than failing.
  }

  try {
    const trends = await adapter.fetch(category);
    const fetchedAt = new Date().toISOString();
    try {
      await pool.query(
        `insert into public.pulse_provider_cache (provider, category, payload, fetched_at)
         values ($1, $2, $3, $4)
         on conflict (provider, category) do update set payload = excluded.payload, fetched_at = excluded.fetched_at`,
        [adapter.id, category, JSON.stringify(trends), fetchedAt],
      );
      // Persist deduplicated observations for research/article use.
      for (const t of trends.slice(0, MAX_ITEMS_PER_CATEGORY)) {
        await pool
          .query(
            `insert into public.pulse_trends (category, provider, external_key, title, url, source_label, published_at, retrieved_at, region, related)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           on conflict (category, external_key) do update set retrieved_at = excluded.retrieved_at, published_at = coalesce(excluded.published_at, pulse_trends.published_at)`,
            [
              category,
              adapter.id,
              t.externalKey,
              t.title,
              t.url,
              t.sourceLabel,
              t.publishedAt,
              fetchedAt,
              t.region,
              JSON.stringify(t.related),
            ],
          )
          .catch(() => undefined);
      }
      // Retention: keep only the most recent 200 observations per category.
      await pool
        .query(
          `delete from public.pulse_trends where id in (
           select id from (
             select id, row_number() over (partition by category order by retrieved_at desc) as rn
             from public.pulse_trends
           ) ranked where ranked.rn > 200
         )`,
        )
        .catch(() => undefined);
    } catch {
      // Cache write failure must not fail the user-facing fetch.
    }
    return { ok: true, trends, fetchedAt, cached: false, provider: adapter.id };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message.slice(0, 200)
          : "The trend provider is unavailable.",
      provider: adapter.id,
    };
  }
}
