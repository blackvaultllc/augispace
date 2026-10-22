"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Eye,
  FileText,
  History,
  LoaderCircle,
  Send,
  ShieldCheck,
  Undo2,
} from "lucide-react";

type Article = {
  id: string;
  slug: string;
  category: string;
  headline: string;
  summary: string;
  status:
    | "draft"
    | "in_review"
    | "approved"
    | "published"
    | "withdrawn"
    | "archived";
  approved_by: string | null;
  published_at: string | null;
  updated_at: string;
  tags: string[];
};

type FullArticle = Article & {
  body_md: string;
  analysis_md: string;
  alt_headline: string | null;
  sources: {
    title: string;
    url: string;
    publisher: string;
    published_at: string | null;
    retrieved_at: string;
  }[];
};

type RevisionRow = {
  version: number;
  headline: string;
  change_note: string;
  created_at: string;
};

const NEXT_ACTIONS: Record<
  string,
  { to: string; label: string; ownerOnly?: boolean }[]
> = {
  draft: [{ to: "in_review", label: "Submit for review" }],
  in_review: [
    { to: "approved", label: "Approve", ownerOnly: true },
    { to: "draft", label: "Back to draft" },
  ],
  approved: [
    { to: "published", label: "Publish", ownerOnly: true },
    { to: "in_review", label: "Re-review" },
  ],
  published: [{ to: "withdrawn", label: "Withdraw" }],
  withdrawn: [
    { to: "in_review", label: "Re-review" },
    { to: "archived", label: "Archive" },
  ],
  archived: [],
};

