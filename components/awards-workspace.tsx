"use client";

import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Award,
  CalendarDays,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  Trash2,
  Trophy,
} from "lucide-react";

export type AwardItem = {
  id: string;
  title: string;
  issuer: string;
  category: string;
  description: string;
  receivedOn: string;
  yearGroup: number | null;
  schoolYear: string;
  tags: string[];
  fileName: string;
  fileKind: "image" | "document" | null;
  createdAt: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  academic: "Academic",
  graduation: "Graduation",
  athletics: "Athletics",
  professional: "Professional",
  creative: "Creative",
  community: "Community service",
  other: "Other",
};

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

type Props = { initialAwards: AwardItem[] };

/**
 * Awards & Achievements workspace.
 * Timeline, yearly overview, category breakdown, filters, and gallery —
 * all computed from the user's real records. Private by design: signed
 * file URLs expire; nothing here is public.
 */
export function AwardsWorkspace({ initialAwards }: Props) {
  const [awards, setAwards] = useState<AwardItem[]>(initialAwards);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [view, setView] = useState<"timeline" | "gallery">("timeline");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [showForm, setShowForm] = useState(initialAwards.length === 0);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/awards", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as {
      awards: (AwardItem & { file_url?: string | null })[];
    };
    setAwards(data.awards.map(({ file_url: _url, ...rest }) => rest));
  }, []);

  const years = useMemo(
    () =>
      [
        ...new Set(
          awards
            .map(
              (a) =>
                a.yearGroup ??
                (a.receivedOn ? Number(a.receivedOn.slice(0, 4)) : null),
            )
            .filter((y): y is number => !!y),
        ),
      ].sort((a, b) => b - a),
    [awards],
  );

  const filtered = useMemo(
    () =>
      awards.filter((a) => {
        if (categoryFilter !== "all" && a.category !== categoryFilter)
          return false;
        if (yearFilter !== "all") {
          const year =
            a.yearGroup ??
            (a.receivedOn ? Number(a.receivedOn.slice(0, 4)) : null);
          if (String(year) !== yearFilter) return false;
        }
        return true;
      }),
    [awards, categoryFilter, yearFilter],
  );

  const byYear = useMemo(() => {
    const map = new Map<number, AwardItem[]>();
    for (const award of filtered) {
      const year =
        award.yearGroup ??
        (award.receivedOn
          ? Number(award.receivedOn.slice(0, 4))
          : award.createdAt
            ? Number(award.createdAt.slice(0, 4))
            : null);
      if (!year) continue;
      const list = map.get(year) ?? [];
      list.push(award);
      map.set(year, list);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [filtered]);

  const byCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const award of awards)
      counts.set(award.category, (counts.get(award.category) ?? 0) + 1);
    return CATEGORY_ORDER.filter((c) => counts.get(c)).map((c) => ({
      category: c,
      count: counts.get(c) ?? 0,
    }));
  }, [awards]);

  const maxYearCount = Math.max(1, ...byYear.map(([, list]) => list.length));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch("/api/awards", {
        method: "POST",
        body: data,
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        setError(result.error ?? "The award could not be saved.");
        return;
      }
      await refresh();
      form.reset();
      setShowForm(false);
      setMessage("Achievement added to your private timeline.");
    } catch {
      setError(
        "The upload failed. Check your connection and try again — nothing was lost.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    setMessage(null);
    const previous = awards;
    setAwards((current) => current.filter((a) => a.id !== id));
    try {
      const response = await fetch(`/api/awards?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error();
      setMessage("Achievement deleted.");
    } catch {
      setAwards(previous);
      setError(
        "The deletion could not be completed. Your record is unchanged.",
      );
    }
  }

  return (
    <section className="awards-workspace" aria-label="Awards and achievements">
      <div className="awards-toolbar">
        <div className="awards-views" role="tablist" aria-label="View">
          <button
            role="tab"
            aria-selected={view === "timeline"}
            className={
              view === "timeline"
                ? "awards-view-tab is-active"
                : "awards-view-tab"
            }
            onClick={() => setView("timeline")}
          >
            Timeline
          </button>
          <button
            role="tab"
            aria-selected={view === "gallery"}
            className={
              view === "gallery"
                ? "awards-view-tab is-active"
                : "awards-view-tab"
            }
            onClick={() => setView("gallery")}
          >
            Gallery
          </button>
        </div>
        <div className="awards-filters">
          <label className="awards-filter">
            <span>Category</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All categories</option>
              {byCategory.map(({ category }) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </label>
          <label className="awards-filter">
            <span>Year</span>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
            >
              <option value="all">All years</option>
              {years.map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          className={
            showForm ? "awards-add-button is-open" : "awards-add-button"
          }
          onClick={() => setShowForm((open) => !open)}
          aria-expanded={showForm}
        >
          {showForm ? (
            "Close form"
          ) : (
            <>
              <Plus aria-hidden="true" /> Add achievement
            </>
          )}
        </button>
      </div>

      {message && (
        <p className="awards-note" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="awards-note is-error" role="alert">
          {error}
        </p>
      )}

      {showForm && (
        <form ref={formRef} className="awards-form" onSubmit={handleSubmit}>
          <div className="awards-form-grid">
            <label className="awards-field">
              <span>Award title *</span>
              <input
                name="title"
                required
                maxLength={160}
                placeholder="e.g. Regional Science Fair — 1st place"
              />
            </label>
            <label className="awards-field">
              <span>Issued by</span>
              <input
                name="issuer"
                maxLength={160}
                placeholder="School, organization, employer…"
              />
            </label>
            <label className="awards-field">
              <span>Category</span>
              <select name="category" defaultValue="other">
                {CATEGORY_ORDER.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </label>
            <label className="awards-field">
              <span>Date received</span>
              <input name="received_on" type="date" />
            </label>
            <label className="awards-field">
              <span>Calendar year</span>
              <input
                name="year_group"
                inputMode="numeric"
                pattern="\d{4}"
                placeholder="2026"
                maxLength={4}
              />
            </label>
            <label className="awards-field">
              <span>School year (optional)</span>
              <input
                name="school_year"
                maxLength={40}
                placeholder="e.g. 2025–2026"
              />
            </label>
          </div>
          <label className="awards-field">
            <span>Description or personal notes</span>
            <textarea
              name="description"
              maxLength={2000}
              rows={3}
              placeholder="What it meant, what you did, who recognized it…"
            />
          </label>
          <label className="awards-field">
            <span>Tags (comma separated)</span>
            <input name="tags" placeholder="science, team, certificate" />
          </label>
          <label className="awards-field">
            <span>
              Photo or document (PNG, JPEG, WebP, GIF, or PDF — max 8 MB)
            </span>
            <input
              name="file"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
            />
          </label>
          <div className="awards-form-actions">
            <button type="submit" className="awards-submit" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="awards-spin" aria-hidden="true" /> Saving…
                </>
              ) : (
                "Save achievement"
              )}
            </button>
            <small>
              A private record visible only to you. Files are stored securely
              with expiring access links.
            </small>
          </div>
        </form>
      )}

      {awards.length === 0 && !showForm ? (
        <div className="awards-empty">
          <Trophy aria-hidden="true" />
          <h2>Nothing here yet — and that is fine.</h2>
          <p>
            Your timeline starts with the first thing you add: a certificate, a
            trophy photo, a graduation, a moment you are proud of. Everything
            stays private unless you choose otherwise.
          </p>
          <button className="awards-submit" onClick={() => setShowForm(true)}>
            <Plus aria-hidden="true" /> Add your first achievement
          </button>
        </div>
      ) : view === "timeline" ? (
        <div className="awards-timeline">
          {byYear.map(([year, items]) => (
            <div className="awards-year-block" key={year}>
              <div className="awards-year-heading">
                <span className="awards-year-node" aria-hidden="true" />
                <h3>{year}</h3>
                <span className="awards-year-count">
                  {items.length}{" "}
                  {items.length === 1 ? "achievement" : "achievements"}
                </span>
                <div className="awards-year-bar" aria-hidden="true">
                  <span
                    style={{ width: `${(items.length / maxYearCount) * 100}%` }}
                  />
                </div>
              </div>
              <ul className="awards-list">
                {items.map((award) => (
                  <li className="awards-card" key={award.id}>
                    <button
                      className="awards-card-toggle"
                      aria-expanded={expandedId === award.id}
                      onClick={() =>
                        setExpandedId(expandedId === award.id ? null : award.id)
                      }
                    >
                      <span className="awards-card-icon" aria-hidden="true">
                        {award.fileKind === "image" ? (
                          <ImageIcon />
                        ) : award.fileKind === "document" ? (
                          <FileText />
                        ) : (
                          <Award />
                        )}
                      </span>
                      <span className="awards-card-main">
                        <strong>{award.title}</strong>
                        <small>
                          {[
                            award.issuer,
                            award.receivedOn,
                            CATEGORY_LABELS[award.category] ?? award.category,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      </span>
                      <ChevronDown
                        className={
                          expandedId === award.id
                            ? "awards-chevron is-open"
                            : "awards-chevron"
                        }
                        aria-hidden="true"
                      />
                    </button>
                    {expandedId === award.id && (
                      <div className="awards-card-detail">
                        {award.description && <p>{award.description}</p>}
                        {award.tags.length > 0 && (
                          <p className="awards-tags">
                            {award.tags.map((tag) => (
                              <span key={tag}>#{tag}</span>
                            ))}
                          </p>
                        )}
                        {award.schoolYear && (
                          <p className="awards-meta-line">
                            <CalendarDays aria-hidden="true" /> School year{" "}
                            {award.schoolYear}
                          </p>
                        )}
                        {award.fileKind === "image" && (
                          <img
                            className="awards-preview"
                            src={`/api/awards/file?id=${encodeURIComponent(award.id)}`}
                            alt={`Attachment for ${award.title}`}
                            loading="lazy"
                          />
                        )}
                        {award.fileKind === "document" && (
                          <a
                            className="awards-doc-link"
                            href={`/api/awards/file?id=${encodeURIComponent(award.id)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Open document: {award.fileName}
                          </a>
                        )}
                        <button
                          className="awards-delete"
                          onClick={() => handleDelete(award.id)}
                        >
                          <Trash2 aria-hidden="true" /> Delete
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="awards-gallery">
          {filtered
            .filter((a) => a.fileKind === "image")
            .map((award) => (
              <figure className="awards-gallery-item" key={award.id}>
                <img
                  src={`/api/awards/file?id=${encodeURIComponent(award.id)}`}
                  alt={`Attachment for ${award.title}`}
                  loading="lazy"
                />
                <figcaption>
                  <strong>{award.title}</strong>
                  <small>
                    {CATEGORY_LABELS[award.category] ?? award.category}
                    {award.receivedOn ? ` · ${award.receivedOn}` : ""}
                  </small>
                </figcaption>
              </figure>
            ))}
          {filtered.filter((a) => a.fileKind === "image").length === 0 && (
            <p className="awards-empty-inline">
              No image attachments yet. Documents still show in the timeline
              view.
            </p>
          )}
        </div>
      )}

      <div className="awards-summary">
        <div className="awards-stat">
          <strong>{awards.length}</strong>
          <span>Total achievements</span>
        </div>
        <div className="awards-stat">
          <strong>{byCategory.length}</strong>
          <span>Categories</span>
        </div>
        <div className="awards-stat">
          <strong>{years.length}</strong>
          <span>Years</span>
        </div>
      </div>

      <div className="awards-category-breakdown">
        <h4>Category breakdown</h4>
        <ul>
          {byCategory.map(({ category, count }) => (
            <li key={category}>
              <span>{CATEGORY_LABELS[category]}</span>
              <div className="awards-bar" aria-hidden="true">
                <span
                  style={{
                    width: `${(count / Math.max(1, awards.length)) * 100}%`,
                  }}
                />
              </div>
              <strong>{count}</strong>
            </li>
          ))}
          {byCategory.length === 0 && (
            <li className="awards-empty-inline">No categories yet.</li>
          )}
        </ul>
      </div>

      <p className="awards-privacy-note">
        These records are yours alone: private storage, expiring links, no
        public profiles, no leaderboards. AUGI displays uploads as user-provided
        records, not independently verified proof.
      </p>
      <p className="awards-privacy-note">
        Want to explore other AUGI tools? Visit the{" "}
        <Link href="/demo">free demo</Link> or see{" "}
        <Link href="/plans">plans</Link>.
      </p>
    </section>
  );
}
