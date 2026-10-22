import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";

export const metadata: Metadata = { title: "Service availability — AUGI" };

export default function UnavailableRegionPage() {
  return (
    <main className="region-page">
      <Link className="region-brand" href="/" aria-label="AUGI home">AUGI</Link>
      <section className="region-panel" aria-labelledby="region-title">
        <MapPin aria-hidden="true" />
        <h1 id="region-title">AUGI is available in the United States.</h1>
        <p>
          Our public services — the live threat map, the domain checker, the
          budget planner, and the food truck tracker — are currently offered to
          visitors in the United States only.
        </p>
        <p>
          If you believe you are seeing this page in error, or you are an
          existing account holder traveling abroad, contact the owner and we
          will sort it out.
        </p>
        <a className="region-back" href="/">
          Return to the home page
        </a>
      </section>
    </main>
  );
}
