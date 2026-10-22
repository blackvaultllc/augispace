import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveRole } from "@/lib/roles";
import {
  getIntegrationSecret,
  getIntegrationStatus,
  integrationKeyFingerprint,
  setIntegrationSecret,
  deleteIntegrationSecret,
  INTEGRATION_KEYS,
  isIntegrationKey,
} from "@/lib/integration-secrets";
import { INTEGRATION_CATALOG } from "@/lib/integration-catalog";
import { redact } from "@/lib/redact";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Owner-only integrations API.
 *
 * Security properties:
 * - Every action re-verifies the session and resolves the role from the
 *   server-side registry (fail-closed). No action relies on client data.
 * - Secret VALUES are never returned; only a boolean and a short fingerprint.
 * - Database connection strings, passwords, and raw provider errors are never
 *   echoed — every failure is mapped to a sanitized diagnostic message.
 * - New credentials are validated (live, where possible) BEFORE replacing the
 *   stored value; a failed validation leaves the current config untouched.
 * - The API is strictly read-only against the database (SELECT 1 + catalog
 *   queries). It cannot run migrations or modify data.
 */

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

// Diagnostics are sanitized through lib/redact before leaving the server.

async function requireOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const role = await resolveRole(user.id, user.email);
  if (role.role !== "owner") return null;
  return user;
}

type CatalogStatus = {
  id: string;
  label: string;
  description: string;
  envVar: string | null;
  storage: string;
  envOnly: boolean;
  configured: boolean;
  fingerprint: string | null;
  updatedAt: string | null;
  test: string | null;
};

async function buildStatus(): Promise<CatalogStatus[]> {
  const statuses = await Promise.all(
    INTEGRATION_CATALOG.map(async (entry) => {
      if (entry.storage === "encrypted_db" && entry.secretKey) {
        const status = await getIntegrationStatus(entry.secretKey).catch(
          () => ({
            configured: false,
            updatedAt: null,
          }),
        );
        let fingerprint: string | null = null;
        if (status.configured) {
          fingerprint = integrationKeyFingerprint(entry.secretKey);
        }
        return {
          id: entry.id,
          label: entry.label,
          description: entry.description,
          envVar: entry.envVar,
          storage: entry.storage,
          envOnly: entry.envOnly,
          configured: status.configured,
          fingerprint,
          updatedAt: status.updatedAt,
          test: entry.test ?? null,
        };
      }
      // env / public entries: presence only, never the value.
      const configured = !!entry.envVar && !!process.env[entry.envVar];
      return {
        id: entry.id,
        label: entry.label,
        description: entry.description,
        envVar: entry.envVar,
        storage: entry.storage,
        envOnly: entry.envOnly,
        configured,
        fingerprint: null,
        updatedAt: null,
        test: entry.test ?? null,
      };
    }),
  );
  return statuses;
}

