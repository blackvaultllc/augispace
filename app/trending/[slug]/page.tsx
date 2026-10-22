import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock3, ExternalLink } from "lucide-react";
import { AugiPageShell } from "@/components/augi-page-shell";
import { getPublishedArticle } from "@/lib/pulse/articles";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedArticle(slug).catch(() => null);
  if (!article) return { title: "Article not found" };
  return {
    title: article.seo_title || article.headline,
    description: article.meta_description || article.summary,
    alternates: { canonical: `/trending/${article.slug}` },
    openGraph: {
      title: article.headline,
      description: article.summary,
      type: "article",
    },
  };
}

/**
 * Public article detail. getPublishedArticle filters status='published' in
 * SQL — drafts and withdrawn pieces 404 here regardless of the URL.
 * Sourced facts and AI commentary are rendered in visibly distinct sections.
 */
export default async function TrendingArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getPublishedArticle(slug).catch(() => null);
  if (!article) notFound();

  const sources = (article.sources ?? []) as {
    title: string;
    url: string;
    publisher: string;
    published_at: string | null;
    retrieved_at: string;
  }[];

  return (
    <AugiPageShell
      eyebrow={`AUGI / INFINITY PULSE · ${article.category.toUpperCase()}`}
      title={article.headline}
      description={article.summary}
    >
      <article className="section-wrap pulse-article">
        <p className="pulse-article-meta">
          <Clock3 aria-hidden="true" /> Published{" "}
          {new Date(article.published_at as string).toLocaleString()} · Updated{" "}
          {new Date(article.updated_at as string).toLocaleDateString()}
        </p>

        {/* Sourced body: linked facts from named publishers. */}
        <div className="pulse-article-body">
          {renderMarkdown(article.body_md as string)}
        </div>

        {/* AI commentary: separate, labeled, below the fold. */}
        {article.analysis_md ? (
          <aside
            className="pulse-article-analysis"
            aria-label="AI-generated analysis (not sourced fact)"
          >
            <strong>AI-generated analysis — not sourced fact</strong>
            <div>{renderMarkdown(article.analysis_md as string)}</div>
          </aside>
        ) : null}

        <section
          className="pulse-article-sources"
          aria-labelledby="pulse-sources-title"
        >
          <h2 id="pulse-sources-title">Source references ({sources.length})</h2>
          <ol>
            {sources.map((source, index) => (
              <li key={index}>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.title} <ExternalLink aria-hidden="true" />
                </a>
                <small>
                  {" "}
                  {source.publisher} · published{" "}
                  {source.published_at
                    ? new Date(source.published_at).toLocaleDateString()
                    : "date unknown"}{" "}
                  · retrieved {new Date(source.retrieved_at).toLocaleString()}
                </small>
              </li>
            ))}
          </ol>
          <p className="pulse-article-note">
            Claims live in the linked sources. AUGI does not assert outcomes
            beyond what each source states, and AI commentary is never evidence.
          </p>
        </section>

        <Link className="text-link" href="/trending">
          &larr; Back to all trending articles
        </Link>
      </article>
    </AugiPageShell>
  );
}

/** Minimal markdown rendering for the curated article body (links, bold, lists). */
function renderMarkdown(md: string) {
  const escaped = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const withLinks = escaped.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  const withBold = withLinks.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  const lines = withBold.split("\n");
  const blocks: string[] = [];
  let listBuffer: string[] = [];
  for (const line of lines) {
    if (line.startsWith("- ")) {
      listBuffer.push(`<li>${line.slice(2)}</li>`);
      continue;
    }
    if (listBuffer.length) {
      blocks.push(`<ul>${listBuffer.join("")}</ul>`);
      listBuffer = [];
    }
    if (line.startsWith("## ")) blocks.push(`<h2>${line.slice(3)}</h2>`);
    else if (line.startsWith("_") && line.endsWith("_"))
      blocks.push(`<em>${line.slice(1, -1)}</em>`);
    else if (line.trim()) blocks.push(`<p>${line}</p>`);
  }
  if (listBuffer.length) blocks.push(`<ul>${listBuffer.join("")}</ul>`);
  return blocks.map((block, i) => (
    <span key={i} dangerouslySetInnerHTML={{ __html: block }} />
  ));
}
