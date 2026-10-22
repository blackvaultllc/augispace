/**
 * Declarative catalog of every integration the codebase uses.
 *
 * This is the single source of truth for the admin Integrations section:
 * - `envVar` names are safe to display (names only, never values).
 * - `storage: "env"` means the value lives only in deployment/local env vars.
 * - `storage: "encrypted_db"` means the value lives in the AES-256-GCM
 *   encrypted `integration_settings` table (server-only decryption).
 * - `storage: "public"` values are non-secret and safe to read (URLs/keys
 *   shipped to the browser by design).
 * - `envOnly: true` means the app cannot write it at runtime (deployment
 *   platform secrets) — the admin UI documents where to set it instead.
 */

export type IntegrationEntry = {
  id: string;
  label: string;
  description: string;
  envVar: string | null;
  storage: "env" | "encrypted_db" | "public";
  envOnly: boolean;
  /** Secret key name in the encrypted integration_settings table, when applicable. */
  secretKey?: string;
  /** Optional live validation action id. */
  test?: "stripe" | "supabase_rest" | "abuseipdb";
};

export const INTEGRATION_CATALOG: IntegrationEntry[] = [
  {
    id: "supabase",
    label: "Supabase / PostgreSQL",
    description:
      "Authentication, RLS-protected data, and the direct Postgres pool used by server code. The connection string is a credential: it is never returned by any API.",
    envVar: "DATABASE_URL",
    storage: "env",
    envOnly: true,
  },
  {
    id: "supabase_public",
    label: "Supabase project (public)",
    description:
      "Public project URL and anon key. Shipped to the browser by design; not a secret.",
    envVar: "NEXT_PUBLIC_SUPABASE_URL",
    storage: "public",
    envOnly: true,
    test: "supabase_rest",
  },
  {
    id: "stripe",
    label: "Stripe",
    description:
      "Subscription checkout and webhook signature verification. The secret key is validated with a live Stripe API call before it replaces the working configuration.",
    envVar: "STRIPE_SECRET_KEY",
    storage: "env",
    envOnly: true,
    test: "stripe",
  },
  {
    id: "stripe_webhook",
    label: "Stripe webhook signing secret",
    description:
      "Verifies webhook event signatures. Set as a deployment secret; rotating it requires the Stripe dashboard.",
    envVar: "STRIPE_WEBHOOK_SECRET",
    storage: "env",
    envOnly: true,
  },
  {
    id: "oauth_google",
    label: "Google OAuth",
    description:
      "Social sign-in provider credentials. Configured in the deployment environment.",
    envVar: "GOOGLE_CLIENT_ID",
    storage: "env",
    envOnly: true,
  },
  {
    id: "abuseipdb",
    label: "AbuseIPDB (IP reputation)",
    description:
      "Optional IP reputation lookups. Stored encrypted server-side; enter a replacement below. Validation performs a live check call before activating.",
    envVar: null,
    storage: "encrypted_db",
    envOnly: false,
    secretKey: "abuseipdb_api_key",
    test: "abuseipdb",
  },
  {
    id: "ai_gateway",
    label: "AI Gateway key",
    description:
      "Powers the copilot, analyst explanations and daily reports on Cloudflare. Stored encrypted server-side; enter a replacement below.",
    envVar: "AI_GATEWAY_API_KEY",
    storage: "encrypted_db",
    envOnly: false,
    secretKey: "ai_gateway_api_key",
  },
];

/** Names of env vars referenced by the codebase, for the missing-vars report. */
export const ALL_ENV_VAR_NAMES = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "BETTER_AUTH_URL",
  "BETTER_AUTH_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "AI_GATEWAY_API_KEY",
];