export async function GET() {
  const user = await requireOwner();
  if (!user) return jsonError("Owner access only.", 403);

  const [integrations, missing] = [
    await buildStatus(),
    // Which env var NAMES the code expects but the runtime does not have.
    [
      "DATABASE_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "BETTER_AUTH_URL",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "AI_GATEWAY_API_KEY",
    ].filter((name) => !process.env[name]),
  ];

  return NextResponse.json(
    {
      integrations,
      missingEnvVars: missing,
      secretStorage: {
        kind: "encrypted_db",
        detail:
          "Secrets are encrypted with AES-256-GCM (server-side key) in the integration_settings table. Deployment-level env vars cannot be changed from this console; set them in your hosting dashboard.",
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const user = await requireOwner();
  if (!user) return jsonError("Owner access only.", 403);

  const body = (await request.json().catch(() => null)) as null | {
    action?: string;
    key?: string;
    value?: string;
  };
  if (!body?.action) return jsonError("An action is required.", 400);

  // ---- Store a secret (with validation before activation) ------------------
  if (body.action === "save_secret") {
    const key = body.key ?? "";
    const value = (body.value ?? "").trim();
    if (!isIntegrationKey(key)) return jsonError("Unknown integration.", 400);
    if (!value) return jsonError("Paste the credential value.", 400);

    // Validate before activating: a failed validation keeps the current value.
    if (key === INTEGRATION_KEYS.abuseipdb) {
      const ok = await validateAbuseIpdbKey(value);
      if (!ok)
        return jsonError(
          "The AbuseIPDB API key was rejected by the AbuseIPDB check. The existing configuration is unchanged.",
          400,
        );
    }

    try {
      await setIntegrationSecret(key, value, user.id);
    } catch {
      return jsonError(
        "The credential could not be stored. No changes were made.",
        500,
      );
    }
    return NextResponse.json({
      ok: true,
      message:
        "Credential validated and stored encrypted. The value never leaves the server.",
      fingerprint: integrationKeyFingerprint(key),
    });
  }

  if (body.action === "delete_secret") {
    const key = body.key ?? "";
    if (!isIntegrationKey(key)) return jsonError("Unknown integration.", 400);
    try {
      await deleteIntegrationSecret(key);
    } catch {
      return jsonError(
        "The credential could not be removed. No changes were made.",
        500,
      );
    }
    return NextResponse.json({
      ok: true,
      message: "Credential removed from server storage.",
    });
  }

  // ---- Read-only database connectivity test --------------------------------
  if (body.action === "test_db") {
    try {
      const started = Date.now();
      const ping = await pool.query("select 1 as ok");
      const tables = await pool.query<{ table_name: string }>(
        `select table_name from information_schema.tables
         where table_schema = 'public' and table_type = 'BASE TABLE'
         order by table_name`,
      );
      return NextResponse.json({
        ok: true,
        latencyMs: Date.now() - started,
        // Names only — no rows, no columns with data, no connection details.
        tables: tables.rows.map((r) => r.table_name),
        message:
          ping.rows[0]?.ok === 1
            ? "Database connection OK (read-only)."
            : "Unexpected ping result.",
      });
    } catch (error) {
      return jsonError(
        `Database connection failed: ${redact(error instanceof Error ? error.message : String(error))}`,
        502,
      );
    }
  }

  // ---- Read-only schema inspection (column names only) ---------------------
  if (body.action === "inspect_schema") {
    const table = typeof body.key === "string" ? body.key : "";
    if (!/^[a-z_][a-z0-9_]*$/.test(table))
      return jsonError("Invalid table name.", 400);
    try {
      const cols = await pool.query<{ column_name: string; data_type: string }>(
        `select column_name, data_type from information_schema.columns
         where table_schema = 'public' and table_name = $1
         order by ordinal_position`,
        [table],
      );
      return NextResponse.json({
        ok: true,
        table,
        columns: cols.rows, // names + types only; never row data
      });
    } catch (error) {
      return jsonError(
        `Schema inspection failed: ${redact(error instanceof Error ? error.message : String(error))}`,
        502,
      );
    }
  }

  // ---- Supabase REST health test -------------------------------------------
  if (body.action === "test_supabase_rest") {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key)
      return jsonError(
        "Supabase URL or anon key is not configured in this environment.",
        400,
      );
    try {
      const res = await fetch(`${url}/auth/v1/health`, {
        headers: { apikey: key },
        signal: AbortSignal.timeout(8000),
      });
      return NextResponse.json({
        ok: res.ok,
        message: res.ok
          ? "Supabase Auth API reachable."
          : `Supabase Auth API responded HTTP ${res.status}.`,
      });
    } catch {
      return jsonError(
        "Supabase Auth API could not be reached from this server.",
        502,
      );
    }
  }

  // ---- Stripe secret test (validate without storing) -----------------------
  if (body.action === "test_stripe") {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret)
      return jsonError(
        "STRIPE_SECRET_KEY is not configured in this environment.",
        400,
      );
    try {
      const res = await fetch("https://api.stripe.com/v1/balance", {
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(8000),
      });
      return NextResponse.json({
        ok: res.ok,
        message: res.ok
          ? "Stripe credentials valid (balance endpoint reachable)."
          : res.status === 401
            ? "Stripe rejected the key. The existing configuration is unchanged."
            : `Stripe responded HTTP ${res.status}.`,
      });
    } catch {
      return jsonError(
        "Stripe API could not be reached from this server.",
        502,
      );
    }
  }

  // ---- AbuseIPDB key test (validate without storing) -----------------------
  if (body.action === "test_abuseipdb") {
    const stored = await getIntegrationSecret(INTEGRATION_KEYS.abuseipdb).catch(
      () => null,
    );
    const key = stored ?? process.env.ABUSEIPDB_API_KEY ?? null;
    if (!key) return jsonError("No AbuseIPDB key is configured yet.", 400);
    const ok = await validateAbuseIpdbKey(key);
    return NextResponse.json({
      ok,
      message: ok
        ? "AbuseIPDB accepted the configured key."
        : "AbuseIPDB rejected the configured key.",
    });
  }

  return jsonError("Unknown action.", 400);
}

async function validateAbuseIpdbKey(value: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.abuseipdb.com/api/v2/check?ipAddress=9.9.9.9&maxAgeInDays=1`,
      {
        headers: { Key: value, Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}
