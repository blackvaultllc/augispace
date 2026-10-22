import type { Metadata } from "next";
import Link from "next/link";
import { Newspaper } from "lucide-react";
import { AugiPageShell } from "@/components/augi-page-shell";
import { listPublishedArticles } from "@/lib/pulse/articles";

export const metadata: Metadata = {
  title: "Trending — verified coverage",
  description:
    "Approved articles assembled from attributed, timestamped news sources. Facts live in the sources; AI commentary is always separated.",
};

export const revalidate = 120;

/**
 * Public article hub. ONLY status='published' rows are returned by the
 * server query — drafts, reviews, and rejected content are unreachable here
 * by construction (the query filters status, not the UI).
 */
export default async function TrendingPage() {
  const articles = await listPublishedArticles().catch(() => []);

  return (
    <AugiPageShell
      eyebrow="AUGI / INFINITY PULSE"
      title={
        <>
          Trends,
          <br />
          <span>verified.</span>
        </>
      }
      description="Every article here passed human review. Claims link to their named sources with publication and retrieval dates; AI-generated commentary is clearly separated from sourced facts."
    >
      <section
        className="section-wrap pulse-public"
        aria-label="Published articles"
      >
        {articles.length === 0 ? (
          <div className="pulse-public-empty">
            <Newspaper aria-hidden="true" />
            <h2>No published articles yet.</h2>
            <p>
              The pipeline is live: trends are discovered, drafts are assembled
              from attributed sources, and the owner reviews and approves each
              piece before it appears here. Nothing unreviewed ever publishes.
            </p>
          </div>
        ) : (
          <div className="pulse-public-grid">
            {articles.map((article) => (
              <article className="pulse-public-card" key={article.slug}>
                <span className="section-label">{article.category}</span>
                <h2>
                  <Link href={`/trending/${article.slug}`}>
                    {article.headline}
                  </Link>
                </h2>
                <p>{article.summary}</p>
                <small>
                  Published{" "}
                  {new Date(
                    article.published_at as string,
                  ).toLocaleDateString()}
                  {article.tags.length > 0 && ` · ${article.tags.join(", ")}`}
                </small>
              </article>
            ))}
          </div>
        )}
      </section>
    </AugiPageShell>
  );
}
