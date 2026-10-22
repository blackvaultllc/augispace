import { pool } from "@/lib/db";
import type { PulseTrend } from "@/lib/pulse/provider";

/**
 * Infinity Pulse — article service.
 *
 * Draft assembly is FACT-BASED: the body is built only from provider-sourced
 * headlines (title, publisher, URL, dates). The "analysis" field is clearly
 * labeled AI-generated narrative and is produced separately (only if the AI
 * key is configured) — the two are never merged, so the sourced/AI boundary
 * survives every transformation and render.
 *
 * Workflow: draft -> in_review -> approved -> published -> withdrawn/archived.
 * Every saved edit preserves the prior version as a revision (rollback-capable).
 * Only owner/staff can touch drafts; only the owner can approve/publish.
 */

export type PulseArticleRow = {
  id: string;
  slug: string;
  category: string;
  headline: string;
  alt_headline: string | null;
  summary: string;
  body_md: string;
  analysis_md: string;
  seo_title: string;
  meta_description: string;
  tags: string[];
  status:
    | "draft"
    | "in_review"
    | "approved"
    | "published"
    | "withdrawn"
    | "archived";
  reviewed_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const HISTORY_LIMIT = 100;

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90) || "untitled"
  );
}

/** Factual body assembled only from the source rows. */
export function buildDraftFromTrends(opts: {
  category: string;
  categoryLabel: string;
  trends: PulseTrend[];
  retrievedAt: string;
  providerMeasures: string;
}) {
  const usable = opts.trends.slice(0, 10);
  if (usable.length === 0) {
    return null; // caller decides how to surface "no data"
  }
  const lines: string[] = [];
  lines.push(
    `Trend observations for **${opts.categoryLabel}** — retrieved ${new Date(opts.retrievedAt).toISOString().slice(0, 16).replace("T", " ")} UTC.`,
  );
  lines.push(`_Data source: ${opts.providerMeasures}_`);
  lines.push("");
  lines.push("## Headlines in this window");
  for (const t of usable) {
    const when = t.publishedAt
      ? ` (${new Date(t.publishedAt).toISOString().slice(0, 10)})`
      : "";
    lines.push(`- [${t.title}](${t.url}) — ${t.sourceLabel}${when}`);
  }
  lines.push("");
  lines.push(
    `_These are attributed headlines from the provider feed. No outcome, market movement, or event fact is asserted beyond what each source headline states._`,
  );

  const analysis = [
    `**AI-generated analysis (clearly separated from sourced facts).** Based only on the ${usable.length} headlines above: apparent topic clusters and emphasis, with the explicit caveat that news coverage volume is not proof of importance, causation, or outcome.`,
    "",
    "Suggested angles (for the human reviewer to verify or discard):",
    ...usable.slice(0, 3).map((t) => `- Verify independently: ${t.title}`),
  ].join("\n");

  const headline = `${opts.categoryLabel}: ${usable[0].title.slice(0, 80)}`;
  const altHeadline = `${opts.categoryLabel} pulse — ${usable.length} stories tracked`;
  const summary = `A sourced snapshot of current ${opts.categoryLabel.toLowerCase()} coverage: ${usable.length} attributed headlines with publisher, date, and retrieval timestamps. Factual claims live in the linked sources; AI commentary is separated below the fold.`;
  const tags = [opts.category, "infinity-pulse", "sourced"];

  return {
    headline,
    altHeadline,
    summary,
    body: lines.join("\n"),
    analysis,
    tags,
  };
}

