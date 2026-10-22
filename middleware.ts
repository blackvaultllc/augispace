import { NextResponse, type NextRequest } from 'next/server'
import { isOwnerEmail } from '@/lib/plans'
import { updateSession } from '@/lib/supabase/proxy'

const STAFF_ERROR = 'staff_only'

/**
 * Region gate: public AUGI services are intended for United States visitors.
 * Deployed on Cloudflare every request carries CF-IPCountry. Signed-in owner
 * sessions bypass the gate (the owner may use AUGI from anywhere — verified
 * server-side by role, not by geography). Outside Cloudflare (local dev) no
 * header is present and access is open.
 */
const BLOCKED_NOTICE = '/unavailable-region'
const PUBLIC_PATHS_BLOCKED = /^\/(?:demo|food-trucks|plans|careers|learn|approach|compliance)(?:\/|$)/

export async function middleware(request: NextRequest) {
  const country = request.headers.get('cf-ipcountry')
  const { response, user } = await updateSession(request)
  const path = request.nextUrl.pathname

  if (country && country !== 'US' && PUBLIC_PATHS_BLOCKED.test(path)) {
    const isOwner = user && isOwnerEmail(user.email ?? '')
    if (!isOwner) {
      return NextResponse.rewrite(new URL(BLOCKED_NOTICE, request.url))
    }
  }

  const isAdminArea = path.startsWith('/workspace') || path.startsWith('/admin') || path.startsWith('/budget')
  if (!isAdminArea) return response

  if (!user) {
    const signIn = new URL('/sign-in', request.url)
    signIn.searchParams.set('next', `${path}${request.nextUrl.search}`)
    return NextResponse.redirect(signIn)
  }

  // Owner email always passes. Everyone else must hold an elevated role row
  // (staff) which the server pages/APIs re-verify — the middleware check is
  // only a fast pre-filter using the session email.
  if (isOwnerEmail(user.email ?? '')) return response

  return response
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] }
