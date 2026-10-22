'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BookOpen,
  CircleHelp,
  Ellipsis,
  Home,
  Map,
  Settings,
} from 'lucide-react'

/**
 * Persistent mobile bottom navigation (visible below 760px only, via CSS).
 *
 * Home sits at the center per the AUGI mobile direction. Radar, Awards,
 * Help, and Settings are the primary tabs; a More sheet organizes the less
 * frequent destinations (approach, food trucks, compliance, plans, sign
 * in/up).
 *
 * Hidden on surfaces with their own navigation (workspace/admin/auth) to
 * avoid double navigation confusion. Server pages re-verify roles, so this
 * bar is convenience, not an authorization boundary.
 */

const primary = [
  { href: '/demo', label: 'Radar', icon: Map },
  { href: '/awards', label: 'Awards', icon: BookOpen },
  { href: '/', label: 'Home', icon: Home, center: true },
  { href: '/help', label: 'Help', icon: CircleHelp },
  { href: '/settings', label: 'Settings', icon: Settings },
]

const more = [
  { href: '/approach', label: 'Our approach' },
  { href: '/food-trucks', label: 'Food truck tracker' },
  { href: '/compliance', label: 'Law & compliance' },
  { href: '/plans', label: 'Plans & pricing' },
  { href: '/sign-in', label: 'Sign in' },
  { href: '/sign-up', label: 'Create account' },
]

export function MobileBottomNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  if (
    pathname.startsWith('/workspace') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/sign-') ||
    pathname.startsWith('/reset-password')
  )
    return null

  const isActive = (href: string, center?: boolean) =>
    center ? pathname === '/' : pathname.startsWith(href)

  return (
    <>
      {moreOpen && (
        <div
          className="mobile-more-backdrop"
          onClick={() => setMoreOpen(false)}
          aria-hidden="true"
        />
      )}
      <nav className="mobile-bottom-nav" aria-label="Primary mobile navigation">
        {moreOpen && (
          <div className="mobile-more-sheet" role="dialog" aria-label="More destinations">
            {more.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="mobile-more-link"
                onClick={() => setMoreOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
        <div className="mobile-bottom-nav-row">
          {primary.map(({ href, label, icon: Icon, center }) => (
            <Link
              key={href}
              href={href}
              className={`mobile-tab${center ? ' is-center' : ''}${isActive(href, center) ? ' is-active' : ''}`}
              aria-current={isActive(href, center) ? 'page' : undefined}
              onClick={() => setMoreOpen(false)}
            >
              <span className="mobile-tab-icon" aria-hidden="true">
                <Icon />
              </span>
              <span className="mobile-tab-label">{label}</span>
            </Link>
          ))}
          <button
            type="button"
            className="mobile-tab"
            aria-expanded={moreOpen}
            aria-label={moreOpen ? 'Close more destinations' : 'Open more destinations'}
            onClick={() => setMoreOpen((o) => !o)}
          >
            <span className="mobile-tab-icon" aria-hidden="true">
              <Ellipsis />
            </span>
            <span className="mobile-tab-label">More</span>
          </button>
        </div>
      </nav>
    </>
  )
}
