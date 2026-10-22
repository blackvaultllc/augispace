'use client'

import Link from 'next/link'
import { ArrowRight, ArrowUpRight, LockKeyhole } from 'lucide-react'
import { SiteFooter, SiteHeader } from '@/components/augi-landing'

export function AugiPageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: React.ReactNode
  description: string
  children: React.ReactNode
}) {
  return (
    <main className="augi-site augi-inner-site">
      <div className="site-frame">
        <SiteHeader />
        <section className="inner-hero section-wrap" aria-labelledby="inner-title">
          <div className="inner-hero-copy">
            <div className="section-label"><span>{eyebrow}</span><span className="section-label-line" /></div>
            <h1 id="inner-title">{title}</h1>
            <p>{description}</p>
            <div className="inner-hero-proof"><LockKeyhole aria-hidden="true" /><span>Public signals only. Encrypted in transit. Built for defensive use.</span></div>
          </div>
          <div className="inner-hero-index" aria-hidden="true"><span>AUGI</span><strong>01</strong></div>
        </section>
        <div className="inner-divider" />
        {children}
        <section className="inner-cta section-wrap" aria-label="Continue with AUGI">
          <div><span className="section-label">READY WHEN YOU ARE</span><h2>Explore a safer<br /><span>next signal.</span></h2></div>
          <div className="inner-cta-actions"><Link className="button-primary" href="/sign-up">Create an account <ArrowRight aria-hidden="true" /></Link><Link className="text-link" href="/demo">Try the free check <ArrowUpRight aria-hidden="true" /></Link></div>
        </section>
        <SiteFooter />
      </div>
    </main>
  )
}
