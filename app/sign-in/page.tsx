import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth-form'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Sign in' }

export default async function SignInPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.email?.toLowerCase() === 'blackhatterxvi@gmail.com') redirect('/workspace')
  return <AuthForm mode="sign-in" />
}
