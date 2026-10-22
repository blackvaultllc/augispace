import type { Metadata } from 'next'
import { ResetPasswordForm } from '@/components/reset-password-form'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Reset your password' }

export const dynamic = 'force-dynamic'

/**
 * Account recovery entry point.
 *
 * The client component handles both stages (it reads the session itself):
 * - No session: "request a recovery link" form.
 * - Session present (arrived via the recovery link's /auth/callback
 *   exchange, or already signed in): "set new password" form.
 */
export default async function ResetPasswordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const hasSession = !!user
  return <ResetPasswordForm initialStage={hasSession ? 'set' : 'request'} />
}
