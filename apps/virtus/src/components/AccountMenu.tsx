import { AccountMenu as SuiteAccountMenu, type AccountText, type Auth, type SyncState } from '@essentia/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { t } from '../locale'
import { SYNC_FAILED } from '../hooks/useHabits'

const TEXT: AccountText = {
  intro: 'Keep your habits on every device. If this device already has habits, you choose whether they join your account.',
  sync: {
    off: 'Not synced yet.',
    syncing: 'Syncing…',
    synced: 'Your habits are up to date in your account.',
    failed: SYNC_FAILED,
  },
  signOut: 'Signing out removes your habits from this device. They stay in your account.',
}

interface AccountMenuProps {
  auth: Auth
  client: SupabaseClient | null
  syncState: SyncState
  onSync: () => Promise<boolean>
}

/** The suite's account menu, worded for habits. */
export function AccountMenu(props: AccountMenuProps) {
  return <SuiteAccountMenu {...props} text={{ intro: t(TEXT.intro), signOut: t(TEXT.signOut), sync: { off: t(TEXT.sync.off), syncing: t(TEXT.sync.syncing), synced: t(TEXT.sync.synced), failed: t(TEXT.sync.failed) } }} />
}