export function PulseEditor() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [article, setArticle] = useState<FullArticle | null>(null);
  const [revisions, setRevisions] = useState<RevisionRow[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  // Editable fields
  const [headline, setHeadline] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [changeNote, setChangeNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/pulse/articles", {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        articles?: Article[];
        error?: string;
      };
      if (response.ok && payload.articles) {
        setArticles(payload.articles);
        setSelectedId((cur) => cur ?? payload.articles?.[0]?.id ?? null);
      } else setMessage(payload.error ?? "Articles could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openArticle = useCallback(async (id: string) => {
    setBusy(true);
    try {
      const [aRes, rRes] = await Promise.all([
        fetch(`/api/pulse/articles?id=${id}`, { cache: "no-store" }),
        fetch(`/api/pulse/articles?id=${id}&revisions=1`, {
          cache: "no-store",
        }),
      ]);
      const aPayload = (await aRes.json()) as {
        article?: FullArticle;
        error?: string;
      };
      const rPayload = (await rRes.json()) as { revisions?: RevisionRow[] };
      if (aRes.ok && aPayload.article) {
        setArticle(aPayload.article);
        setHeadline(aPayload.article.headline);
        setSummary(aPayload.article.summary);
        setBody(aPayload.article.body_md);
        setAnalysis(aPayload.article.analysis_md);
        setRevisions(rPayload.revisions ?? []);
      } else setMessage(aPayload.error ?? "The article could not be opened.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) void openArticle(selectedId);
  }, [selectedId, openArticle]);

  async function post(payload: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/pulse/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      setMessage(
        result.ok
          ? (result.message ?? "Done.")
          : (result.error ?? "Action failed."),
      );
      if (result.ok) {
        await load();
        if (selectedId) await openArticle(selectedId);
      }
    } finally {
      setBusy(false);
    }
  }

  const dirty =
    article &&
    (headline !== article.headline ||
      summary !== article.summary ||
      body !== article.body_md ||
      analysis !== article.analysis_md);
  const isOwner = true; // derived per-response on the server; UI shows actions the API will enforce

  return (
    <section className="pulse-editor" aria-labelledby="pulse-editor-title">
      <div className="admin-console-header">
        <div>
          <span className="workspace-micro-label">
            AUGI / INFINITY PULSE · REVIEW DESK
          </span>
          <h2 id="pulse-editor-title">Drafts & approval.</h2>
          <p>
            Human review is mandatory before publication. Every edit is
            versioned; rollbacks are recorded as new revisions.
          </p>
        </div>
        <span className="admin-verified">
          <ShieldCheck aria-hidden="true" /> APPROVAL GATE
        </span>
      </div>

      {message && (
        <p className="office-message" role="status">
          {message}
        </p>
      )}

      <div className="pulse-editor-layout">
        <aside className="office-doc-list" aria-label="Articles">
          {loading && <p>Loading drafts…</p>}
          {articles.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`office-doc-item${selectedId === a.id ? " is-active" : ""}`}
              onClick={() => setSelectedId(a.id)}
            >
              <strong>{a.headline.slice(0, 60)}</strong>
              <small>
                {a.status} · v
                {a.updated_at
                  ? new Date(a.updated_at).toLocaleDateString()
                  : ""}
              </small>
            </button>
          ))}
          {!loading && !articles.length && (
            <p>No drafts yet. Create one from the trend dashboard.</p>
          )}
        </aside>

        <div className="office-doc-view">
          {article ? (
            <>
              <div className="pulse-status-row">
                <span className={`office-status st-${article.status}`}>
                  {article.status.replace("_", " ").toUpperCase()}
                </span>
                {article.approved_by && (
                  <small>
                    <CheckCircle2 aria-hidden="true" /> approved
                  </small>
                )}
                {article.published_at && (
                  <small>
                    <Eye aria-hidden="true" /> published{" "}
                    {new Date(article.published_at).toLocaleDateString()}
                  </small>
                )}
              </div>

              <label className="office-editor-note">
                Headline
                <input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  maxLength={220}
                />
              </label>
              <label className="office-editor-note">
                Summary
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={2}
                  maxLength={500}
                />
              </label>
              <label className="office-editor-note">
                Sourced body (facts only — linked headlines)
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={10}
                />
              </label>
              <label className="office-editor-note">
                AI analysis (clearly labeled, separate from facts)
                <textarea
                  value={analysis}
                  onChange={(e) => setAnalysis(e.target.value)}
                  rows={6}
                />
              </label>
              <label className="office-editor-note">
                Change note
                <input
                  value={changeNote}
                  onChange={(e) => setChangeNote(e.target.value)}
                  maxLength={200}
                  placeholder="What changed and why"
                />
              </label>

              <div className="pulse-editor-actions">
                <button
                  type="button"
                  className="button-primary"
                  disabled={busy || !dirty}
                  onClick={() =>
                    post({
                      action: "save_revision",
                      id: article.id,
                      headline,
                      summary,
                      body,
                      analysis,
                      changeNote,
                    })
                  }
                >
                  <FileText aria-hidden="true" /> Save revision
                </button>
                {(NEXT_ACTIONS[article.status] ?? []).map((action) => (
                  <button
                    key={action.to}
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      post({
                        action: "set_status",
                        id: article.id,
                        status: action.to,
                        changeNote: action.label,
                      })
                    }
                  >
                    {action.to === "approved" ? (
                      <CheckCircle2 aria-hidden="true" />
                    ) : (
                      <Send aria-hidden="true" />
                    )}
                    {action.label}
                  </button>
                ))}
              </div>

              {article.sources.length > 0 && (
                <details className="workspace-evidence">
                  <summary>
                    Source references ({article.sources.length})
                  </summary>
                  <ul className="pulse-source-list">
                    {article.sources.map((s, i) => (
                      <li key={i}>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {s.title}
                        </a>
                        <small>
                          {" "}
                          — {s.publisher} · published{" "}
                          {s.published_at
                            ? new Date(s.published_at).toLocaleDateString()
                            : "unknown"}{" "}
                          · retrieved{" "}
                          {new Date(s.retrieved_at).toLocaleString()}
                        </small>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {revisions.length > 0 && (
                <details className="workspace-evidence">
                  <summary>
                    <History aria-hidden="true" /> Revision history (
                    {revisions.length})
                  </summary>
                  <ul className="pulse-source-list">
                    {revisions.map((r) => (
                      <li key={r.version}>
                        v{r.version} — {r.headline.slice(0, 60)} ·{" "}
                        {r.change_note} ·{" "}
                        {new Date(r.created_at).toLocaleString()}
                        <button
                          type="button"
                          className="pulse-rollback"
                          disabled={busy}
                          onClick={() =>
                            post({
                              action: "rollback",
                              id: article.id,
                              version: r.version,
                            })
                          }
                        >
                          <Undo2 aria-hidden="true" /> Restore
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <p className="pulse-analysis-note">
                <CircleAlert aria-hidden="true" /> The analysis field is
                generated commentary, never sourced fact. Reviewers must verify
                every factual claim against the linked sources before approval.
              </p>
            </>
          ) : (
            !loading && <p>Select an article to review.</p>
          )}
        </div>
      </div>
    </section>
  );
}
