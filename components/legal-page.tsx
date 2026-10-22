import Link from 'next/link'

export function LegalPage({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return <main className="legal-page"><div className="legal-shell"><header className="legal-header"><Link href="/" className="workspace-brand"><span className="workspace-brand-mark" aria-hidden="true"><span /></span><span>AUGI</span></Link><Link href="/" className="legal-back">AUGI HOME ↗</Link></header><article className="legal-content"><span className="section-label">{eyebrow}</span><h1>{title}</h1>{children}</article><footer className="workspace-footer"><span>© 2026 AUGI</span><span>DEFENSIVE USE · PUBLIC RECORDS ONLY</span></footer></div></main>
}
