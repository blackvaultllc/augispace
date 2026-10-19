import { isOwnerEmail } from '@/lib/plans'
import { createClient } from '@/lib/supabase/server'

export async function getOwnerContext() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user || !isOwnerEmail(user.email ?? '')) return null

  return { supabase, user }
}
