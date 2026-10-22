import type { OfficeSection } from "@/lib/office";

/**
 * President's Office — seeded documentation and findings.
 *
 * EVERY entry below reflects verified evidence from the actual October 2026
 * platform audit (commands run, files inspected, results recorded). Nothing
 * here is aspirational. Where something is unverified, it says so.
 */

export type SeedDoc = {
  slug: string;
  section: OfficeSection;
  title: string;
  body: string;
};

export const OFFICE_SEED_DOCUMENTS: SeedDoc[] = [
  {
    slug: "architecture-overview",
    section: "architecture",
    title: "System architecture",
    body: `## Stack (verified from package.json and source)

- **Framework:** Next.js 16.4.0 / React 19, App Router, server components.
- **Language:** TypeScript 5.7.3. \`npx tsc --noEmit\` passes as of 2026-10-26.
- **Styling:** Tailwind CSS 4 (via @tailwindcss/postcss), custom design tokens in \`app/globals.css\`.
- **Database:** PostgreSQL via Supabase. Two access paths: direct \`pg\` pool (\`lib/db\`) for server-only data (roles, secrets, webhook log) and Supabase-js with RLS for user-owned data.
- **Auth:** Supabase Auth (sessions, email confirmation, OAuth Google). Better Auth is installed and configured (\`lib/auth.ts\`) but the active member flow is Supabase-based.
- **Billing:** Stripe subscriptions; server-side quota enforcement in \`app/api/domain-security/route.ts\`.
- **Hosting:** Cloudflare Workers via @opennextjs/cloudflare (\`pnpm preview\` / \`pnpm deploy\`).

## Key modules

| Module | Entry | Notes |
| --- | --- | --- |
| Domain investigation | \`/demo\`, \`/workspace\` | Public DNS only; evidence-led scoring |
| IP dossiers | \`/workspace\` | Owner/staff only; public-registry data |
| Threat radar | \`/demo\`, live feed | CISA KEV + optional AbuseIPDB |
| Food truck tracker | \`/food-trucks\` | License-verified operators |
| Awards & achievements | \`/awards\` | Private, per-user, signed URLs |
| Admin control plane | \`/admin\` | Owner only; staff invites, integrations |
| Mobile bottom nav | root layout | < 760px; Home-centered |`,
  },
  {
    slug: "security-controls",
    section: "security",
    title: "Security controls & verification evidence",
    body: `## Verified controls (with the check that proved them)

- **Fail-closed role resolution** — \`lib/roles.ts\`; covered by \`tests/roles.test.mjs\` (registry outage degrades to member, never elevates).
- **Dual-layer ownership** — every user-data query filters \`user_id\` AND relies on RLS (awards, dossiers, investigations, assistant messages). Verified by reading \`supabase/migrations/20261019100000_app_tables.sql\` and \`20261022160000_awards.sql\`.
- **Encrypted integration secrets** — AES-256-GCM, scrypt-derived key, server-only decryption (\`lib/integration-secrets.ts\`). Values never returned by any API; only a boolean + fingerprint.
- **Webhook idempotency** — \`processed_webhook_event\` table with unique PK; duplicate deliveries return \`{ duplicate: true }\` without re-applying state. Fail-closed 503 if the log is unreachable.
- **Upload hardening** — magic-byte sniffing for awards (PNG/JPEG/GIF/WebP/PDF), 8 MB cap, orphan cleanup on failed DB write, storage RLS scoped to \`auth.uid()\`.
- **Error redaction** — \`lib/redact.ts\` strips connection strings, bearer tokens, Stripe keys before any error reaches a client.
- **Security headers** — X-Content-Type-Options, Referrer-Policy, HSTS, Permissions-Policy (camera self-only, mic denied) in \`next.config.mjs\`.

## Explicitly NOT verified

- No independent penetration test or formal certification has occurred. Nothing in this library may be read as claiming one.
- Production Stripe mode, real email delivery, and live provider keys remain untested (see findings register).`,
  },
  {
    slug: "qa-results",
    section: "testing",
    title: "QA & build results (2026-10-26 session)",
    body: `## Commands actually run (all exit 0)

| Command | Result | Date |
| --- | --- | --- |
| \`npx tsc --noEmit\` | pass | 2026-10-26 |
| \`pnpm test\` (4 suites: auth-callback, roles, integrations, awards) | all PASS | 2026-10-26 |
| \`pnpm build\` (production) | pass; routes incl. /reset-password, /help, /settings compiled | 2026-10-26 |
| Dev-server HTTP checks | /reset-password 200 + form present; /sign-in shows Forgot-password link; /help 200; /settings 200; homepage renders mobile-bottom-nav | 2026-10-26 |

## Reproduction

\`\`\`bash
npx tsc --noEmit
pnpm test
pnpm build
\`\`\`

## Coverage limits

- Tests are pure-logic (no live database). Authorization is verified by reading SQL/RLS and by code inspection, not by live cross-account integration tests — those require two provisioned test accounts in the Supabase project (owner action).
- No browser automation suite exists yet; render checks were manual HTTP fetches with content assertions.`,
  },
  {
    slug: "operations-status",
    section: "operations",
    title: "Operations: integrations, costs, procedures",
    body: `## Integration status (verified 2026-10-26)

| Integration | Where configured | Status |
| --- | --- | --- |
| Supabase Postgres | DATABASE_URL env | configured locally; **migration status on live project is an owner action** |
| Stripe | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET | code complete; **no test keys present** — untested live |
| AI features | AI_GATEWAY_API_KEY or admin-stored key | not configured; features degrade with honest 503 |
| AbuseIPDB | encrypted admin storage | supports the radar + IP dossiers; owner adds key via /admin |
| CISA KEV | keyless public feed | working |
| Google OAuth | GOOGLE_CLIENT_ID/SECRET | env-gated; Supabase provider must be enabled by owner |

## Cost picture (estimates, not quotes)

- **Supabase:** current usage fits the free tier through beta; the paid Pro tier (≈$25/mo) becomes necessary when storage or egress grows.
- **Stripe:** 2.9% + $0.30 per successful card charge (US standard). No fixed cost.
- **AI features:** token-metered via the configured gateway key; owner-set budget cap recommended before enabling member-facing AI.
- **Hosting:** Cloudflare Workers paid plan required at scale; current preview/deploy is free-tier viable for low traffic.

## Support procedure

1. Check \`/admin\` → diagnostics (DB ping, schema inspection, provider tests — all read-only).
2. Check this office's findings register for known issues.
3. Escalate by adding a finding with severity and evidence. Do not delete closed findings — they are the audit trail.`,
  },
  {
    slug: "founder-archive",
    section: "archive",
    title: "Founder & development archive",
    body: `## Honest provenance

Development of AUGI.space is a human/AI collaboration. Architecture, product direction, security boundaries, and editorial voice are directed by the founder; implementation is pair-written with AI coding assistants, then reviewed and committed by the founder. **No entry in this archive should be read as claiming sole human authorship of every line.**

## Dated milestones

- **2026-10-19** — app tables (investigations, dossiers, assistant messages) with RLS.
- **2026-10-22** — roles/billing/integrations migration; webhook idempotency; awards table + private bucket.
- **2026-10-23** — food truck tracker schema with license-verification protection.
- **2026-10-24** — site media bucket + owner upload slots.
- **2026-10-25/26** — security hardening: app_users privacy, comment sanitization constraints, moderation policy, duplicate-trigger cleanup.
- **2026-10-26 session** — password recovery flow shipped (\`/reset-password\`), recovery-aware auth callback, member-friendly sign-up copy, complete admin migration checklist, mobile bottom navigation + /help + /settings, all tests/build green.

## Lessons learned

- Webhook idempotency belongs in the data layer, not application memory — the \`processed_webhook_event\` decision followed a replay-bug investigation.
- Fail-closed role resolution made the auth-callback outage behavior testable and removed an entire class of race conditions.
- Migrations written idempotently (\`if not exists\`, drop-then-create triggers) proved their worth when re-running against the live project.`,
  },
  {
    slug: "public-claims-register",
    section: "claims",
    title: "Public claims register",
    body: `## Approved for public use

| Claim | Evidence | Verified |
| --- | --- | --- |
| "AUGI checks public email-domain DNS signals (MX, SPF, DMARC)" | \`app/api/domain-security/route.ts\` | 2026-10-26 |
| "AUGI never accesses your inbox" | architecture: no inbox APIs called anywhere | 2026-10-26 |
| "Every contact on the radar comes from a named, verifiable public feed" | \`lib/live-threat-feed.ts\` notes field | 2026-10-26 |
| "Your numbers never leave this browser tab" (budget planner) | \`components/budget-planner.tsx\` — localStorage only, no API call | 2026-10-26 |

## Not approved (lacks evidence — do not publish)

- Any claim of certification, compliance assessment, or independent security audit.
- "Most advanced" / "first" / "fully secure" superlatives.
- Customer counts, testimonials, or review metrics (none exist).
- Any claim that an IP location identifies a person.

**Rule:** a claim enters this register only with a verifiable file reference and a verification date. Superlatives require external evidence that does not currently exist.`,
  },
];

