import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

const OWNER_EMAIL = 'blackhatterxvi@gmail.com'

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request)
  const isProtected = request.nextUrl.pathname === '/' || request.nextUrl.pathname.startsWith('/workspace') || request.nextUrl.pathname.startsWith('/admin')
  if (!isProtected) return response

  if (user?.email?.toLowerCase() !== OWNER_EMAIL) {
    const signIn = new URL('/sign-in', request.url)
    signIn.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(signIn)
  }
  return response
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] }
