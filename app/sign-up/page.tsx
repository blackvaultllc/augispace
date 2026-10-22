import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth-form'
import { resolveRole } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Create your AUGI account' }

export default async function SignUpPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    // Route by the server-resolved role: staff/owner go to the workspace,
    // members land on the public site instead of bouncing off the workspace.
    const role = await resolveRole(user.id, user.email)
    redirect(role.isAdmin ? '/workspace' : '/')
  }
  return <AuthForm mode="sign-up" />
}
