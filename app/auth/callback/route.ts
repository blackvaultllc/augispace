import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { claimStaffInvite, resolveRole } from '@/lib/roles'

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
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/sign-in?error=owner_only', url.origin))
  }

  // Claim any pending staff invite for this email, then resolve the role.
  await claimStaffInvite(user.id, user.email)
  const role = await resolveRole(user.id, user.email)
  if (!role.isAdmin) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/sign-in?error=owner_only', url.origin))
  }

  const destination = next?.startsWith('/workspace') || next?.startsWith('/admin') ? next : '/workspace'
  return NextResponse.redirect(new URL(destination, url.origin))
}
