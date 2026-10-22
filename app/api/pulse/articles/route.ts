import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveRole } from "@/lib/roles";
import { rateLimit } from "@/lib/pulse/rate-limit";
import {
  createArticle,
  changeStatus,
  getArticleWithSources,
  listArticlesForAdmin,
  listRevisions,
  getRevision,
  rollbackToRevision,
  saveArticleRevision,
} from "@/lib/pulse/articles";
import { PULSE_CATEGORIES, isPulseCategory, fetchTrends } from "@/lib/pulse/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Infinity Pulse article workflow API — owner/staff only.
 * Every action re-verifies the session and role server-side (fail-closed).
 */
async function requireStaff() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const role = await resolveRole(user.id, user.email);
  if (!role.isAdmin) return null;
  return { user, isOwner: role.role === "owner" };
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return jsonError("Owner or staff access required.", 403);

  const id = request.nextUrl.searchParams.get("id");
  const revisionsFor = request.nextUrl.searchParams.get("revisions");
  const revision = request.nextUrl.searchParams.get("revision");

  if (id && revisionsFor) {
    const list = await listRevisions(id);
    return NextResponse.json({ revisions: list }, { headers: { "Cache-Control": "private, no-store" } });
  }
  if (id && revision) {
    const version = Number.parseInt(revision, 10);
    if (!Number.isInteger(version) || version < 1) return jsonError("Invalid revision number.", 400);
    const row = await getRevision(id, version);
    if (!row) return jsonError("Revision not found.", 404);
    return NextResponse.json({ revision: row }, { headers: { "Cache-Control": "private, no-store" } });
  }
  if (id) {
    const article = await getArticleWithSources(id);
    if (!article) return jsonError("Article not found.", 404);
    return NextResponse.json({ article }, { headers: { "Cache-Control": "private, no-store" } });
  }
  const articles = await listArticlesForAdmin();
  return NextResponse.json(
    { articles: articles.map(({ body_md, analysis_md, ...rest }) => rest) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return jsonError("Owner or staff access required.", 403);

  // Cost control on the AI-adjacent draft-assembly path.
  const limit = await rateLimit({ key: `pulse:workflow:${staff.user.id}`, max: 40, windowMinutes: 60 });
  if (!limit.allowed) return jsonError("Workflow limit reached (40/hour).", 429);

  const body = (await request.json().catch(() => null)) as null | {
    action?: string;
    category?: unknown;
    externalKeys?: unknown;
    id?: unknown;
    headline?: unknown;
    summary?: unknown;
    analysis?: unknown;
    body?: unknown;
    changeNote?: unknown;
    status?: unknown;
    version?: unknown;
  };
  if (!body?.action) return jsonError("An action is required.", 400);

  // ---- Create a draft from selected trend observations --------------------
  if (body.action === "create_draft") {
    const category = typeof body.category === "string" ? body.category : "";
    if (!isPulseCategory(category)) return jsonError("A valid category is required.", 400);
    const keys = Array.isArray(body.externalKeys)
      ? body.externalKeys.filter((k): k is string => typeof k === "string").slice(0, 10)
      : [];
    if (!keys.length) return jsonError("Select at least one trend to draft from.", 400);

    const fetched = await fetchTrends(category);
    if (!fetched.ok) return jsonError(`Trend provider unavailable: ${fetched.error}`, 502);
    const selected = fetched.trends.filter((t) => keys.includes(t.externalKey));
    if (!selected.length) return jsonError("The selected trends are no longer in the current feed.", 409);

    const def = PULSE_CATEGORIES.find((c) => c.id === category)!;
    const { buildDraftFromTrends, slugify } = await import("@/lib/pulse/articles");
    const draft = buildDraftFromTrends({
      category,
      categoryLabel: def.label,
      trends: selected,
      retrievedAt: fetched.fetchedAt,
      providerMeasures: getProviderLabel(),
    });
    if (!draft) return jsonError("No usable trend data for a draft.", 400);

    const result = await createArticle({
      category,
      headline: draft.headline,
      altHeadline: draft.altHeadline,
      summary: draft.summary,
      body: draft.body,
      analysis: draft.analysis,
      tags: draft.tags,
      userId: staff.user.id,
      sources: selected.map((t) => ({
        title: t.title,
        url: t.url,
        publisher: t.sourceLabel,
        publishedAt: t.publishedAt,
        retrievedAt: fetched.fetchedAt,
      })),
    });
    if (!result.ok) return jsonError(result.error, 500);
    return NextResponse.json({ ok: true, slug: result.slug, message: "Draft created with sourced references attached." });
  }

  // ---- Edit (versioned) ----------------------------------------------------
  if (body.action === "save_revision") {
    if (
      typeof body.id !== "string" ||
      typeof body.headline !== "string" ||
      typeof body.summary !== "string" ||
      typeof body.body !== "string" ||
      typeof body.analysis !== "string"
    )
      return jsonError("Headline, summary, body, and analysis are required.", 400);
    if (body.headline.trim().length < 4) return jsonError("The headline is too short.", 400);
    const result = await saveArticleRevision({
      id: body.id,
      headline: body.headline.trim(),
      summary: body.summary.trim(),
      body: body.body,
      analysis: body.analysis,
      changeNote: typeof body.changeNote === "string" ? body.changeNote : "edited",
      userId: staff.user.id,
    });
    return result.ok
      ? NextResponse.json({ ok: true, message: "Saved. The prior version is preserved for rollback." })
      : jsonError(result.error, 400);
  }

  // ---- Rollback --------------------------------------------------------------
  if (body.action === "rollback") {
    if (typeof body.id !== "string" || typeof body.version !== "number")
      return jsonError("An article id and version are required.", 400);
    const result = await rollbackToRevision({ id: body.id, version: body.version, userId: staff.user.id });
    return result.ok
      ? NextResponse.json({ ok: true, message: `Rolled back to version ${body.version} (recorded as a new revision).` })
      : jsonError(result.error, 400);
  }

  // ---- Workflow status transitions -----------------------------------------
  if (body.action === "set_status") {
    const status = typeof body.status === "string" ? body.status : "";
    if (!["draft", "in_review", "approved", "published", "withdrawn", "archived"].includes(status))
      return jsonError("A valid status is required.", 400);
    if (typeof body.id !== "string") return jsonError("An article id is required.", 400);
    const result = await changeStatus({
      id: body.id,
      to: status as "draft" | "in_review" | "approved" | "published" | "withdrawn" | "archived",
      userId: staff.user.id,
      isOwner: staff.isOwner,
      note: typeof body.changeNote === "string" ? body.changeNote : "status changed",
    });
    return result.ok
      ? NextResponse.json({ ok: true, message: `Status set to ${status}.` })
      : jsonError(result.error, 400);
  }

  return jsonError("Unknown action.", 400);
}

function getProviderLabel(): string {
  return "News coverage volume & recency — not search interest.";
}
