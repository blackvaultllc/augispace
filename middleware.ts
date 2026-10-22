import { NextResponse, type NextRequest } from 'next/server'
import { isOwnerEmail } from '@/lib/plans'
import { updateSession } from '@/lib/supabase/proxy'

const STAFF_ERROR = 'staff_only'

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request)
  const path = request.nextUrl.pathname
  const isAdminArea = path.startsWith('/workspace') || path.startsWith('/admin')
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
