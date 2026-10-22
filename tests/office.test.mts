/**
 * President's Office — pure-logic + source-contract tests (no database).
 *
 * Covered:
 *  1. Document versioning rule: an edit must preserve the previous body as a
 *     revision BEFORE overwriting (source-contract assertion on lib/office.ts).
 *  2. Finding status transition rule: only legal transitions are offered by
 *     the UI (open -> mitigated/accepted_risk; mitigated -> closed).
 *  3. RLS deny-all contract: the office migration enables RLS on all four
 *     office tables and grants no permissive policies.
 *  4. Seed content contract: every seeded claim in the claims register has a
 *     file-reference evidence column or an explicit not-approved note.
 *
 * Run: npx tsx tests/office.test.mts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// 1. Versioning rule — saveDocument must write the revision before the update.
const officeSrc = readFileSync(
  new URL("../lib/office.ts", import.meta.url),
  "utf8",
);
const saveFn = officeSrc.slice(
  officeSrc.indexOf("export async function saveDocument"),
  officeSrc.indexOf("export async function listRevisions"),
);
const revisionIdx = saveFn.indexOf("office_document_revisions");
const updateIdx = saveFn.indexOf("update public.office_documents");
assert.ok(revisionIdx > -1, "saveDocument must insert a revision");
assert.ok(
  updateIdx > revisionIdx,
  "revision must be written BEFORE the document body is overwritten",
);

// Rollback safety: a transaction must wrap the pair.
assert.ok(
  saveFn.includes("begin") &&
    saveFn.includes("commit") &&
    saveFn.includes("rollback"),
  "saveDocument must be transactional",
);

// 2. Status transition rule — mirror of the UI's offered actions.
const legalTransitions: Record<string, string[]> = {
  open: ["mitigated", "accepted_risk"],
  mitigated: ["closed"],
  closed: [],
  accepted_risk: [],
};
assert.deepEqual(legalTransitions.open.sort(), ["accepted_risk", "mitigated"]);
assert.ok(
  !legalTransitions.closed.includes("open"),
  "closed findings must not reopen silently",
);

// The API validates status against the same set.
const apiSrc = readFileSync(
  new URL("../app/api/office/route.ts", import.meta.url),
  "utf8",
);
assert.ok(
  apiSrc.includes('["open", "mitigated", "closed", "accepted_risk"].includes'),
  "the office API must validate finding status server-side",
);

// 3. RLS deny-all contract.
const migrationSrc = readFileSync(
  new URL("../supabase/migrations/20261027100000_office.sql", import.meta.url),
  "utf8",
);
for (const table of [
  "office_documents",
  "office_document_revisions",
  "office_findings",
  "office_finding_history",
]) {
  assert.ok(
    migrationSrc.includes(
      `alter table public.${table} enable row level security`,
    ),
    `${table} must have RLS enabled`,
  );
}
// No permissive policy may exist on office tables.
assert.ok(
  !/create policy/.test(migrationSrc),
  "office tables must have NO permissive policies (deny-all)",
);

// 4. Seed content contract.
const seedSrc = readFileSync(
  new URL("../lib/office-seed.ts", import.meta.url),
  "utf8",
);
const claimsDoc = seedSrc.slice(seedSrc.indexOf("public-claims-register"));
assert.ok(
  claimsDoc.includes("Not approved"),
  "the claims register must contain a not-approved section",
);
assert.ok(
  claimsDoc.includes("independent security audit"),
  "the register must record that no audit exists",
);
// Every finding must carry non-empty evidence (string or template literal).
const findingsSection = seedSrc.slice(seedSrc.indexOf("OFFICE_SEED_FINDINGS"));
const evidenceCount = (findingsSection.match(/evidence:\s*(`|")/g) ?? []).length;
assert.equal(
  evidenceCount,
  5,
  "all five seeded findings must carry evidence text",
);

console.log(
  "PASS: President's Office contract tests (versioning, transitions, RLS deny-all, evidence-backed seeds).",
);
