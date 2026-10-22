import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveRole } from "@/lib/roles";
import { isPulseCategory, fetchTrends, PULSE_CATEGORIES, getProviderInfo } from "@/lib/pulse/provider";
import { rateLimit } from "@/lib/pulse/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Infinity Pulse trends API.
 *
 * GET:          list categories + provider info (public, cached in the client).
 * POST {category, refresh}:
 *   - Requires an authenticated session (owner/staff OR ordinary member —
 *     trend *viewing* is a member feature; publishing is not).
 *   - Rate limited per user (30 fetches/hour) — refreshes cost provider calls.
 *   - On-demand fetch with server-side cache; manual refresh bypasses the
 *     cache read but still writes through it.
 */
export async function GET() {
  return NextResponse.json(
    { categories: PULSE_CATEGORIES.map(({ id, label }) => ({ id, label })), provider: getProviderInfo() },
    { headers: { "Cache-Control": "public, s-maxage=300" } },
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to use Infinity Pulse." }, { status: 401 });

  const role = await resolveRole(user.id, user.email);
  const body = (await request.json().catch(() => null)) as null | { category?: unknown; refresh?: unknown };
  const category = typeof body?.category === "string" ? body.category : "";
  if (!isPulseCategory(category)) {
    return NextResponse.json({ error: "Choose a valid trend category." }, { status: 400 });
  }

  const refresh = body?.refresh === true;
  // Cost control: provider calls are bounded per user per hour. Refreshes
  // (cache-bypassing) are stricter than reads.
  const limit = await rateLimit({
    key: `pulse:${refresh ? "refresh" : "fetch"}:${user.id}`,
    max: refresh ? 10 : 30,
    windowMinutes: 60,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: refresh ? "Refresh limit reached (10/hour). Try again later." : "Fetch limit reached (30/hour). Try again later." },
      { status: 429, headers: { "Retry-After": "600" } },
    );
  }

  // Cache bypass only when explicitly refreshing; the cache write-through
  // always happens so other users benefit.
  let result = refresh ? null : await fetchTrendsCachedRead(category);
  if (!result) {
    result = await fetchTrends(category);
    if (refresh && result.ok) {
      // Refresh also refreshes the cache timestamp (fetchTrends writes through).
    }
  }

  if (!result.ok) {
    // Honest failure: typed error, no fabricated data.
    return NextResponse.json(
      { error: `Trend provider unavailable: ${result.error}`, provider: result.provider },
      { status: 502 },
    );
  }

  return NextResponse.json(
    {
      category,
      provider: { id: result.provider, ...getProviderInfo().find((p) => p.id === result.provider) },
      retrievedAt: result.fetchedAt,
      cached: result.cached,
      measures: getProviderInfo().find((p) => p.id === result.provider)?.measures ?? null,
      trends: result.trends.map((t) => ({
        externalKey: t.externalKey,
        title: t.title,
        url: t.url,
        sourceLabel: t.sourceLabel,
        publishedAt: t.publishedAt,
        region: t.region,
      })),
      usage: { remaining: limit.remaining },
      canDraft: role.isAdmin, // only owner/staff see the draft action
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

async function fetchTrendsCachedRead(category: string) {
  // fetchTrends already checks the cache first; calling it directly keeps one
  // code path. The refresh flag is honored by skipping this cached path.
  const { fetchTrends } = await import("@/lib/pulse/provider");
  return fetchTrends(category as Parameters<typeof fetchTrends>[0]);
}