export async function createArticle(opts: {
  category: string;
  headline: string;
  altHeadline: string | null;
  summary: string;
  body: string;
  analysis: string;
  tags: string[];
  userId: string;
  sources: {
    title: string;
    url: string;
    publisher: string;
    publishedAt: string | null;
    retrievedAt: string;
  }[];
}): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const base = slugify(opts.headline);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const inserted = await client.query<{ slug: string }>(
      `insert into public.pulse_articles
         (slug, category, headline, alt_headline, summary, body_md, analysis_md, seo_title, meta_description, tags, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       returning slug`,
      [
        base,
        opts.category,
        opts.headline.slice(0, 220),
        opts.altHeadline?.slice(0, 220) ?? null,
        opts.summary.slice(0, 500),
        opts.body.slice(0, 20_000),
        opts.analysis.slice(0, 8_000),
        opts.headline.slice(0, 60),
        opts.summary.slice(0, 160),
        opts.tags.slice(0, 10),
        opts.userId,
      ],
    );
    const slug = inserted.rows[0].slug;
    const articleId = await client.query<{ id: string }>(
      "select id from public.pulse_articles where slug = $1",
      [slug],
    );
    for (const s of opts.sources.slice(0, 20)) {
      await client.query(
        `insert into public.pulse_article_sources (article_id, title, url, publisher, published_at, retrieved_at, claim_note)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [
          articleId.rows[0].id,
          s.title.slice(0, 300),
          s.url.slice(0, 1000),
          s.publisher.slice(0, 120),
          s.publishedAt,
          s.retrievedAt,
          "",
        ],
      );
    }
    await client.query(
      `insert into public.pulse_article_history (article_id, changed_by, from_status, to_status, note)
       values ($1, $2, null, 'draft', $3)`,
      [articleId.rows[0].id, opts.userId, "created from trend research"],
    );
    await client.query("commit");
    return { ok: true, slug };
  } catch {
    await client.query("rollback").catch(() => undefined);
    return { ok: false, error: "The draft could not be created." };
  } finally {
    client.release();
  }
}

export async function saveArticleRevision(opts: {
  id: string;
  headline: string;
  summary: string;
  body: string;
  analysis: string;
  changeNote: string;
  userId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(opts.id))
    return { ok: false, error: "Invalid article id." };
  const client = await pool.connect();
  try {
    await client.query("begin");
    const current = await client.query<PulseArticleRow>(
      `select id, slug, headline, summary, body_md, analysis_md from public.pulse_articles where id = $1 for update`,
      [opts.id],
    );
    if (!current.rows[0]) throw new Error("missing");
    const revCount = await client.query<{ next: number }>(
      `select coalesce(max(version), 0) + 1 as next from public.pulse_article_revisions where article_id = $1`,
      [opts.id],
    );
    await client.query(
      `insert into public.pulse_article_revisions (article_id, version, headline, summary, body_md, analysis_md, change_note, changed_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        opts.id,
        revCount.rows[0].next,
        current.rows[0].headline,
        current.rows[0].summary,
        current.rows[0].body_md,
        current.rows[0].analysis_md,
        opts.changeNote.slice(0, 500),
        opts.userId,
      ],
    );
    await client.query(
      `update public.pulse_articles set headline = $2, summary = $3, body_md = $4, analysis_md = $5, updated_at = now() where id = $1`,
      [
        opts.id,
        opts.headline.slice(0, 220),
        opts.summary.slice(0, 500),
        opts.body.slice(0, 20_000),
        opts.analysis.slice(0, 8_000),
      ],
    );
    await client.query("commit");
    return { ok: true };
  } catch {
    await client.query("rollback").catch(() => undefined);
    return { ok: false, error: "The revision could not be saved." };
  } finally {
    client.release();
  }
}

export async function listRevisions(articleId: string) {
  const result = await pool.query(
    `select id, version, headline, change_note, created_at from public.pulse_article_revisions
     where article_id = $1 order by version desc limit ${HISTORY_LIMIT}`,
    [articleId],
  );
  return result.rows;
}

export async function getRevision(articleId: string, version: number) {
  const result = await pool.query(
    `select headline, summary, body_md, analysis_md, change_note, created_at from public.pulse_article_revisions
     where article_id = $1 and version = $2`,
    [articleId, version],
  );
  return result.rows[0] ?? null;
}

/** Restore a prior version: writes the current state as a new revision first. */
export async function rollbackToRevision(opts: {
  id: string;
  version: number;
  userId: string;
}) {
  const revision = await getRevision(opts.id, opts.version);
  if (!revision) return { ok: false as const, error: "Revision not found." };
  return saveArticleRevision({
    id: opts.id,
    headline: revision.headline,
    summary: revision.summary,
    body: revision.body_md,
    analysis: revision.analysis_md,
    changeNote: `rolled back to version ${opts.version}`,
    userId: opts.userId,
  });
}

const LEGAL_TRANSITIONS: Record<string, string[]> = {
  draft: ["in_review"],
  in_review: ["draft", "approved"],
  approved: ["published", "in_review"],
  published: ["withdrawn"],
  withdrawn: ["in_review", "archived"],
  archived: [],
};

export function canTransition(from: string, to: string): boolean {
  return (LEGAL_TRANSITIONS[from] ?? []).includes(to);
}

