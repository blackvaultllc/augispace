'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  BadgeCheck,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleDot,
  Fingerprint,
  Globe2,
  LockKeyhole,
  MailCheck,
  Menu,
  Radar,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from 'lucide-react'
import { useState } from 'react'
import { PublicThreatBulletin } from '@/components/public-threat-bulletin'
import { PublicThreatTrend } from '@/components/public-threat-trend'

const capabilities = [
  {
    number: '01',
    icon: Globe2,
    title: 'Read the domain, not the person',
    copy: 'Inspect public mail-routing and sender-authentication signals without probing a mailbox or exposing private identity data.',
    tag: 'PUBLIC DNS ONLY',
  },
  {
    number: '02',
    icon: BrainCircuit,
    title: 'Turn signals into context',
    copy: 'AUGI is designed to translate technical posture into clear, evidence-led guidance people can act on.',
    tag: 'EXPLAINABLE BY DESIGN',
  },
  {
    number: '03',
    icon: Radar,
    title: 'Move from insight to action',
    copy: 'Build a stronger security habit with saved assessments, team workflows, and a path to the right reporting channels.',
    tag: 'BUILT FOR DEFENSE',
  },
]

const plans = [
  {
    name: 'Observer',
    price: '$0',
    detail: 'A thoughtful first look at public email-domain security.',
    features: ['3 domain checks each month', 'Core DNS signals', 'Plain-language guidance'],
    action: 'Try the demo',
    featured: false,
  },
  {
    name: 'Analyst',
    price: '$29',
    detail: 'More depth for people who investigate regularly.',
    features: ['30 domain checks each month', 'AI-assisted signal explanations', 'Saved reports and exports'],
    action: 'Explore Analyst',
    featured: true,
  },
  {
    name: 'Command',
    price: '$99',
    detail: 'Shared visibility for small security-minded teams.',
    features: ['150 domain checks each month', 'Up to 5 team members', 'Team reporting and case notes'],
    action: 'Explore Command',
    featured: false,
  },
]

function BrandMark() {
  return (
    <Link className="augi-brand" href="/" aria-label="AUGI home">
      <span className="augi-brand-mark"><Image src="/augi-serpent-mark.png" alt="" width={40} height={40} priority /></span>
      <span className="augi-brand-name">AUGI<span> / SERPENT INTELLIGENCE</span></span>
    </Link>
  )
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="site-header">
      <BrandMark />
      <button className="mobile-menu" type="button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
        <Menu aria-hidden="true" />
      </button>
      <nav className={menuOpen ? 'site-nav site-nav-open' : 'site-nav'} aria-label="Main navigation">
        <Link href="/approach" onClick={() => setMenuOpen(false)}>Our approach</Link>
        <Link href="/demo" onClick={() => setMenuOpen(false)}>Live demo</Link>
        <Link href="/plans" onClick={() => setMenuOpen(false)}>Plans</Link>
        <Link className="nav-signin" href="/sign-in" onClick={() => setMenuOpen(false)}>Log in</Link>
        <Link className="nav-login" href="/sign-up" onClick={() => setMenuOpen(false)}>Create account <ArrowUpRight aria-hidden="true" /></Link>
      </nav>
    </header>
  )
}

