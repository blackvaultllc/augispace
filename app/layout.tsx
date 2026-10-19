import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'AGAMOSS — Email Domain Intelligence',
    template: '%s | AGAMOSS',
  },
  description: 'Review public email-domain DNS signals, including MX, SPF, and DMARC configuration, with clear defensive context.',
  applicationName: 'AGAMOSS',
  keywords: [
    'email domain security',
    'email security posture',
    'SPF DMARC lookup',
    'email authentication analysis',
    'domain security intelligence',
    'AGAMOSS',
    'Serpent Intelligence Systems',
  ],
  openGraph: {
    title: 'AGAMOSS — Email Domain Intelligence',
    description: 'Understand public email-domain DNS signals with privacy-first, evidence-led guidance.',
    type: 'website',
    siteName: 'AGAMOSS',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AGAMOSS — Email Domain Intelligence',
    description: 'Understand public email-domain DNS signals with privacy-first, evidence-led guidance.',
  },
  robots: { index: true, follow: true },
  generator: 'v0.app',
  icons: {
    icon: [{ url: '/augi-serpent-mark.png', type: 'image/png' }],
    apple: '/augi-serpent-mark.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#070b0f',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