/** Status change with transition validation; publish requires prior approval. */
export async function changeStatus(opts: {
  id: string;
  to:
    | "draft"
    | "in_review"
    | "approved"
    | "published"
    | "withdrawn"
    | "archived";
  userId: string;
  isOwner: boolean;
  note: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(opts.id))
    return { ok: false, error: "Invalid article id." };
  const client = await pool.connect();
  try {
    await client.query("begin");
    const current = await client.query<{ status: string }>(
      "select status from public.pulse_articles where id = $1 for update",
      [opts.id],
    );
    const from = current.rows[0]?.status;
    if (!from) throw new Error("missing");
    if (!canTransition(from, opts.to)) {
      await client.query("rollback");
      return {
        ok: false,
        error: `Cannot move an article from ${from} to ${opts.to}.`,
      };
    }
    // Human approval gate: publishing requires an approved_by on record.
    if (opts.to === "published") {
      if (!opts.isOwner) {
        await client.query("rollback");
        return { ok: false, error: "Only the owner can publish." };
      }
      const approval = await client.query<{ approved_by: string | null }>(
        "select approved_by from public.pulse_articles where id = $1",
        [opts.id],
      );
      if (!approval.rows[0]?.approved_by) {
        await client.query("rollback");
        return {
          ok: false,
          error:
            "Publishing requires explicit approval first (submit for review, then approve).",
        };
      }
    }
    if (opts.to === "approved") {
      if (!opts.isOwner) {
        await client.query("rollback");
        return { ok: false, error: "Only the owner can approve." };
      }
      await client.query(
        "update public.pulse_articles set status = $2, approved_by = $3, approved_at = now(), reviewed_by = $3 where id = $1",
        [opts.id, opts.to, opts.userId],
      );
    } else if (opts.to === "published") {
      await client.query(
        "update public.pulse_articles set status = $2, published_at = now() where id = $1",
        [opts.id, opts.to],
      );
    } else {
      await client.query(
        "update public.pulse_articles set status = $2 where id = $1",
        [opts.id, opts.to],
      );
    }
    await client.query(
      `insert into public.pulse_article_history (article_id, changed_by, from_status, to_status, note)
       values ($1, $2, $3, $4, $5)`,
      [opts.id, opts.userId, from, opts.to, opts.note.slice(0, 500)],
    );
    await client.query("commit");
    return { ok: true };
  } catch {
    await client.query("rollback").catch(() => undefined);
    return { ok: false, error: "The status change could not be applied." };
  } finally {
    client.release();
  }
}

export async function listArticlesForAdmin() {
  const result = await pool.query<PulseArticleRow>(
    `select id, slug, category, headline, alt_headline, summary, body_md, analysis_md,
            seo_title, meta_description, tags, status, approved_by, approved_at, published_at, created_at, updated_at
     from public.pulse_articles order by updated_at desc limit 100`,
  );
  return result.rows;
}

export async function listPublishedArticles() {
  const result = await pool.query(
    `select slug, category, headline, summary, published_at, updated_at, tags
     from public.pulse_articles where status = 'published' order by published_at desc limit 50`,
  );
  return result.rows;
}

export async function getPublishedArticle(slug: string) {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const result = await pool.query(
    `select a.slug, a.category, a.headline, a.summary, a.body_md, a.analysis_md, a.published_at, a.updated_at, a.tags,
            coalesce(json_agg(json_build_object('title', s.title, 'url', s.url, 'publisher', s.publisher, 'publishedAt', s.published_at, 'retrievedAt', s.retrieved_at) order by s.retrieved_at) filter (where s.id is not null), '[]') as sources
     from public.pulse_articles a
     left join public.pulse_article_sources s on s.article_id = a.id
     where a.slug = $1 and a.status = 'published'
     group by a.id`,
    [slug],
  );
  return result.rows[0] ?? null;
}

export async function getArticleWithSources(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const result = await pool.query<PulseArticleRow>(
    `select id, slug, category, headline, alt_headline, summary, body_md, analysis_md, seo_title, meta_description,
            tags, status, approved_by, approved_at, published_at, created_at, updated_at
     from public.pulse_articles where id = $1`,
    [id],
  );
  const article = result.rows[0];
  if (!article) return null;
  const sources = await pool.query(
    `select title, url, publisher, published_at, retrieved_at from public.pulse_article_sources where article_id = $1 order by retrieved_at`,
    [id],
  );
  return { ...article, sources: sources.rows };
}
