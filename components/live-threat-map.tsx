"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Radio, ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";
import worldAtlas from "world-atlas/countries-110m.json";
import type { LiveThreatFeed } from "@/lib/live-threat-feed";

/**
 * Threat-intel dashboard. Layout inspired by classic SOC dashboards, but every
 * number is real and sourced:
 *  - CISA KEV catalog (keyless, authoritative)
 *  - AbuseIPDB blocklist entries (when the owner has configured a key)
 * No simulated attack counters, no invented traffic arcs.
 */

const MAP_WIDTH = 800;
const MAP_HEIGHT = 460;
const GLOBAL_CENTER: [number, number] = [70, 25];
const GLOBAL_SCALE = 160;

type Plotted = {
  id: string;
  kind: "abuse" | "kev";
  label: string;
  latitude: number;
  longitude: number;
  meta: [string, string][];
};

type TrendPoint = { label: string; count: number };

type FeedRow = {
  id: string;
  time: string;
  indicator: string;
  label: string;
  severity: "critical" | "high" | "medium" | "low";
  status: string;
};

export function LiveThreatMap() {
  const [feed, setFeed] = useState<LiveThreatFeed | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Plotted | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/live-threat-feed", {
          cache: "no-store",
        });
        const payload = (await response.json()) as LiveThreatFeed & {
          error?: string;
        };
        if (cancelled) return;
        if (!response.ok || payload.error) {
          setError(
            payload.error || "The live threat feed is temporarily unavailable.",
          );
          return;
        }
        setFeed(payload);
      } catch {
        if (!cancelled)
          setError("The live threat feed is temporarily unavailable.");
      }
    }
    async function loadTrend() {
      try {
        const response = await fetch("/api/public-threat-trend");
        const payload = (await response.json()) as {
          points?: TrendPoint[];
          error?: string;
        };
        if (!cancelled && payload.points) setTrend(payload.points);
      } catch {
        /* trend chart is optional */
      }
    }
    void load();
    void loadTrend();
    const timer = window.setInterval(load, 300_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const plotted = useMemo<Plotted[]>(() => {
    if (!feed) return [];
    return feed.beacons.map((beacon) => ({
      id: beacon.id,
      kind: beacon.kind === "abuse" ? "abuse" : "kev",
      label: beacon.label,
      latitude: beacon.latitude,
      longitude: beacon.longitude,
      meta: beacon.details,
    }));
  }, [feed]);

  const visible = plotted.filter(
    (item) =>
      Number.isFinite(item.latitude) &&
      Number.isFinite(item.longitude) &&
      item.latitude >= -85 &&
      item.latitude <= 85,
  );

  const feedRows = useMemo<FeedRow[]>(() => {
    if (!feed) return [];
    const kevRows: FeedRow[] = feed.kev.recent.slice(0, 7).map((entry) => ({
      id: `kev-${entry.cve}`,
      time: entry.dateAdded,
      indicator: entry.cve,
      label: `${entry.vendor} · ${entry.product}`.slice(0, 34),
      severity: entry.ransomware ? "critical" : "high",
      status: entry.ransomware ? "Exploited · ransomware" : "Exploited",
    }));
    const abuseRows: FeedRow[] = feed.beacons.slice(0, 6).map((beacon) => {
      const scoreRow = beacon.details.find(([k]) => k === "ABUSE SCORE");
      const score = scoreRow ? Number.parseInt(scoreRow[1], 10) : 0;
      const ipRow = beacon.details.find(([k]) => k === "IP");
      return {
        id: beacon.id,
        time: (beacon.details.find(([k]) => k === "LAST REPORTED")?.[1] ?? "").slice(0, 10),
        indicator: ipRow?.[1] ?? beacon.id.replace("abuse-", ""),
        label: beacon.label.replace(/ · .*/, "").slice(0, 34),
        severity: score >= 75 ? "critical" : score >= 25 ? "medium" : "low",
        status: `Reported · ${scoreRow?.[1] ?? "?"} confidence`,
      };
    });
    return [...kevRows, ...abuseRows].slice(0, 12);
  }, [feed]);

  const trendMax = Math.max(1, ...trend.map((point) => point.count));
  const criticalCount = feedRows.filter((row) => row.severity === "critical").length;

  return (
    <div className="ti-dashboard" aria-live="polite">
      <header className="ti-header">
        <span className="ti-header-title">
          <Radio aria-hidden="true" /> THREAT INTEL – GLOBAL ALERT STATUS
        </span>
        <span className="ti-header-tag">VERIFIED PUBLIC FEEDS ONLY</span>
      </header>

      {error && (
        <p className="live-threatmap-error" role="alert">
          {error}
        </p>
      )}
      {!feed && !error && (
        <p className="live-threatmap-loading">Loading the verified threat feed…</p>
      )}

      {feed && (
        <div className="ti-grid">
          {/* Left stat column */}
          <div className="ti-stats">
            <div className="ti-stat-card">
              <span className="ti-stat-label">
                <ShieldCheck aria-hidden="true" /> KNOWN EXPLOITED VULNS
              </span>
              <strong>{feed.kev.totalKnownExploited.toLocaleString()}</strong>
              <small>CISA KEV catalog total</small>
            </div>
            <div className={`ti-stat-card${criticalCount ? " is-alert" : ""}`}>
              <span className="ti-stat-label">
                <TriangleAlert aria-hidden="true" /> CRITICAL ROWS SHOWN
              </span>
              <strong>{criticalCount}</strong>
              <small>Ransomware-linked KEV in this view</small>
            </div>
            <div className="ti-stat-card">
              <span className="ti-stat-label">
                <Activity aria-hidden="true" /> ADDED LAST 7 DAYS
              </span>
              <strong>{feed.kev.addedLast7Days}</strong>
              <small>+{feed.kev.addedLast30Days} in the last 30 days</small>
            </div>
            <div className="ti-stat-card">
              <span className="ti-stat-label">
                <ShieldAlert aria-hidden="true" /> PLOTTED ABUSE CONTACTS
              </span>
              <strong>{visible.length}</strong>
              <small>
                {feed.sources[1]?.configured
                  ? "AbuseIPDB blocklist (configured)"
                  : "AbuseIPDB key not configured yet"}
              </small>
            </div>
          </div>

          {/* Center map */}
          <div className="ti-map">
            <div className="live-threatmap-canvas ti-radar-wrap">
              {/* Decorative radar sweep + rings (pure CSS, no fake data) */}
              <div className="ti-radar-sweep" aria-hidden="true" />
              <div className="ti-radar-rings" aria-hidden="true">
                <span /><span /><span /><span />
                <span className="ti-radar-axis-h" />
                <span className="ti-radar-axis-v" />
              </div>
              <ComposableMap
                width={MAP_WIDTH}
                height={MAP_HEIGHT}
                projection="geoMercator"
                projectionConfig={{ center: GLOBAL_CENTER, scale: GLOBAL_SCALE }}
                aria-label="Live threat world map"
              >
                <Geographies geography={worldAtlas as never}>
                  {({ geographies }) =>
                    geographies.map((geography) => (
                      <Geography
                        key={geography.rsmKey}
                        geography={geography}
                        fill="#0a141a"
                        stroke="#1f4a44"
                        strokeWidth={0.6}
                        tabIndex={-1}
                        style={{ outline: "none" }}
                      />
                    ))
                  }
                </Geographies>
                {visible.map((item) => (
                  <Marker
                    key={item.id}
                    coordinates={[item.longitude, item.latitude]}
                    onClick={() => setSelected(item)}
                  >
                    <circle
                      r={item.kind === "abuse" ? 5 : 3.4}
                      fill={item.kind === "abuse" ? "#f05656" : "#e3b85c"}
                      stroke="#0a0c10"
                      strokeWidth={1}
                      className="live-marker"
                      role="button"
                      tabIndex={0}
                      aria-label={item.label}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") setSelected(item);
                      }}
                    />
                  </Marker>
                ))}
              </ComposableMap>
              {selected && (
                <aside
                  className="live-threatmap-detail"
                  aria-label="Selected contact details"
                >
                  <button
                    type="button"
                    className="live-detail-close"
                    onClick={() => setSelected(null)}
                    aria-label="Close details"
                  >
                    ×
                  </button>
                  <strong>{selected.label}</strong>
                  <dl>
                    {selected.meta.map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </aside>
              )}
            </div>
            <div className="ti-map-caption">
              <span>MAP PLOTS ONLY VERIFIED CONTACTS</span>
              <span>NO SIMULATED TRAFFIC</span>
            </div>
          </div>

          {/* Right feed table */}
          <div className="ti-feed">
            <div className="ti-panel-head">
              <strong>REAL-TIME THREAT FEED</strong>
              <span>KEV + ABUSEIPDB</span>
            </div>
            <div className="ti-feed-table" role="table" aria-label="Latest verified threat rows">
              <div className="ti-feed-row ti-feed-header" role="row">
                <span role="columnheader">TIME</span>
                <span role="columnheader">SEV</span>
                <span role="columnheader">INDICATOR</span>
                <span role="columnheader">STATUS</span>
              </div>
              {feedRows.map((row) => (
                <div className="ti-feed-row" role="row" key={row.id}>
                  <span className="ti-feed-time" role="cell">{row.time || "—"}</span>
                  <span
                    className={`ti-sev ti-sev-${row.severity}`}
                    role="cell"
                  >
                    {row.severity.toUpperCase()}
                  </span>
                  <span className="ti-feed-indicator" role="cell" title={row.label}>
                    {row.indicator}
                    <small>{row.label}</small>
                  </span>
                  <span className="ti-feed-status" role="cell">{row.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom row: KEV trend chart + latest additions */}
          <div className="ti-chart">
            <div className="ti-panel-head">
              <strong>KEV ADDITIONS · LAST 12 MONTHS</strong>
              <span>CISA TREND</span>
            </div>
            <div className="ti-chart-bars" aria-hidden="true">
              {trend.map((point) => (
                <div className="ti-chart-bar-wrap" key={point.label} title={`${point.label}: ${point.count}`}>
                  <div
                    className="ti-chart-bar"
                    style={{ height: `${Math.max(4, (point.count / trendMax) * 100)}%` }}
                  />
                  <span>{point.label}</span>
                </div>
              ))}
              {!trend.length && <p className="ti-chart-empty">Trend data unavailable.</p>}
            </div>
            <p className="ti-chart-note">
              Real counts of vulnerabilities CISA added to the catalog each month.
            </p>
          </div>

          <div className="ti-latest">
            <div className="ti-panel-head">
              <strong>LATEST CISA KEV ADDITIONS</strong>
              <a href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog" target="_blank" rel="noreferrer">
                FULL CATALOG ↗
              </a>
            </div>
            <ul className="ti-latest-list">
              {feed.kev.recent.slice(0, 6).map((entry) => (
                <li key={entry.cve}>
                  <strong>{entry.cve}</strong>
                  <span>{entry.vendor} · {entry.product}</span>
                  {entry.ransomware && <em>RANSOMWARE-LINKED</em>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {feed && <p className="live-threatmap-note">{feed.notes}</p>}
    </div>
  );
}
