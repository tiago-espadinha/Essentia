import { t } from '../locale'
import { AccountMenu as SuiteAccountMenu, type AccountText, type Auth, type SyncState } from '@essentia/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SYNC_FAILED } from '../hooks/useNotes'

const TEXT: AccountText = {
  intro: 'Keep your notes and folders on every device. If this device already has notes, you choose whether they join your account or stay on this device only.',
  sync: {
    off: 'Not synced yet.',
    syncing: 'Syncing…',
    synced: 'Your notes are up to date in your account.',
    failed: SYNC_FAILED,
  },
  signOut: 'Signing out removes your notes, folders and their versions from this device. The notes and folders stay in your account; versions are not synced.',
}

interface AccountMenuProps {
  auth: Auth
  client: SupabaseClient | null
  syncState: SyncState
  onSync: () => Promise<boolean>
}

/** The suite's account menu, worded for notes. */
export function AccountMenu(props: AccountMenuProps) {
  return <SuiteAccountMenu {...props} text={{ intro: t(TEXT.intro), sync: { off: t(TEXT.sync.off), syncing: t(TEXT.sync.syncing), synced: t(TEXT.sync.synced), failed: t(TEXT.sync.failed) }, signOut: t(TEXT.signOut) }} />
}
