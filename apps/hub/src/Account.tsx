import { AccountMenu, getSupabase, PasswordRecovery, useAuth } from '@essentia/supabase'
import { t } from './locale'

export function Account() {
  const client = getSupabase()
  const auth = useAuth(client)
  if (auth.status === 'loading') return <><span className="hub__account-status" role="status">{t('Loading account…')}</span><PasswordRecovery client={client} /></>
  if (auth.status === 'disabled') return <span className="hub__account-status" role="status">{t('Account unavailable in this build.')}</span>
  return <><AccountMenu auth={auth} client={client} scope="suite" text={{ intro: t('Sign in to use your account in Virtus, Dictum and Merces. Local work is added only when you choose in each app.') }} /><PasswordRecovery client={client} /></>
}
