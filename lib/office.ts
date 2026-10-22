import { pool } from "@/lib/db";
import { resolveRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

/**
 * President's Office data layer.
 *
 * Access model: the owner-only guard mirrors app/api/admin/route.ts.
 * All reads/writes go through the direct Postgres pool, which bypasses the
 * (deny-all) RLS on the office_* tables — the PostgREST API can never touch
 * these rows, even for authenticated users.
 *
 * Documents are seeded from typed source files in this repository and are
 * versioned: every edit writes an office_document_revisions row with the
 * previous body, so history cannot be silently rewritten. Seeding is
 * additive-only (insert if the slug is missing) and never overwrites edits
 * made in the app.
 */

export type OfficeSection =
  | "architecture"
  | "security"
  | "testing"
  | "operations"
  | "archive"
  | "claims";

export const OFFICE_SECTIONS: { id: OfficeSection; label: string; blurb: string }[] = [
  { id: "architecture", label: "Architecture & engineering", blurb: "System shape, dependencies, routes, schema, procedures." },
  { id: "security", label: "Security & privacy", blurb: "Controls that exist, evidence for them, and residual risk." },
  { id: "testing", label: "Testing & QA", blurb: "Actual command results, dates, and reproducible steps." },
  { id: "operations", label: "Business & operations", blurb: "Integration status, costs, support procedures, policies." },
  { id: "archive", label: "Founder archive", blurb: "Real development history — human and AI-assisted, dated." },
  { id: "claims", label: "Public claims register", blurb: "Every public claim, its evidence, and its approval status." },
];

export type OfficeDocument = {
  id: string;
  slug: string;
  section: OfficeSection;
  title: string;
  body_md: string;
  version: number;
  updated_at: string;
};

export type OfficeFinding = {
  id: string;
  ref: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  component: string;
  title: string;
  description: string;
  evidence: string;
  status: "open" | "mitigated" | "closed" | "accepted_risk";
  discovered_at: string;
  remediation_note: string | null;
  retest_note: string | null;
  closed_at: string | null;
};

export async function requireOwner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const role = await resolveRole(user.id, user.email);
  if (role.role !== "owner") return null;
  return user;
}

export async function listDocuments(): Promise<OfficeDocument[]> {
  const result = await pool.query<OfficeDocument>(
    `select id, slug, section, title, body_md, version, updated_at
     from public.office_documents order by section, title`,
  );
  return result.rows;
}

export async function getDocument(slug: string): Promise<OfficeDocument | null> {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const result = await pool.query<OfficeDocument>(
    `select id, slug, section, title, body_md, version, updated_at
     from public.office_documents where slug = $1`,
    [slug],
  );
  return result.rows[0] ?? null;
}

export async function saveDocument(opts: {
  slug: string;
  body: string;
  changeNote: string;
  userId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const current = await getDocument(opts.slug);
  if (!current) return { ok: false, error: "Unknown document." };
  const nextVersion = current.version + 1;
  const client = await pool.connect();
  try {
    await client.query("begin");
    // Preserve the current body as a revision before overwriting it.
    await client.query(
      `insert into public.office_document_revisions (document_id, version, body_md, change_note, changed_by)
       values ($1, $2, $3, $4, $5)`,
      [current.id, current.version, current.body_md, opts.changeNote.slice(0, 500), opts.userId],
    );
    await client.query(
      `update public.office_documents
       set body_md = $2, version = $3, updated_by = $4, updated_at = now()
       where id = $1`,
      [current.id, opts.body, nextVersion, opts.userId],
    );
    await client.query("commit");
    return { ok: true };
  } catch {
    await client.query("rollback").catch(() => undefined);
    return { ok: false, error: "The document could not be saved." };
  } finally {
    client.release();
  }
}

export async function listRevisions(documentId: string) {
  const result = await pool.query<{ version: number; change_note: string; created_at: string }>(
    `select version, change_note, created_at from public.office_document_revisions
     where document_id = $1 order by version desc limit 50`,
    [documentId],
  );
  return result.rows;
}

export async function listFindings(): Promise<OfficeFinding[]> {
  const result = await pool.query<OfficeFinding>(
    `select id, ref, severity, component, title, description, evidence, status,
            discovered_at, remediation_note, retest_note, closed_at
     from public.office_findings
     order by case severity when 'critical' then 0 when 'high' then 1 when 'medium' then 2 when 'low' then 3 else 4 end,
              discovered_at desc`,
  );
  return result.rows;
}

export async function updateFindingStatus(opts: {
  id: string;
  status: OfficeFinding["status"];
  note: string;
  userId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(opts.id)) return { ok: false, error: "Invalid finding id." };
  const client = await pool.connect();
  try {
    await client.query("begin");
    const current = await client.query<{ status: string }>(
      "select status from public.office_findings where id = $1 for update",
      [opts.id],
    );
    const from = current.rows[0]?.status ?? null;
    if (!from) throw new Error("missing");
    await client.query(
      `update public.office_findings
       set status = $2,
           remediation_note = case when $2 in ('mitigated','closed') then coalesce(remediation_note, $3) else remediation_note end,
           retest_note = case when $2 = 'closed' then $3 else retest_note end,
           closed_at = case when $2 in ('closed','accepted_risk') then now() else closed_at end,
           updated_at = now()
       where id = $1`,
      [opts.id, opts.status, opts.note.slice(0, 1000)],
    );
    await client.query(
      `insert into public.office_finding_history (finding_id, changed_by, from_status, to_status, note)
       values ($1, $2, $3, $4, $5)`,
      [opts.id, opts.userId, from, opts.status, opts.note.slice(0, 1000)],
    );
    await client.query("commit");
    return { ok: true };
  } catch {
    await client.query("rollback").catch(() => undefined);
    return { ok: false, error: "The finding could not be updated." };
  } finally {
    client.release();
  }
}

/** Seed documents/findings from the repository source of truth. Additive only. */
export async function seedOfficeContent() {
  for (const doc of OFFICE_SEED_DOCUMENTS) {
    await pool.query(
      `insert into public.office_documents (slug, section, title, body_md)
       values ($1, $2, $3, $4) on conflict (slug) do nothing`,
      [doc.slug, doc.section, doc.title, doc.body],
    ).catch(() => undefined);
  }
  for (const finding of OFFICE_SEED_FINDINGS) {
    await pool.query(
      `insert into public.office_findings (ref, severity, component, title, description, evidence, status, remediation_note, retest_note)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) on conflict (ref) do nothing`,
      [finding.ref, finding.severity, finding.component, finding.title, finding.description, finding.evidence, finding.status, finding.remediation_note ?? null, finding.retest_note ?? null],
    ).catch(() => undefined);
  }
}

type SeedDoc = { slug: string; section: OfficeSection; title: string; body: string };
type SeedFinding = {
  ref: string;
  severity: OfficeFinding["severity"];
  component: string;
  title: string;
  description: string;
  evidence: string;
  status: OfficeFinding["status"];
  remediation_note?: string;
  retest_note?: string;
};

import {
  OFFICE_SEED_DOCUMENTS,
  OFFICE_SEED_FINDINGS,
} from "@/lib/office-seed";
export { OFFICE_SEED_DOCUMENTS, OFFICE_SEED_FINDINGS };
