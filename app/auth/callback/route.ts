import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const OWNER_EMAIL = 'blackhatterxvi@gmail.com'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') || '/'

  if (!code) return NextResponse.redirect(new URL('/sign-in?error=auth_callback', url.origin))

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(new URL('/sign-in?error=auth_callback', url.origin))

  const { data: { user } } = await supabase.auth.getUser()
  if (user?.email?.toLowerCase() !== OWNER_EMAIL) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/sign-in?error=owner_only', url.origin))
  }

  return NextResponse.redirect(new URL(next, url.origin))
}
