import { NextResponse } from 'next/server'
import { isOwnerEmail } from '@/lib/plans'
import { createClient } from '@/lib/supabase/server'

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
  if (!user || !isOwnerEmail(user.email ?? '')) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/sign-in?error=owner_only', url.origin))
  }

  const destination = next?.startsWith('/workspace') || next?.startsWith('/admin') ? next : '/workspace'
  return NextResponse.redirect(new URL(destination, url.origin))
}
