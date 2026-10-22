import type { Metadata } from "next";
import Link from "next/link";
import {
  CircleAlert,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  MapPin,
  MessagesSquare,
  Radar,
  ShieldCheck,
  Truck,
  UserCog,
} from "lucide-react";
import { AugiPageShell } from "@/components/augi-page-shell";

export const metadata: Metadata = { title: "Help & guides" };

const guides = [
  {
    icon: Radar,
    title: "Domain signal checks",
    body: "How the free domain check reads public MX, SPF, and DMARC records — and what the score does and does not mean. No inbox is ever accessed.",
    href: "/learn/evidence",
    link: "Read the evidence guide",
  },
  {
    icon: MapPin,
    title: "IP dossiers & the radar",
    body: "What an IP dossier contains, where its data comes from (public registries, reverse DNS, AbuseIPDB), and why a location is an area, never a person.",
    href: "/approach",
    link: "See the AUGI approach",
  },
  {
    icon: Truck,
    title: "Food truck tracker",
    body: "Operators register with a real business license, publish a live location, and the community finds them. How verification and comments work.",
    href: "/food-trucks",
    link: "Open the tracker",
  },
  {
    icon: Fingerprint,
    title: "Awards & achievements",
    body: "Your private timeline of certificates, milestones, and accomplishments. Files are stored privately with expiring access links.",
    href: "/awards",
    link: "Open your awards",
  },
  {
    icon: KeyRound,
    title: "Account & billing",
    body: "Plans, monthly investigation limits, and how to manage or cancel a subscription. Billing is handled by Stripe; AUGI never stores card numbers.",
    href: "/plans",
    link: "View plans",
  },
  {
    icon: LockKeyhole,
    title: "Privacy & your data",
    body: "What AUGI collects (very little), what it never touches (your inbox), and how to delete your account and records.",
    href: "/privacy",
    link: "Read the privacy policy",
  },
];

const quickAnswers = [
  {
    q: "Do you read my email?",
    a: "No. The domain check uses only the domain part of an address you type — the mailbox name never leaves your browser.",
  },
  {
    q: "A score says a domain is risky. Is it compromised?",
    a: "No. The score summarizes public DNS configuration only. Missing SPF or DMARC is a configuration gap, not proof of compromise.",
  },
  {
    q: "Can I recover my password?",
    a: 'Yes. Use "Forgot password?" on the sign-in page. Recovery links are single-use and expire.',
  },
  {
    q: "Is the food truck tracker free?",
    a: "Yes — free for operators to list and free to browse. A verified business license is required to appear on the map.",
  },
];

export default function HelpPage() {
  return (
    <AugiPageShell
      eyebrow="AUGI / HELP & GUIDES"
      title={
        <>
          Straight answers,
          <br />
          <span>no theater.</span>
        </>
      }
      description="How each AUGI tool works, what it can and cannot tell you, and where to go next. If something here is unclear, it is a bug in our explanation — tell the owner."
    >
      <section
        className="section-wrap help-guides"
        aria-label="Guides by topic"
      >
        <div className="help-guides-grid">
          {guides.map(({ icon: Icon, title, body, href, link }) => (
            <article className="help-guide-card" key={title}>
              <Icon aria-hidden="true" />
              <h2>{title}</h2>
              <p>{body}</p>
              <Link className="text-link" href={href}>
                {link} <span aria-hidden="true">&rarr;</span>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="section-wrap help-faq" aria-labelledby="faq-title">
        <h2 id="faq-title">Quick answers</h2>
        <dl className="help-faq-list">
          {quickAnswers.map(({ q, a }) => (
            <div key={q}>
              <dt>
                <MessagesSquare aria-hidden="true" /> {q}
              </dt>
              <dd>{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        className="section-wrap help-boundaries"
        aria-labelledby="boundaries-title"
      >
        <div className="definition-head">
          <ShieldCheck aria-hidden="true" />
          <span>WHAT AUGI DOES NOT DO</span>
        </div>
        <ul className="help-boundaries-list">
          <li>
            <CircleAlert aria-hidden="true" /> It does not access private
            inboxes, read messages, or expose passwords.
          </li>
          <li>
            <CircleAlert aria-hidden="true" /> It does not identify private
            individuals from IPs, domains, or DNS records.
          </li>
          <li>
            <CircleAlert aria-hidden="true" /> It does not provide hacking,
            surveillance, or retaliation assistance.
          </li>
        </ul>
      </section>
    </AugiPageShell>
  );
}
