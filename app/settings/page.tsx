import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Award,
  BellRing,
  CreditCard,
  KeyRound,
  LockKeyhole,
  Settings as SettingsIcon,
  ShieldCheck,
  UserCog,
} from 'lucide-react'
import { AugiPageShell } from '@/components/augi-page-shell'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Settings & account' }

export const dynamic = 'force-dynamic'

/**
 * Member settings hub. Every destination here re-verifies authorization on
 * its own page — this hub only routes. Signed-out visitors see the public
 * entry points instead of member settings.
 */
export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const sections = user
    ? [
        {
          icon: UserCog,
          title: 'Your account',
          body: `Signed in as ${user.email ?? 'your account'}. Session security is handled by Supabase authentication.`,
          href: '/awards',
          link: 'Open your awards workspace',
        },
        {
          icon: CreditCard,
          title: 'Plans & billing',
          body: 'Compare tiers, upgrade, or manage your subscription through the secure Stripe billing portal.',
          href: '/plans',
          link: 'View plans & manage billing',
        },
        {
          icon: Award,
          title: 'Awards & achievements',
          body: 'Your private accomplishment timeline: add records, organize by category and year, upload certificates.',
          href: '/awards',
          link: 'Open awards',
        },
        {
          icon: BellRing,
          title: 'Reminders (coming soon)',
          body: 'Optional monthly or twice-monthly email reminders are planned. Nothing is sent until you explicitly opt in.',
          href: '/privacy',
          link: 'Read the privacy policy',
        },
        {
          icon: KeyRound,
          title: 'AI integrations (owner/staff)',
          body: 'Bring-your-own AI keys are planned. Owner-managed integrations live in the admin control plane.',
          href: '/workspace',
          link: 'Open the workspace',
        },
      ]
    : [
        {
          icon: UserCog,
          title: 'Create an account',
          body: 'Free accounts can use the community tools, save awards, and comment on food truck listings.',
          href: '/sign-up',
          link: 'Create your free account',
        },
        {
          icon: CreditCard,
          title: 'Plans & pricing',
          body: 'Start with the free domain check. Higher tiers add monthly investigation limits and evidence depth.',
          href: '/plans',
          link: 'Compare plans',
        },
        {
          icon: LockKeyhole,
          title: 'Sign in',
          body: 'Returning? Sign in to reach your saved investigations and member tools.',
          href: '/sign-in',
          link: 'Sign in',
        },
        {
          icon: KeyRound,
          title: 'Forgot your password?',
          body: 'Recovery links are single-use and expire. Request one from the sign-in page.',
          href: '/reset-password',
          link: 'Reset your password',
        },
      ]

  return (
    <AugiPageShell
      eyebrow="AUGI / SETTINGS"
      title={
        <>
          Your account,
          <br />
          <span>your controls.</span>
        </>
      }
      description="Manage what belongs to you: your plan, your records, and your privacy choices. AUGI collects as little as possible and every tool re-verifies access server-side."
    >
      <section className="section-wrap settings-grid" aria-label="Settings sections">
        <div className="settings-grid-inner">
          {sections.map(({ icon: Icon, title, body, href, link }) => (
            <article className="settings-card" key={title}>
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

      <section className="section-wrap settings-privacy" aria-labelledby="settings-privacy-title">
        <div className="definition-head">
          <ShieldCheck aria-hidden="true" />
          <span>PRIVACY CONTROLS</span>
        </div>
        <p className="settings-privacy-copy">
          Everything you save — awards, investigations, notes — is private to your account and
          scoped by row-level security. Files you upload live in private storage with expiring
          access links, never public URLs. Deleting a record deletes its file too.
        </p>
        <div className="settings-privacy-links">
          <Link href="/privacy">Privacy policy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/acceptable-use">Acceptable use</Link>
        </div>
      </section>

      <p className="section-wrap settings-footnote">
        <SettingsIcon aria-hidden="true" /> Deeper preference controls (reminder topics, AI
        provider selection) arrive with those features — nothing ships half-configured.
      </p>
    </AugiPageShell>
  )
}
