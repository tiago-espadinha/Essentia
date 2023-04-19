import { t } from '../locale'
import { AccountMenu as SuiteAccountMenu, type AccountText, type Auth, type SyncState } from '@essentia/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SYNC_FAILED } from '../hooks/useDocuments'

const TEXT: AccountText = {
  intro: 'Keep your documents on every device and share them by link. If this device already has documents, you choose whether they join your account.',
  sync: {
    off: 'Not synced yet.',
    syncing: 'Syncing…',
    synced: 'Your documents are up to date in your account.',
    failed: SYNC_FAILED,
  },
  signOut: 'Signing out removes your documents and their versions from this device. The documents stay in your account; versions are not synced.',
}

/** Said instead of "Not synced yet." once Folio has taken the account's documents over. */
const MOVED = 'Your documents now sync in Folio.'

interface AccountMenuProps {
  auth: Auth
  client: SupabaseClient | null
  syncState: SyncState
  onSync: () => Promise<boolean>
  movedToFolio?: boolean
}

/** The suite's account menu, worded for documents. */
export function AccountMenu({ movedToFolio = false, ...props }: AccountMenuProps) {
  return <SuiteAccountMenu {...props} text={{ intro: t(TEXT.intro), sync: { off: t(movedToFolio ? MOVED : TEXT.sync.off), syncing: t(TEXT.sync.syncing), synced: t(TEXT.sync.synced), failed: t(TEXT.sync.failed) }, signOut: t(TEXT.signOut) }} />
}
