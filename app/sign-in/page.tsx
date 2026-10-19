import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth-form'
import { isOwnerEmail } from '@/lib/plans'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Owner sign in' }

type SearchParams = Promise<{ created?: string; error?: string; next?: string }>

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user && isOwnerEmail(user.email ?? '')) redirect('/workspace')

  const params = await searchParams
  const notice = params.created === '1'
    ? 'Check your inbox for the confirmation link before signing in.'
    : params.error === 'owner_only'
      ? 'This workspace is available only to the configured owner account.'
      : params.error === 'auth_callback'
        ? 'The confirmation link could not be verified. Request a new link and try again.'
        : undefined
  const nextPath = params.next?.startsWith('/workspace') || params.next?.startsWith('/admin') ? params.next : '/workspace'

  return <AuthForm mode="sign-in" notice={notice} nextPath={nextPath} />
}