export type SeedFinding = {
  ref: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  component: string;
  title: string;
  description: string;
  evidence: string;
  status: "open" | "mitigated" | "closed" | "accepted_risk";
  remediation_note?: string;
  retest_note?: string;
};

export const OFFICE_SEED_FINDINGS: SeedFinding[] = [
  {
    ref: "FIND-001",
    severity: "medium",
    component: "API surface",
    title: "No application-level rate limiting on public POST endpoints",
    description:
      "Public endpoints (domain check, food-truck comments) rely on Supabase/Cloudflare platform limits only. A dedicated limiter would bound abuse cost and quota consumption.",
    evidence:
      "grep for rate-limit patterns across app/api — only platform-level references found.",
    status: "open",
  },
  {
    ref: "FIND-002",
    severity: "high",
    component: "Billing",
    title: "Stripe integration untested against live/test API",
    description:
      "Checkout, webhook handling, portal, and dispute flows are code-complete and reviewed, but no STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET is configured in this environment, so none of it has executed against Stripe.",
    evidence:
      "Admin integrations panel lists STRIPE_SECRET_KEY as missing; no test-mode run performed.",
    status: "open",
  },
  {
    ref: "FIND-003",
    severity: "medium",
    component: "Database",
    title: "Production migration application unverified",
    description:
      "All 8 migrations are reviewed and idempotent, but applying them to the live Supabase project requires owner action (SQL editor or apply script with credentials this environment must not hold).",
    evidence:
      "scripts/apply-migration.mjs and scripts/verify-migrations.js exist and are committed; neither was run (no credentials).",
    status: "open",
  },
  {
    ref: "FIND-004",
    severity: "low",
    component: "AI features",
    title: "AI gateway key absent — features degrade honestly",
    description:
      "Copilot, domain AI explanations, and image analysis return an honest 503 directing the owner to the admin panel. Not a defect: confirmation that no fabricated AI output can occur without a key.",
    evidence:
      "ensureAiCredentials() returns false without a configured key; routes map that to 503.",
    status: "mitigated",
    remediation_note:
      "Owner adds AI_GATEWAY_API_KEY or stores the key via /admin → Integrations.",
  },
  {
    ref: "FIND-005",
    severity: "info",
    component: "Documentation",
    title: "No independent security audit or certification exists",
    description:
      "Recorded to prevent accidental public claims. All security statements are code-review-based. If a formal audit is ever commissioned, its report replaces this entry as evidence.",
    evidence:
      "This entry is the assertion; there is no contrary evidence to cite.",
    status: "accepted_risk",
  },
];
