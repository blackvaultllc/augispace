import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth-form'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Create your AUGI account' }

export default async function SignUpPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/workspace')
  return <AuthForm mode="sign-up" />
}
