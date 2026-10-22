import type { Metadata } from "next";
import { AugiPageShell } from "@/components/augi-page-shell";

export const metadata: Metadata = { title: "Careers at AUGI" };

const roles = [
  {
    title: "Threat Intelligence Analyst",
    type: "Full-time · Remote",
    summary:
      "Triage verified threat feeds (CISA KEV, AbuseIPDB, public registries), validate radar contacts, and write evidence-led briefings for members.",
    look: 'Comfortable reading raw feeds and saying "we don\'t know" instead of guessing. OSINT or SOC background helps.',
  },
  {
    title: "Staff Administrator",
    type: "Part-time · Remote",
    summary:
      "Run the member onboarding experience, answer access requests, and keep the staff invite list tidy from the owner control plane.",
    look: "Clear written communication and a defensive-security mindset. No engineering required.",
  },
  {
    title: "Platform Engineer (Contract)",
    type: "Contract · Remote",
    summary:
      "Extend the integration framework: new encrypted back-office credentials, new verified feeds, and billing-connected member tiers.",
    look: "TypeScript/Next.js, PostgreSQL, and a habit of leaving honest status messages when a feed is down.",
  },
];

const principles = [
  [
    "Evidence over drama",
    "Every claim traces to a named public source. If a feed is down, we say so — the radar never invents contacts.",
  ],
  [
    "Defensive only",
    "AUGI observes public signals. No intrusion, no scanning of systems you do not own.",
  ],
  [
    "Privacy boundaries",
    "Coordinates stay in the browser tab. API keys are encrypted server-side and never exposed to members.",
  ],
  [
    "Honest limits",
    "We state what a signal can and cannot prove. An IP address is not a person.",
  ],
];

export default function CareersPage() {
  return (
    <AugiPageShell
      eyebrow="AUGI / CAREERS"
      title={
        <>
          Build the <span>honest</span> radar.
        </>
      }
      description="AUGI is a small, evidence-first intelligence platform. We hire people who prefer verification to hype and can say 'unverified' out loud."
    >
      <section
        className="careers-section section-wrap"
        aria-labelledby="careers-title"
      >
        <div className="careers-grid">
          {roles.map((role) => (
            <article className="careers-role" key={role.title}>
              <span className="section-label">{role.type}</span>
              <h2>{role.title}</h2>
              <p>{role.summary}</p>
              <p className="careers-look">
                <strong>Who we look for:</strong> {role.look}
              </p>
              <a
                className="careers-apply"
                href="mailto:blackhatterxvi@gmail.com?subject=AUGI%20application"
              >
                Apply by email
              </a>
            </article>
          ))}
        </div>

        <div className="careers-principles" aria-label="How AUGI works">
          <h2 className="section-heading">How we work</h2>
          <div className="careers-principles-grid">
            {principles.map(([title, body]) => (
              <article key={title}>
                <strong>{title}</strong>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </AugiPageShell>
  );
}
