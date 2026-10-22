import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, BookOpen } from "lucide-react";
import { AugiPageShell } from "@/components/augi-page-shell";
import { learnTopics, getLearnTopic } from "@/lib/learn-topics";

export function generateStaticParams() {
  return learnTopics.map((topic) => ({ slug: topic.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const topic = getLearnTopic(slug);
  return { title: topic ? topic.title : "Learn — AUGI" };
}

export default async function LearnTopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const topic = getLearnTopic(slug);
  if (!topic) notFound();
  const others = learnTopics.filter((item) => item.slug !== topic.slug);

  return (
    <AugiPageShell
      eyebrow={`AUGI / LEARN · ${topic.number}`}
      title={
        <>
          {topic.title.split(":")[0]}
          <br />
          <span>
            {topic.title.split(":").slice(1).join(":").trim() || "In depth"}.
          </span>
        </>
      }
      description={topic.summary}
    >
      <section
        className="learn-section section-wrap"
        aria-label={`${topic.title} — full guide`}
      >
        <Link className="learn-back" href="/#truth-gallery">
          <ArrowLeft aria-hidden="true" /> Back to the gallery
        </Link>

        <figure className="learn-hero">
          <Image src={topic.image} alt="" width={1200} height={700} priority />
          <figcaption>
            <span>THE WORK IS REAL / {topic.number}</span>
            <strong>{topic.title}</strong>
          </figcaption>
        </figure>

        {topic.sections.map((section) => (
          <article className="learn-block" key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </article>
        ))}

        <aside className="learn-sources" aria-label="Primary sources">
          <div className="definition-head">
            <BookOpen aria-hidden="true" />
            <span>PRIMARY SOURCES</span>
          </div>
          <ul>
            {topic.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.label} <ArrowUpRight aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </aside>

        <p className="learn-disclaimer">{topic.disclaimer}</p>

        <nav className="learn-more" aria-label="Continue learning">
          <h2>Keep reading</h2>
          <div className="learn-more-grid">
            {others.map((other) => (
              <Link
                className="learn-more-card"
                href={`/learn/${other.slug}`}
                key={other.slug}
              >
                <span>
                  {other.number} / {other.title.split(":")[0].toUpperCase()}
                </span>
                <strong>
                  {other.title.split(":").slice(1).join(":").trim()}
                </strong>
                <p>{other.summary.slice(0, 110)}…</p>
                <ArrowUpRight aria-hidden="true" />
              </Link>
            ))}
          </div>
        </nav>
      </section>
    </AugiPageShell>
  );
}
