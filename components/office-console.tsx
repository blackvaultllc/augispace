"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  BookOpen,
  CircleAlert,
  ClipboardList,
  FileText,
  History,
  LoaderCircle,
  Megaphone,
  Save,
  ShieldCheck,
} from "lucide-react";

type Doc = {
  id: string;
  slug: string;
  section: string;
  title: string;
  body_md: string;
  version: number;
  updated_at: string;
};

type Finding = {
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
};

type Props = { email: string };

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"] as const;
const STATUS_LABEL: Record<Finding["status"], string> = {
  open: "OPEN",
  mitigated: "MITIGATED",
  closed: "CLOSED",
  accepted_risk: "ACCEPTED RISK",
};

/** Renders seeded markdown (headings, tables skipped to plain rows, code fences, lists). */
function DocBody({ body }: { body: string }) {
  const blocks = body.split(/\n\n+/);
  return (
    <div className="office-doc-body">
      {blocks.map((block, i) => {
        if (block.startsWith("```")) {
          return (
            <pre key={i}>
              {block.replace(/^```[a-z]*\n?/, "").replace(/```$/, "")}
            </pre>
          );
        }
        if (block.startsWith("## ")) return <h3 key={i}>{block.slice(3)}</h3>;
        if (block.startsWith("| ")) {
          const rows = block
            .split("\n")
            .filter((r) => r.startsWith("|") && !/^\|[\s-|]+\|$/.test(r));
          return (
            <table key={i}>
              <tbody>
                {rows.map((row, r) => (
                  <tr key={r}>
                    {row
                      .split("|")
                      .slice(1, -1)
                      .map((cell, c) =>
                        r === 0 ? (
                          <th key={c}>{cell.trim()}</th>
                        ) : (
                          <td key={c}>{cell.trim()}</td>
                        ),
                      )}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }
        if (/^(- |\d\. )/m.test(block)) {
          const items = block
            .split("\n")
            .map((line) => line.replace(/^(- |\d\. )/, "").trim());
          return (
            <ul key={i}>
              {items.map((item, k) => (
                <li
                  key={k}
                  dangerouslySetInnerHTML={{ __html: inline(item) }}
                />
              ))}
            </ul>
          );
        }
        return (
          <p key={i} dangerouslySetInnerHTML={{ __html: inline(block) }} />
        );
      })}
    </div>
  );
}

/** Minimal inline formatting: **bold** and \`code\` — everything else escaped. */
function inline(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

export function OfficeConsole({ email }: Props) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [editBody, setEditBody] = useState<string | null>(null);
  const [changeNote, setChangeNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/office", { cache: "no-store" });
      const payload = (await response.json()) as {
        documents?: Doc[];
        findings?: Finding[];
        error?: string;
      };
      if (response.ok && payload.documents) {
        setDocs(payload.documents);
        setFindings(payload.findings ?? []);
        setSelectedSlug(
          (current) => current ?? payload.documents?.[0]?.slug ?? null,
        );
      } else {
        setMessage(payload.error ?? "The office data could not be loaded.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = docs.find((d) => d.slug === selectedSlug) ?? null;

  const bySection = useMemo(() => {
    const map = new Map<string, Doc[]>();
    for (const doc of docs) {
      const list = map.get(doc.section) ?? [];
      list.push(doc);
      map.set(doc.section, list);
    }
    return [...map.entries()];
  }, [docs]);

  const openFindings = findings.filter((f) => f.status === "open");
  const counts = SEVERITY_ORDER.map(
    (s) => [s, openFindings.filter((f) => f.severity === s).length] as const,
  );

  async function saveDoc() {
    if (!selected || editBody === null) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/office", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_document",
          slug: selected.slug,
          body: editBody,
          changeNote,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      setMessage(
        payload.ok
          ? (payload.message ?? "Saved.")
          : (payload.error ?? "Save failed."),
      );
      if (payload.ok) {
        setEditBody(null);
        setChangeNote("");
        void load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function setFindingStatus(id: string, status: Finding["status"]) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/office", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_finding_status",
          id,
          status,
          note: `Status set to ${status} from the office console.`,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      setMessage(
        payload.ok
          ? (payload.message ?? "Updated.")
          : (payload.error ?? "Update failed."),
      );
      if (payload.ok) void load();
    } finally {
      setBusy(false);
    }
  }

  const sectionIcons: Record<string, typeof BookOpen> = {
    architecture: BookOpen,
    security: ShieldCheck,
    testing: ClipboardList,
    operations: FileText,
    archive: Archive,
    claims: Megaphone,
  };

  return (
    <section className="office-console" aria-labelledby="office-title">
      <div className="admin-console-header">
        <div>
          <span className="workspace-micro-label">
            AUGI / PRESIDENT'S OFFICE
          </span>
          <h2 id="office-title">Platform assurance.</h2>
          <p>
            Real records only: verified evidence, dated tests, honest findings.
            Signed in as {email}. This library is private — RLS denies every
            non-server read.
          </p>
        </div>
        <span className="admin-verified">
          <ShieldCheck aria-hidden="true" /> OWNER SESSION
        </span>
      </div>

      {message && (
        <p className="office-message" role="status">
          {message}
        </p>
      )}

      {/* Assurance summary — derived from the findings register, never decorative. */}
      <div className="office-summary" aria-label="Assurance summary">
        <div className="office-summary-card">
          <strong>{docs.length}</strong>
          <span>Documents</span>
        </div>
        <div className="office-summary-card">
          <strong>{findings.length}</strong>
          <span>Total findings</span>
        </div>
        <div className="office-summary-card is-alert">
          <strong>{openFindings.length}</strong>
          <span>Open findings</span>
        </div>
        {counts.map(([severity, count]) => (
          <div className="office-summary-card" key={severity}>
            <strong>{count}</strong>
            <span>{severity} open</span>
          </div>
        ))}
      </div>

      <div className="office-layout">
        <aside className="office-doc-list" aria-label="Documentation sections">
          {loading && <p>Loading the library…</p>}
          {bySection.map(([section, sectionDocs]) => {
            const Icon = sectionIcons[section] ?? FileText;
            return (
              <div key={section} className="office-doc-group">
                <h3>
                  <Icon aria-hidden="true" /> {section}
                </h3>
                {sectionDocs.map((doc) => (
                  <button
                    key={doc.slug}
                    type="button"
                    className={`office-doc-item${selectedSlug === doc.slug ? " is-active" : ""}`}
                    onClick={() => {
                      setSelectedSlug(doc.slug);
                      setEditBody(null);
                      setChangeNote("");
                    }}
                  >
                    <strong>{doc.title}</strong>
                    <small>
                      v{doc.version} ·{" "}
                      {new Date(doc.updated_at).toLocaleDateString()}
                    </small>
                  </button>
                ))}
              </div>
            );
          })}
        </aside>

        <div className="office-doc-view">
          {selected && (
            <>
              <div className="office-doc-head">
                <div>
                  <h3>{selected.title}</h3>
                  <small>
                    {selected.slug} · version {selected.version} · updated{" "}
                    {new Date(selected.updated_at).toLocaleString()}
                  </small>
                </div>
                {editBody === null ? (
                  <button
                    type="button"
                    onClick={() => setEditBody(selected.body_md)}
                  >
                    <FileText aria-hidden="true" /> Edit (versioned)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditBody(null)}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                )}
              </div>
              {editBody === null ? (
                <DocBody body={selected.body_md} />
              ) : (
                <div className="office-editor">
                  <textarea
                    value={editBody}
                    onChange={(event) => setEditBody(event.target.value)}
                    rows={18}
                    aria-label={`Edit ${selected.title}`}
                  />
                  <label className="office-editor-note">
                    Change note (recorded with the version)
                    <input
                      value={changeNote}
                      onChange={(event) => setChangeNote(event.target.value)}
                      placeholder="What changed and why"
                      maxLength={200}
                    />
                  </label>
                  <button
                    type="button"
                    className="office-save"
                    onClick={saveDoc}
                    disabled={busy}
                  >
                    {busy ? (
                      <LoaderCircle className="spin-icon" aria-hidden="true" />
                    ) : (
                      <Save aria-hidden="true" />
                    )}
                    Save new version
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="office-findings" aria-labelledby="findings-title">
        <div className="admin-panel-head">
          <CircleAlert aria-hidden="true" />
          <h3 id="findings-title">Findings register</h3>
        </div>
        <p className="admin-panel-note">
          Every entry carries its evidence. Status changes are recorded with
          who/when in the change history. Closed findings are kept, never
          deleted.
        </p>
        {findings.map((finding) => (
          <article
            className={`office-finding is-${finding.status}`}
            key={finding.id}
          >
            <header>
              <span className={`office-sev sev-${finding.severity}`}>
                {finding.severity.toUpperCase()}
              </span>
              <strong>
                {finding.ref} — {finding.title}
              </strong>
              <span className={`office-status st-${finding.status}`}>
                {STATUS_LABEL[finding.status]}
              </span>
            </header>
            <p>{finding.description}</p>
            <small>
              <strong>Component:</strong> {finding.component} ·{" "}
              <strong>Discovered:</strong>{" "}
              {new Date(finding.discovered_at).toLocaleDateString()}
            </small>
            {finding.evidence && (
              <small className="office-evidence">
                <strong>Evidence:</strong> {finding.evidence}
              </small>
            )}
            {finding.remediation_note && (
              <small className="office-remedy">
                <strong>Remediation:</strong> {finding.remediation_note}
              </small>
            )}
            {finding.retest_note && (
              <small className="office-remedy">
                <strong>Retest:</strong> {finding.retest_note}
              </small>
            )}
            {finding.status === "open" && (
              <div className="office-finding-actions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setFindingStatus(finding.id, "mitigated")}
                >
                  Mark mitigated
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setFindingStatus(finding.id, "accepted_risk")}
                >
                  Accept as risk
                </button>
              </div>
            )}
            {finding.status === "mitigated" && (
              <div className="office-finding-actions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setFindingStatus(finding.id, "closed")}
                >
                  Close (retest done)
                </button>
              </div>
            )}
          </article>
        ))}
      </div>

      <p className="admin-audit-note">
        <History aria-hidden="true" />
        <span>
          Document edits create new versions with the prior body preserved.
          Finding status changes append to an immutable change-history table.
          Nothing in this library may be cited as an independent audit or
          certification — no such assessment has occurred.
        </span>
      </p>
    </section>
  );
}
