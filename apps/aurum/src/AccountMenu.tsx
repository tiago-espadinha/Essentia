import { AccountMenu as SuiteAccountMenu, type AccountText, type Auth, type SyncState } from '@essentia/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SYNC_FAILED } from './useTransactions'

const TEXT: AccountText = {
  intro: 'Sign in to see your transactions.',
  sync: {
    off: 'Not synced yet.',
    syncing: 'Syncing…',
    synced: 'Your transactions are up to date in your account.',
    failed: SYNC_FAILED,
  },
  signOut: 'Signing out removes your transactions from this device. They stay in your account.',
}

interface AccountMenuProps {
  auth: Auth
  client: SupabaseClient | null
  syncState: SyncState
  onSync: () => Promise<boolean>
}

/** The suite's account menu, worded for transactions. */
export function AccountMenu(props: AccountMenuProps) {
  return <SuiteAccountMenu {...props} text={TEXT} />
}
