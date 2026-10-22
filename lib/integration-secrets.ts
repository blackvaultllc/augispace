import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { eq } from "drizzle-orm";
import { pool } from "@/lib/db";

/**
 * Server-side secret storage for third-party integration credentials.
 *
 * Values are encrypted with AES-256-GCM before they ever touch the database.
 * The key is derived (scrypt) from the INTEGRATION_SECRET environment variable,
 * which lives only on the server. Encrypted values are never returned through
 * the public API — RLS also blocks all reads for authenticated users.
 */

const TABLE = "integration_settings";

function getSecretKey() {
  const secret =
    process.env.INTEGRATION_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!secret)
    throw new Error("INTEGRATION_SECRET is not configured on the server.");
  return scryptSync(secret, "augispace:integration:v1", 32);
}

function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getSecretKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${enc.toString("base64")}`;
}

function decrypt(payload: string) {
  const [version, ivB64, tagB64, dataB64] = payload.split(".");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64)
    throw new Error("Stored secret is not a valid v1 payload.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getSecretKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Store (or overwrite) a secret for a named integration, e.g. "abuseipdb_api_key". */
export async function setIntegrationSecret(
  key: string,
  value: string,
  updatedBy?: string,
) {
  const valueEnc = encrypt(value.trim());
  await pool.query(
    `insert into integration_settings (key, value_enc, updated_by, updated_at)
     values ($1, $2, $3, now())
     on conflict (key) do update set value_enc = excluded.value_enc, updated_by = excluded.updated_by, updated_at = now()`,
    [key, valueEnc, updatedBy ?? null],
  );
}

/** Remove a stored secret. */
export async function deleteIntegrationSecret(key: string) {
  await pool.query("delete from integration_settings where key = $1", [key]);
}

/** Read and decrypt a secret; returns null when missing or undecryptable. */
export async function getIntegrationSecret(
  key: string,
): Promise<string | null> {
  try {
    const result = await pool.query<{ value_enc: string }>(
      "select value_enc from integration_settings where key = $1",
      [key],
    );
    const row = result.rows[0];
    if (!row) return null;
    return decrypt(row.value_enc);
  } catch {
    return null;
  }
}

/** Whether a secret exists, plus when it last changed. Never returns the value. */
export async function getIntegrationStatus(
  key: string,
): Promise<{ configured: boolean; updatedAt: string | null }> {
  const result = await pool.query<{ updated_at: string | null }>(
    "select updated_at from integration_settings where key = $1",
    [key],
  );
  const row = result.rows[0];
  return {
    configured: !!row,
    updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

export const INTEGRATION_KEYS = {
  abuseipdb: "abuseipdb_api_key",
} as const;

export type IntegrationKey =
  (typeof INTEGRATION_KEYS)[keyof typeof INTEGRATION_KEYS];

export function isIntegrationKey(value: string): value is IntegrationKey {
  return Object.values(INTEGRATION_KEYS).includes(value as IntegrationKey);
}

export function integrationKeyFingerprint(key: string) {
  const secret =
    process.env.INTEGRATION_SECRET || process.env.BETTER_AUTH_SECRET || "";
  return createHash("sha256")
    .update(secret + key)
    .digest("hex")
    .slice(0, 12);
}
