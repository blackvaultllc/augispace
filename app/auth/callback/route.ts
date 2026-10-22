import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { claimStaffInvite, resolveRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

/**
 * Email-confirmation / OAuth callback.
 *
 * Failures are always surfaced as redirects with an error code, never as an
 * HTTP 500. Roles are resolved server-side; the database registry is consulted
 * but a registry outage fails closed (see resolveRole), it never elevates.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next')
  const callbackError = url.searchParams.get('error')

  if (callbackError || !code) return NextResponse.redirect(new URL('/sign-in?error=auth_callback', url.origin))

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(new URL('/sign-in?error=auth_callback', url.origin))

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    await supabase.auth.signOut().catch(() => undefined)
    return NextResponse.redirect(new URL('/sign-in?error=auth_callback', url.origin))
  }

  // Claim any pending staff invite for this email, then resolve the role.
  await claimStaffInvite(user.id, user.email)
  const role = await resolveRole(user.id, user.email)
  if (!role.isAdmin) {
    // Members keep their session for member features (food-truck comments,
    // community pages) but are routed to the public site instead of the
    // owner/staff workspace. Workspace pages re-verify server-side, so this
    // redirect is convenience, not the authorization boundary.
    return NextResponse.redirect(new URL('/', url.origin))
  }

  const destination = next?.startsWith('/workspace') || next?.startsWith('/admin') ? next : '/workspace'
  return NextResponse.redirect(new URL(destination, url.origin))
}
