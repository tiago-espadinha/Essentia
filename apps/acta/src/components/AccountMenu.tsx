import { AccountMenu as SuiteAccountMenu, type AccountText, type Auth, type SyncState } from '@essentia/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { t } from '../locale'
import { SYNC_FAILED } from '../hooks/useTasks'

const TEXT: AccountText = {
  intro: 'Keep your tasks on every device. If this device already has tasks, you choose whether they join your account.',
  sync: {
    off: 'Not synced yet.',
    syncing: 'Syncing…',
    synced: 'Synced with your account. A task changed on another device waits on its row for your choice.',
    failed: SYNC_FAILED,
  },
  signOut: 'Signing out removes your account’s tasks from this device. They stay in your account.',
}

interface AccountMenuProps {
  auth: Auth
  client: SupabaseClient | null
  syncState: SyncState
  onSync: () => Promise<boolean>
}

/** The suite's account menu, worded for tasks. */
export function AccountMenu(props: AccountMenuProps) {
  return <SuiteAccountMenu {...props} text={{ intro: t(TEXT.intro), signOut: t(TEXT.signOut), sync: { off: t(TEXT.sync.off), syncing: t(TEXT.sync.syncing), synced: t(TEXT.sync.synced), failed: t(TEXT.sync.failed) } }} />
}
