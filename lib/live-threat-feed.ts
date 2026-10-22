import { isIP } from "node:net";
import {
  getIntegrationSecret,
  INTEGRATION_KEYS,
} from "@/lib/integration-secrets";

/**
 * Verified live threat intelligence feed for the tactical radar.
 *
 * Sources:
 *  - CISA Known Exploited Vulnerabilities (KEV) catalog — authoritative,
 *    updated by CISA, no key required.
 *  - AbuseIPDB blocklist (top reported abusive IPs) — requires the owner's
 *    API key, stored encrypted server-side. Optional.
 *
 * Every beacon carries the real source data; nothing is invented. Coordinates
 * come from ipwho.is public registry lookups of the source IPs.
 */

export const CISA_KEV_URL =
  "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
export const ABUSEIPDB_BLOCKLIST_URL =
  "https://api.abuseipdb.com/api/v2/blocklist";

export type ThreatBeacon = {
  id: string;
  kind: "kev" | "abuse" | "operator" | "ip" | "mail" | "bluetooth";
  label: string;
  latitude: number;
  longitude: number;
  source: string;
  details: [string, string][];
  verified: boolean;
};

type KevEntry = {
  cveID?: string;
  vendorProject?: string;
  product?: string;
  vulnerabilityName?: string;
  dateAdded?: string;
  shortDescription?: string;
  knownRansomwareCampaignUse?: string;
  cwes?: string[];
};

export type LiveThreatFeed = {
  generatedAt: string;
  sources: {
    name: string;
    url: string;
    count: number;
    verified: boolean;
    configured: boolean;
  }[];
  kev: {
    totalKnownExploited: number;
    addedLast7Days: number;
    addedLast30Days: number;
    ransomwareLinkedLast30Days: number;
    recent: {
      cve: string;
      name: string;
      vendor: string;
      product: string;
      dateAdded: string;
      ransomware: boolean;
      description: string;
    }[];
  };
  beacons: ThreatBeacon[];
  notes: string;
};

const GEO_TIMEOUT_MS = 5000;

async function fetchKev() {
  const response = await fetch(CISA_KEV_URL, {
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`CISA KEV returned ${response.status}`);
  return (await response.json()) as { vulnerabilities?: KevEntry[] };
}

async function fetchAbuseBlocklist(apiKey: string | null) {
  if (!apiKey) return null;
  try {
    const response = await fetch(ABUSEIPDB_BLOCKLIST_URL, {
      headers: { Key: apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      data?: {
        ipAddress?: string;
        abuseConfidenceScore?: number;
        lastReportedAt?: string;
      }[];
    };
    return (data.data ?? []).slice(0, 25);
  } catch {
    return null;
  }
}

async function locateIp(
  ip: string,
): Promise<{
  latitude: number;
  longitude: number;
  country: string | null;
  city: string | null;
} | null> {
  if (!isIP(ip)) return null;
  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(GEO_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      success?: boolean;
      latitude?: number;
      longitude?: number;
      country?: string;
      city?: string;
    };
    if (
      !data.success ||
      typeof data.latitude !== "number" ||
      typeof data.longitude !== "number"
    )
      return null;
    return {
      latitude: data.latitude,
      longitude: data.longitude,
      country: data.country ?? null,
      city: data.city ?? null,
    };
  } catch {
    return null;
  }
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

export async function getLiveThreatFeed(): Promise<LiveThreatFeed> {
  const [kevResult, apiKey] = await Promise.all([
    fetchKev().catch(() => null),
    getIntegrationSecret(INTEGRATION_KEYS.abuseipdb).catch(() => null),
  ]);

  const vulnerabilities = kevResult?.vulnerabilities ?? [];
  const now = new Date();
  const inLastDays = (dateAdded: string | undefined, days: number) => {
    if (!dateAdded) return false;
    const date = new Date(`${dateAdded}T00:00:00Z`);
    return (
      !Number.isNaN(date.getTime()) && date >= daysAgo(days) && date <= now
    );
  };

  const recentKev = vulnerabilities
    .filter((entry) => entry.cveID)
    .sort((a, b) => (b.dateAdded ?? "").localeCompare(a.dateAdded ?? ""))
    .slice(0, 40);

  const addedLast7 = vulnerabilities.filter((entry) =>
    inLastDays(entry.dateAdded, 7),
  ).length;
  const addedLast30 = vulnerabilities.filter((entry) =>
    inLastDays(entry.dateAdded, 30),
  ).length;
  const ransomware30 = vulnerabilities.filter(
    (entry) =>
      inLastDays(entry.dateAdded, 30) &&
      entry.knownRansomwareCampaignUse === "Known",
  ).length;

  const abuseList = await fetchAbuseBlocklist(apiKey);

  // Geo-locate a sample of AbuseIPDB blocklist entries (public registry data).
  const abuseBeacons: ThreatBeacon[] = [];
  if (abuseList) {
    const located = await Promise.all(
      abuseList.slice(0, 15).map(async (entry) => {
        const ip = entry.ipAddress ?? "";
        if (!ip) return null;
        const geo = await locateIp(ip);
        if (!geo) return null;
        return {
          ip,
          geo,
          score: entry.abuseConfidenceScore ?? null,
          lastReportedAt: entry.lastReportedAt ?? null,
        };
      }),
    );
    for (const item of located) {
      if (!item) continue;
      abuseBeacons.push({
        id: `abuse-${item.ip}`,
        kind: "abuse",
        label: `${item.ip} · ${[item.geo.city, item.geo.country].filter(Boolean).join(", ") || "Registry location"}`,
        latitude: item.geo.latitude,
        longitude: item.geo.longitude,
        source: "AbuseIPDB blocklist · community-reported abuse",
        verified: true,
        details: [
          ["IP", item.ip],
          [
            "ABUSE SCORE",
            item.score !== null ? `${item.score}%` : "Not reported",
          ],
          [
            "LAST REPORTED",
            item.lastReportedAt
              ? new Date(item.lastReportedAt).toLocaleDateString()
              : "Unknown",
          ],
          [
            "AREA",
            [item.geo.city, item.geo.country].filter(Boolean).join(", ") ||
              "Registry location",
          ],
        ],
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    sources: [
      {
        name: "CISA Known Exploited Vulnerabilities",
        url: CISA_KEV_URL,
        count: vulnerabilities.length,
        verified: true,
        configured: true,
      },
      {
        name: "AbuseIPDB blocklist",
        url: "https://www.abuseipdb.com/",
        count: abuseBeacons.length,
        verified: true,
        configured: !!apiKey,
      },
    ],
    kev: {
      totalKnownExploited: vulnerabilities.length,
      addedLast7Days: addedLast7,
      addedLast30Days: addedLast30,
      ransomwareLinkedLast30Days: ransomware30,
      recent: recentKev.map((entry) => ({
        cve: entry.cveID ?? "",
        name: entry.vulnerabilityName ?? entry.cveID ?? "",
        vendor: entry.vendorProject ?? "Unknown vendor",
        product: entry.product ?? "Unknown product",
        dateAdded: entry.dateAdded ?? "",
        ransomware: entry.knownRansomwareCampaignUse === "Known",
        description: entry.shortDescription ?? "",
      })),
    },
    beacons: [...abuseBeacons],
    notes:
      "Every contact on this radar comes from a named, verifiable public feed. KEV entries are vulnerabilities CISA has confirmed as exploited in the wild; AbuseIPDB entries are IPs reported for abusive behavior by its community. Neither proves who is behind an address, and location reflects IP registry data, not a person.",
  };
}
