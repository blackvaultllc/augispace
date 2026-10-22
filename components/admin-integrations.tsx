"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Database,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
} from "lucide-react";

type IntegrationStatus = {
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

type Payload = {
  integrations: IntegrationStatus[];
  missingEnvVars: string[];
  secretStorage: { kind: string; detail: string };
};

export function AdminIntegrations() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [schema, setSchema] = useState<{
    table: string;
    columns: { column_name: string; data_type: string }[];
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/integrations", { cache: "no-store" });
    const payload = (await res.json().catch(() => null)) as
      | Payload
      | { error?: string }
      | null;
    if (payload && "integrations" in payload) setData(payload);
    else setError("The integrations status could not be loaded.");
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/admin/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const payload = (await res.json().catch(() => null)) as Record<
        string,
        unknown
      > | null;
      if (payload?.ok) {
        setMessage(String(payload.message ?? "Done."));
        if (action === "save_secret")
          setDrafts((d) => ({ ...d, [String(extra.key)]: "" }));
        if (action === "inspect_schema" && payload.columns) {
          setSchema({
            table: String(payload.table),
            columns: payload.columns as {
              column_name: string;
              data_type: string;
            }[],
          });
        }
        if (action !== "inspect_schema") setSchema(null);
        if (["save_secret", "delete_secret"].includes(action)) await load();
      } else {
        setError(String(payload?.error ?? "The action failed."));
      }
    } catch {
      setError("The integrations service could not be reached.");
    } finally {
      setBusy("");
    }
  }

  const editable = (data?.integrations ?? []).filter(
    (i) => i.storage === "encrypted_db",
  );

  return (
    <main className="admin-page">
      <div className="admin-shell">
        <div className="inner-hero">
          <div className="inner-hero-copy">
            <span className="section-label">AUGI / ADMIN / INTEGRATIONS</span>
            <h1>
              Connected
              <br />
              <span>services.</span>
            </h1>
            <p>
              Status, diagnostics, and encrypted credential management. Secrets
              are never displayed or returned to the browser.
            </p>
          </div>
          <div className="inner-hero-index">
            <strong>OWNER</strong>
            <span>SESSION VERIFIED</span>
          </div>
        </div>

        {message && (
          <p className="admin-panel-note" role="status">
            <CheckCircle2 aria-hidden="true" /> {message}
          </p>
        )}
        {error && (
          <p className="admin-panel-note" role="alert">
            <CircleAlert aria-hidden="true" /> {error}
          </p>
        )}

        <div className="admin-panels">
          <section className="admin-panel" aria-labelledby="diag-title">
            <div className="admin-panel-head">
              <Database aria-hidden="true" />
              <h3 id="diag-title">Diagnostics</h3>
            </div>
            <div className="admin-integration-actions">
              <button
                type="button"
                disabled={busy !== ""}
                onClick={() => act("test_db")}
              >
                {busy === "test_db" ? (
                  <LoaderCircle className="spin-icon" aria-hidden="true" />
                ) : (
                  <RefreshCw aria-hidden="true" />
                )}{" "}
                Test database
              </button>
              <button
                type="button"
                disabled={busy !== ""}
                onClick={() => act("test_supabase_rest")}
              >
                {busy === "test_supabase_rest" ? (
                  <LoaderCircle className="spin-icon" aria-hidden="true" />
                ) : (
                  <RefreshCw aria-hidden="true" />
                )}{" "}
                Test Supabase API
              </button>
              <button
                type="button"
                disabled={busy !== ""}
                onClick={() => act("test_stripe")}
              >
                {busy === "test_stripe" ? (
                  <LoaderCircle className="spin-icon" aria-hidden="true" />
                ) : (
                  <RefreshCw aria-hidden="true" />
                )}{" "}
                Test Stripe
              </button>
            </div>
            {schema && (
              <div className="admin-team-list">
                <div className="admin-team-row">
                  <span>
                    <Database aria-hidden="true" /> {schema.table}
                  </span>
                  <strong>{schema.columns.length} COLUMNS</strong>
                </div>
                {schema.columns.map((c) => (
                  <div className="admin-team-row" key={c.column_name}>
                    <span>{c.column_name}</span>
                    <strong>{c.data_type.toUpperCase()}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>

          {(data?.integrations ?? []).map((integration) => (
            <section className="admin-panel" key={integration.id}>
              <div className="admin-panel-head">
                <KeyRound aria-hidden="true" />
                <h3>{integration.label}</h3>
              </div>
              <p className="admin-panel-note">{integration.description}</p>
              <div className="admin-integration-head">
                <span
                  className={
                    integration.configured ? "admin-badge ok" : "admin-badge"
                  }
                >
                  {integration.configured ? "CONFIGURED" : "NOT SET"}
                </span>
                {integration.envVar && <small>env: {integration.envVar}</small>}
                {integration.fingerprint && (
                  <small>stored fingerprint: {integration.fingerprint}</small>
                )}
                {integration.updatedAt && (
                  <small>
                    updated: {new Date(integration.updatedAt).toLocaleString()}
                  </small>
                )}
              </div>
              {integration.storage === "encrypted_db" && (
                <div className="admin-integration-form">
                  <input
                    type="password"
                    autoComplete="off"
                    value={drafts[integration.id] ?? ""}
                    onChange={(e) =>
                      setDrafts((d) => ({
                        ...d,
                        [integration.id]: e.target.value,
                      }))
                    }
                    placeholder="Paste new value (never displayed after saving)"
                    aria-label={`New ${integration.label} credential`}
                  />
                  <div className="admin-integration-actions">
                    <button
                      type="button"
                      disabled={
                        busy !== "" || !(drafts[integration.id] ?? "").trim()
                      }
                      onClick={() =>
                        act("save_secret", {
                          key:
                            integration.id === "abuseipdb"
                              ? "abuseipdb_api_key"
                              : "ai_gateway_api_key",
                          value: drafts[integration.id],
                        })
                      }
                    >
                      Save encrypted
                    </button>
                    <button
                      type="button"
                      disabled={busy !== "" || !integration.configured}
                      className="admin-danger"
                      onClick={() =>
                        act("delete_secret", {
                          key:
                            integration.id === "abuseipdb"
                              ? "abuseipdb_api_key"
                              : "ai_gateway_api_key",
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
              {integration.envOnly && integration.envVar && (
                <p className="admin-panel-note">
                  <LockKeyhole aria-hidden="true" /> Set{" "}
                  <code>{integration.envVar}</code> as a secret in the
                  deployment dashboard — this console cannot modify deployment
                  secrets.
                </p>
              )}
            </section>
          ))}

          {data && data.missingEnvVars.length > 0 && (
            <section className="admin-panel">
              <div className="admin-panel-head">
                <CircleAlert aria-hidden="true" />
                <h3>Missing environment variables</h3>
              </div>
              <ul>
                {data.missingEnvVars.map((n) => (
                  <li key={n}>
                    <code>{n}</code>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
