"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CircleAlert,
  Clock3,
  ExternalLink,
  FileText,
  Globe,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";

type Trend = {
  externalKey: string;
  title: string;
  url: string;
  sourceLabel: string;
  publishedAt: string | null;
  region: string | null;
};

type TrendResponse = {
  category?: string;
  provider?: { id: string; label?: string; measures?: string | null };
  retrievedAt?: string;
  cached?: boolean;
  measures?: string | null;
  trends?: Trend[];
  usage?: { remaining: number };
  canDraft?: boolean;
  error?: string;
};

type Category = { id: string; label: string };

export function PulseDashboard({ canDraft }: { canDraft: boolean }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [retrievedAt, setRetrievedAt] = useState<string | null>(null);
  const [measures, setMeasures] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [draftMsg, setDraftMsg] = useState("");
  const [draftBusy, setDraftBusy] = useState(false);

  useEffect(() => {
    fetch("/api/pulse/trends")
      .then((r) => r.json() as Promise<{ categories?: Category[] }>)
      .then((d) => setCategories(d.categories ?? []))
      .catch(() => setError("The trend catalog could not be loaded."));
  }, []);

  const fetchCategory = useCallback(
    async (category: string, refresh: boolean) => {
      refresh ? setRefreshing(true) : setLoading(true);
      setError("");
      setDraftMsg("");
      try {
        const response = await fetch("/api/pulse/trends", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category, refresh }),
        });
        const payload = (await response.json()) as TrendResponse;
        if (!response.ok || payload.error) {
          setError(payload.error ?? "The trend provider is unavailable.");
          setTrends([]);
          return;
        }
        setActiveCategory(category);
        setTrends(payload.trends ?? []);
        setRetrievedAt(payload.retrievedAt ?? null);
        setMeasures(payload.measures ?? payload.provider?.measures ?? null);
      } catch {
        setError("The trend provider could not be reached.");
      } finally {
        setRefreshing(false);
        setLoading(false);
      }
    },
    [],
  );

  function toggleCategory(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((c) => c !== id)
        : [...current, id].slice(0, 4),
    );
  }

  function loadSelected() {
    const first = selected[0] ?? categories[0]?.id;
    if (first) void fetchCategory(first, false);
  }

  const checked = trends.filter(
    (t) => (t as Trend & { _checked?: boolean })._checked,
  );
  void checked; // selection tracked separately below

  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  async function createDraft() {
    if (!activeCategory || !selectedKeys.length) return;
    setDraftBusy(true);
    setDraftMsg("");
    try {
      const response = await fetch("/api/pulse/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_draft",
          category: activeCategory,
          externalKeys: selectedKeys,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      setDraftMsg(
        payload.ok
          ? (payload.message ?? "Draft created.")
          : (payload.error ?? "Draft failed."),
      );
      if (payload.ok) setSelectedKeys([]);
    } catch {
      setDraftMsg("The draft request could not be completed.");
    } finally {
      setDraftBusy(false);
    }
  }

  return (
    <section className="pulse-dashboard" aria-labelledby="pulse-title">
      <div className="admin-console-header">
        <div>
          <span className="workspace-micro-label">AUGI / INFINITY PULSE</span>
          <h2 id="pulse-title">Trends, verified.</h2>
          <p>
            Live trend observations from a named public provider, with retrieval
            timestamps and source attribution.{" "}
            {canDraft
              ? "Owner/staff can assemble sourced drafts for review."
              : "Drafting is reserved for owner and staff accounts."}
          </p>
        </div>
        <span className="admin-verified">
          <Activity aria-hidden="true" /> LIVE FEED
        </span>
      </div>

      <div
        className="pulse-categories"
        role="group"
        aria-label="Trend categories"
      >
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`pulse-cat${selected.includes(c.id) ? " is-selected" : ""}`}
            aria-pressed={selected.includes(c.id)}
            onClick={() => toggleCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="pulse-actions">
        <button
          type="button"
          className="button-primary"
          onClick={loadSelected}
          disabled={loading || !selected.length}
        >
          {loading ? (
            <LoaderCircle className="spin-icon" aria-hidden="true" />
          ) : (
            <Activity aria-hidden="true" />
          )}
          Load selected categories
        </button>
        {activeCategory && (
          <button
            type="button"
            className="pulse-refresh"
            onClick={() => void fetchCategory(activeCategory, true)}
            disabled={refreshing}
          >
            {refreshing ? (
              <LoaderCircle className="spin-icon" aria-hidden="true" />
            ) : (
              <RefreshCw aria-hidden="true" />
            )}
            Refresh feed
          </button>
        )}
      </div>

      {error && (
        <p className="pulse-error" role="alert">
          <CircleAlert aria-hidden="true" /> {error}
        </p>
      )}

      {measures && (
        <p className="pulse-measures">
          <Globe aria-hidden="true" /> {measures}
          {retrievedAt && (
            <span className="pulse-retrieved">
              <Clock3 aria-hidden="true" /> Retrieved{" "}
              {new Date(retrievedAt).toLocaleTimeString()} · region: US (English
              edition)
            </span>
          )}
        </p>
      )}

      {trends.length > 0 && (
        <>
          <ul className="pulse-trend-list">
            {trends.map((t) => {
              const isSelected = selectedKeys.includes(t.externalKey);
              return (
                <li className="pulse-trend" key={t.externalKey}>
                  {canDraft && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() =>
                        setSelectedKeys((current) =>
                          current.includes(t.externalKey)
                            ? current.filter((k) => k !== t.externalKey)
                            : [...current, t.externalKey].slice(0, 10),
                        )
                      }
                      aria-label={`Select for drafting: ${t.title}`}
                    />
                  )}
                  <div className="pulse-trend-body">
                    <a href={t.url} target="_blank" rel="noopener noreferrer">
                      {t.title} <ExternalLink aria-hidden="true" />
                    </a>
                    <small>
                      {t.sourceLabel}
                      {t.publishedAt
                        ? ` · ${new Date(t.publishedAt).toLocaleDateString()}`
                        : ""}
                      {t.region ? ` · ${t.region}` : ""}
                    </small>
                  </div>
                </li>
              );
            })}
          </ul>

          {canDraft && (
            <div className="pulse-draft-bar">
              <button
                type="button"
                className="button-primary"
                onClick={createDraft}
                disabled={draftBusy || !selectedKeys.length}
              >
                {draftBusy ? (
                  <LoaderCircle className="spin-icon" aria-hidden="true" />
                ) : (
                  <FileText aria-hidden="true" />
                )}
                Draft article from {selectedKeys.length} selected
              </button>
              {draftMsg && <p role="status">{draftMsg}</p>}
            </div>
          )}
        </>
      )}

      {!trends.length && !loading && !error && (
        <p className="pulse-empty">
          Select one or more categories, then load the feed. Nothing is shown
          until the provider responds.
        </p>
      )}
    </section>
  );
}
