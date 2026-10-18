import { redirect } from 'next/navigation'
import { ThreatTerminal } from '@/components/threat-terminal'
import { createClient } from '@/lib/supabase/server'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.email?.toLowerCase() !== 'blackhatterxvi@gmail.com') redirect('/sign-in?next=/')
  return <ThreatTerminal />
}
