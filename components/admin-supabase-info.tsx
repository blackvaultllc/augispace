import { Database, ExternalLink } from "lucide-react";

/**
 * Shows the connected Supabase project (from the public anon URL) and the
 * ordered migration checklist. Purely informational — reads only env vars
 * the browser already exposes via NEXT_PUBLIC_.
 */

const MIGRATIONS = [
  {
    file: "20261022100000_roles_billing_integrations.sql",
    what: "Roles, staff invites, profiles, encrypted integration settings",
  },
  {
    file: "20261023100000_food_trucks.sql",
    what: "Food truck tracker: trucks, live locations, comments",
  },
  {
    file: "20261024100000_site_media.sql",
    what: "Media uploads: site-media storage bucket + placement slots",
  },
];

export function SupabaseInfo() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  let host = "Not configured";
  let projectRef = "";
  if (url) {
    try {
      const parsed = new URL(url);
      projectRef = parsed.hostname.split(".")[0];
      host = parsed.hostname;
    } catch {
      /* leave defaults */
    }
  }
  const dashboardUrl = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/editor`
    : "https://supabase.com/dashboard";

  return (
    <section
      className="admin-panel admin-supabase-panel"
      aria-labelledby="supabase-info-title"
    >
      <div className="admin-panel-head">
        <Database aria-hidden="true" />
        <h3 id="supabase-info-title">Supabase project & migrations</h3>
      </div>
      <div className="admin-supabase-row">
        <span>PROJECT REF</span>
        <strong>{projectRef || "—"}</strong>
      </div>
      <div className="admin-supabase-row">
        <span>HOST</span>
        <strong>{host}</strong>
      </div>
      <a
        className="admin-media-link"
        href={dashboardUrl}
        target="_blank"
        rel="noreferrer"
      >
        Open SQL editor in Supabase dashboard{" "}
        <ExternalLink aria-hidden="true" />
      </a>
      <p className="admin-panel-note" style={{ marginTop: 12 }}>
        Run these in order, top first, in the SQL editor. Each is idempotent —
        safe to run twice.
      </p>
      <ol className="admin-migration-list">
        {MIGRATIONS.map((migration, index) => (
          <li key={migration.file}>
            <span className="admin-migration-step">{index + 1}</span>
            <div>
              <code>{migration.file}</code>
              <small>{migration.what}</small>
            </div>
          </li>
        ))}
      </ol>
      <small className="admin-media-hint">
        Files live in supabase/migrations/ in this repo. Paste each file&apos;s
        contents into the SQL editor and click Run.
      </small>
    </section>
  );
}