function Hero() {
  return (
    <section className="hero-section" id="top" aria-labelledby="hero-title">
      <div className="hero-copy">
        <div className="hero-kicker"><span className="pulse-dot" /> AUGI / ARTIFICIAL UNIVERSAL GENERAL INTELLIGENCE</div>
        <h1 id="hero-title">Know what&apos;s<br />behind an <span>email.</span></h1>
        <p className="hero-description">AUGI turns public email-domain signals into clear security context, so you can make your next move with more confidence.</p>
        <div className="hero-actions">
          <Link className="button-primary" href="/demo">Run a free check <ArrowRight aria-hidden="true" /></Link>
          <Link className="button-secondary" href="/approach">Explore AUGI <ArrowDownRight aria-hidden="true" /></Link>
        </div>
        <div className="hero-proof"><span className="proof-icon"><LockKeyhole aria-hidden="true" /></span><span>Your email stays yours. The demo checks the domain only.</span></div>
        <div className="hero-secondary-links"><Link href="/approach">Explore how AUGI works <ArrowUpRight aria-hidden="true" /></Link><Link href="/plans">View plans <ArrowUpRight aria-hidden="true" /></Link></div>
      </div>

      <div className="hero-visual" role="group" aria-label="Abstract visualization of connected email-security signals">
        <div className="hero-visual-grid" aria-hidden="true" />
        <div className="hero-orbit hero-orbit-one" aria-hidden="true" />
        <div className="hero-orbit hero-orbit-two" aria-hidden="true" />
        <Image className="hero-core" src="/augi-signal-core.png" alt="" width={1024} height={682} priority />
        <div className="signal-card signal-card-top"><span className="signal-card-icon"><Waypoints aria-hidden="true" /></span><div><span>DOMAIN SIGNALS</span><strong>Public, verifiable</strong></div><span className="signal-live">LIVE</span></div>
        <div className="signal-card signal-card-bottom"><span className="signal-card-icon signal-shield"><ShieldCheck aria-hidden="true" /></span><div><span>THE AUGI PRINCIPLE</span><strong>Insight without intrusion</strong></div><ArrowUpRight className="signal-card-arrow" aria-hidden="true" /></div>
        <div className="visual-caption"><span>01 / SIGNAL FIELD</span><span>DEFENSIVE INTELLIGENCE</span></div>
      </div>

      <div className="hero-index" aria-hidden="true"><span>01</span><span className="hero-index-line" /><span>INTELLIGENCE, MADE HUMAN</span></div>
    </section>
  )
}

