import { NextResponse, type NextRequest } from 'next/server'
import { isOwnerEmail } from '@/lib/plans'
import { updateSession } from '@/lib/supabase/proxy'

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request)
  const isProtected = request.nextUrl.pathname.startsWith('/workspace') || request.nextUrl.pathname.startsWith('/admin')
  if (!isProtected) return response

  if (!user) {
    const signIn = new URL('/sign-in', request.url)
    signIn.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(signIn)
  }

  if (!isOwnerEmail(user.email ?? '')) {
    const signIn = new URL('/sign-in?error=owner_only', request.url)
    return NextResponse.redirect(signIn)
  }

  return response
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] }
