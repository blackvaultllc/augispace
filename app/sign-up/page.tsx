import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth-form'
import { isOwnerEmail } from '@/lib/plans'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Create an owner account' }

export default async function SignUpPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user && isOwnerEmail(user.email ?? '')) redirect('/workspace')
  return <AuthForm mode="sign-up" />
}