export function Approach() {
  return (
    <section className="approach-section section-wrap" id="approach" aria-labelledby="approach-title">
      <div className="section-intro">
        <div className="section-label"><span>THE AUGI APPROACH</span><span className="section-label-line" /><span>BUILT FOR PEOPLE</span></div>
        <div className="section-heading-row">
          <h2 id="approach-title">Security context,<br /><span>without the noise.</span></h2>
          <p>One address can raise a lot of questions. AUGI starts with signals that can be checked, explains what they do and do not mean, and keeps private inbox content out of the picture.</p>
        </div>
      </div>
      <div className="capability-grid">
        {capabilities.map(({ number, icon: Icon, title, copy, tag }) => (
          <article className="capability-card" key={number}>
            <div className="capability-top"><span>{number} / 03</span><Icon aria-hidden="true" /></div>
            <h3>{title}</h3>
            <p>{copy}</p>
            <div className="capability-tag"><span />{tag}</div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function IntelligenceBand() {
  return (
    <section className="intelligence-band" aria-labelledby="band-title">
      <div className="band-glow" aria-hidden="true" />
      <div className="band-copy">
        <div className="section-label"><span>MEET YOUR SECURITY COPILOT</span><span className="section-label-line" /><span>AUGI / 01</span></div>
        <h2 id="band-title">Artificial intelligence.<br /><span>Human judgment.</span></h2>
        <p>Built to make technical security signals easier to understand, not to make decisions on your behalf. Every useful answer should connect back to evidence and a clear next step.</p>
        <Link className="text-link" href="/demo">See the signal demo <ArrowRight aria-hidden="true" /></Link>
      </div>
      <div className="band-graphic" aria-hidden="true">
        <div className="band-ring band-ring-one" />
        <div className="band-ring band-ring-two" />
        <div className="band-orb"><Sparkles /></div>
        <span className="band-node band-node-one" /><span className="band-node band-node-two" /><span className="band-node band-node-three" />
        <div className="band-orbit-label band-label-one">EVIDENCE</div>
        <div className="band-orbit-label band-label-two">CONTEXT</div>
        <div className="band-orbit-label band-label-three">ACTION</div>
      </div>
    </section>
  )
}

export function TrustSection() {
  const principles = [
    { icon: Fingerprint, title: 'Privacy-first by default', body: 'The sample check strips the mailbox name in your browser. Only the domain is sent for public DNS checks.' },
    { icon: BadgeCheck, title: 'Evidence over assumptions', body: 'A DNS posture signal is not proof of identity, intent, or compromise. AUGI keeps those distinctions clear.' },
    { icon: MailCheck, title: 'A defensive purpose', body: 'Use findings to protect accounts, improve domain security, or report a genuine incident through official channels.' },
  ]

  return (
    <section className="trust-section section-wrap" aria-labelledby="trust-title">
      <div className="trust-heading">
        <span className="eyebrow-chip"><ShieldCheck aria-hidden="true" /> OUR COMMITMENT</span>
        <h2 id="trust-title">Built to protect.<br /><span>Designed to respect.</span></h2>
        <p>AUGI assesses public domain configuration. It does not search private inboxes, expose passwords, or identify private individuals.</p>
      </div>
      <div className="trust-list">
        {principles.map(({ icon: Icon, title, body }, index) => (
          <article className="trust-item" key={title}>
            <span className="trust-number">0{index + 1}</span>
            <span className="trust-icon"><Icon aria-hidden="true" /></span>
            <div><h3>{title}</h3><p>{body}</p></div>
            <Check className="trust-check" aria-hidden="true" />
          </article>
        ))}
      </div>
    </section>
  )
}

export function Plans() {
  return (
    <section className="plans-section section-wrap" id="plans" aria-labelledby="plans-title">
      <div className="plans-heading">
        <div>
          <div className="section-label"><span>ACCESS THAT GROWS WITH YOU</span><span className="section-label-line" /><span>MONTHLY PLANS</span></div>
          <h2 id="plans-title">Start with a signal.<br /><span>Go deeper when ready.</span></h2>
        </div>
        <p>Start with the free domain check. Higher tiers are designed to add report depth, saved work, and team workflows.</p>
      </div>
      <div className="plans-grid">
        {plans.map((plan, index) => (
          <article className={plan.featured ? 'plan-card plan-card-featured' : 'plan-card'} key={plan.name}>
            <div className="plan-card-head"><span>0{index + 1} / TIER</span>{plan.featured && <span className="plan-recommended"><Sparkles aria-hidden="true" /> MOST POPULAR</span>}</div>
            <h3>{plan.name}</h3>
            <p className="plan-description">{plan.detail}</p>
            <div className="plan-price"><strong>{plan.price}</strong><span>/ month</span></div>
            <ul>{plan.features.map((feature) => <li key={feature}><Check aria-hidden="true" />{feature}</li>)}</ul>
            <PlanAction plan={plan} />
          </article>
        ))}
      </div>
      <p className="plan-note"><CircleDot aria-hidden="true" /> Plans stay within their published monthly limits. Sign in to manage access.</p>
    </section>
  )
}

export function SiteFooter() {
  return (
    <footer className="site-footer section-wrap">
      <div className="footer-main"><BrandMark /><p>Intelligence in service of people.<br />Built by Serpent Intelligence Systems.</p></div>
      <div className="footer-links"><Link href="/approach">Our approach</Link><Link href="/demo">Try the demo</Link><Link href="/plans">Plans</Link><Link href="/careers">Careers</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/acceptable-use">Acceptable use</Link></div>
      <div className="footer-bottom"><span>© 2026 SERPENT INTELLIGENCE SYSTEMS</span><span><span className="pulse-dot" /> PUBLIC SIGNALS · DEFENSIVE USE</span><Link href="/">BACK TO HOME <ArrowUpRight aria-hidden="true" /></Link></div>
    </footer>
  )
}

export function AugiLanding() {
  return (
    <main className="augi-site">
      <div className="site-frame">
        <SiteHeader />
        <Hero />
        <div className="hero-divider" />
        <PublicThreatBulletin />
        <section className="landing-paths section-wrap" aria-labelledby="landing-paths-title">
          <div className="section-label"><span>EXPLORE AUGI</span><span className="section-label-line" /><span>CHOOSE YOUR NEXT STEP</span></div>
          <h2 id="landing-paths-title">A focused starting point<br /><span>for safer decisions.</span></h2>
          <div className="landing-path-grid">
            <Link href="/demo" className="landing-path-card"><span>01 / CHECK</span><strong>Read a domain’s public signal</strong><p>Run a privacy-first DNS check without opening an account.</p><ArrowUpRight aria-hidden="true" /></Link>
            <Link href="/approach" className="landing-path-card"><span>02 / METHOD</span><strong>Understand the AUGI approach</strong><p>See how evidence, context, and defensive action fit together.</p><ArrowUpRight aria-hidden="true" /></Link>
            <Link href="/plans" className="landing-path-card"><span>03 / ACCESS</span><strong>Find your level of depth</strong><p>Explore plan access for independent investigators and teams.</p><ArrowUpRight aria-hidden="true" /></Link>
          </div>
        </section>
        <section className="truth-gallery section-wrap" aria-labelledby="truth-gallery-title">
          <div className="truth-gallery-heading"><div><div className="section-label"><span>THE WORK IS REAL</span><span className="section-label-line" /><span>PUBLIC EVIDENCE / HUMAN CARE</span></div><h2 id="truth-gallery-title">No theater.<br /><span>Just protection.</span></h2></div><p>Real people, public signals, and clear boundaries. AUGI is built to make security understandable without pretending that a single score can tell the whole story.</p></div>
          <div className="truth-gallery-grid"><figure className="truth-image truth-image-wide"><Link href="/learn/evidence" aria-label="Read the full guide: Evidence"><Image src="/augi-evidence-desk.png" alt="Security researcher reviewing public evidence at a desk" width={1200} height={760} /><figcaption><span>01 / EVIDENCE</span><strong>Trace every conclusion back to something verifiable.</strong></figcaption></Link></figure><figure className="truth-image"><Link href="/learn/signal" aria-label="Read the full guide: Signal"><Image src="/augi-public-signal.png" alt="Public communications infrastructure at blue hour" width={900} height={760} /><figcaption><span>02 / SIGNAL</span><strong>Read what the public layer can actually tell you.</strong></figcaption></Link></figure><figure className="truth-image"><Link href="/learn/protection" aria-label="Read the full guide: Protection"><Image src="/augi-protection-network.png" alt="Security team reviewing a network map" width={900} height={760} /><figcaption><span>03 / PROTECTION</span><strong>Turn clarity into a safer next step.</strong></figcaption></Link></figure><figure className="truth-image"><Link href="/learn/community" aria-label="Read the full guide: Community"><Image src="/augi-community-research.png" alt="Black woman and Native American Indigenous man collaborating on security research" width={900} height={760} /><figcaption><span>04 / COMMUNITY</span><strong>Security knowledge is stronger when more lived experience is in the room.</strong></figcaption></Link></figure><figure className="truth-image"><Link href="/learn/collaboration" aria-label="Read the full guide: Collaboration"><Image src="/augi-diverse-protection.png" alt="Diverse security team reviewing a network topology" width={900} height={760} /><figcaption><span>05 / COLLABORATION</span><strong>Make the next decision together, with context.</strong></figcaption></Link></figure></div>
        </section>
        <section className="signal-lab section-wrap" aria-labelledby="signal-lab-title">
          <div className="signal-lab-heading"><div><div className="section-label"><span>THE SIGNAL LAB</span><span className="section-label-line" /><span>LEARN THE GRAPH</span></div><h2 id="signal-lab-title">Security posture,<br /><span>made visible.</span></h2></div><p>Like a market chart, a security graph shows movement and pressure over time. It is a teaching surface—not a promise, prediction, or identity verdict.</p></div>
          <div className="signal-lab-grid">
            <PublicThreatTrend />
            <div className="signal-definitions"><div className="definition-head"><BookOpen aria-hidden="true" /><span>FIELD DEFINITIONS</span></div><dl><div><dt>Posture index</dt><dd>A teaching summary of how consistently a domain publishes protective signals.</dd></div><div><dt>Evidence</dt><dd>The public record behind a result: DNS answers, timestamps, and source context.</dd></div><div><dt>Exposure</dt><dd>A condition that may increase risk. It is not proof that an account or person is compromised.</dd></div><div><dt>Trend</dt><dd>Movement across checks. Trends need context and should not be read like financial advice.</dd></div></dl></div>
          </div>
        </section>
        <SiteFooter />
      </div>
    </main>
  )
}

function PlanAction({ plan }: { plan: (typeof plans)[number] }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  if (plan.name === 'Observer') {
    return (
      <Link className="plan-action" href="/demo">{plan.action}<ChevronRight aria-hidden="true" /></Link>
    )
  }

  async function subscribe() {
    setBusy(true)
    setMessage('')
    try {
      const planKey = plan.name === 'Analyst' ? 'analyst' : 'command'
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey }),
      })
      const payload = await response.json() as { url?: string; error?: string }
      if (payload.url) {
        window.location.href = payload.url
        return
      }
      setMessage(payload.error || 'Billing is not ready yet.')
    } catch {
      setMessage('Billing could not be reached. Try again shortly.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="plan-action-wrap">
      <button
        type="button"
        className={plan.featured ? 'plan-action plan-action-featured' : 'plan-action'}
        onClick={subscribe}
        disabled={busy}
      >
        {busy ? 'OPENING CHECKOUT…' : plan.action}
        <ChevronRight aria-hidden="true" />
      </button>
      {message && <small className="plan-action-note" role="alert">{message} <Link href="/sign-up">Create an account</Link> first if you are not signed in.</small>}
    </span>
  )
}
