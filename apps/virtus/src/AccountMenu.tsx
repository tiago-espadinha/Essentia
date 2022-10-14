import { AuthForm, signOut, type Auth } from '@essentia/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useState } from 'react'
import { Dialog } from './Dialog'
import { SYNC_FAILED, type SyncState } from './useHabits'

/** One id for both header buttons, so a dialog closed by signing in or out hands focus back. */
const BUTTON_ID = 'account-button'

const SYNC_TEXT: Record<SyncState, string> = {
  off: 'Not synced yet.',
  syncing: 'Syncing…',
  synced: 'Your habits are up to date in your account.',
  failed: SYNC_FAILED,
}

interface AccountMenuProps {
  auth: Auth
  client: SupabaseClient | null
  syncState: SyncState
  onSync: () => Promise<boolean>
}

/** Sign in, or see the account and sign out; nothing without a Supabase project or while the session loads. */
export function AccountMenu({ auth, client, syncState, onSync }: AccountMenuProps) {
  // The dialog belongs to the state it was opened in: signing in or out closes it.
  const [openFor, setOpenFor] = useState<Auth['status'] | null>(null)
  if (openFor !== null && openFor !== auth.status) setOpenFor(null)
  if (!client || (auth.status !== 'signed-in' && auth.status !== 'signed-out')) return null

  const close = () => setOpenFor(null)
  if (auth.status === 'signed-out') {
    return (
      <>
        <button id={BUTTON_ID} type="button" className="account__sign-in" aria-haspopup="dialog" onClick={() => setOpenFor('signed-out')}>
          Sign in
        </button>
        {openFor && (
          <Dialog title="Sign in" titleId="sign-in-title" returnFocusId={BUTTON_ID} onClose={close}>
            <div className="dialog__body">
              <AuthForm
                client={client}
                intro="Keep your habits on every device. Habits already on this device are added to your account."
              />
            </div>
          </Dialog>
        )}
      </>
    )
  }

  return (
    <>
      <button id={BUTTON_ID} type="button" className="ui-icon-button" aria-haspopup="dialog" title="Account" onClick={() => setOpenFor('signed-in')}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="7" r="3.25" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3.75 16.5a6.25 6.25 0 0 1 12.5 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="visually-hidden">Account</span>
      </button>
      {openFor && <AccountDialog email={auth.email} client={client} syncState={syncState} onSync={onSync} onClose={close} />}
    </>
  )
}

interface AccountDialogProps {
  email: string
  client: SupabaseClient
  syncState: SyncState
  onSync: () => Promise<boolean>
  onClose: () => void
}

function AccountDialog({ email, client, syncState, onSync, onClose }: AccountDialogProps) {
  const [unsynced, setUnsynced] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  // Signing out clears this device, so the latest changes go up first.
  async function leave() {
    if (pending) return
    setPending(true)
    setFailure(null)
    if (!unsynced && !(await onSync())) {
      setUnsynced(true)
      setPending(false)
      return
    }
    const error = await signOut(client)
    if (error) {
      setFailure(error)
      setPending(false)
    }
  }

  return (
    <Dialog title="Account" titleId="account-title" returnFocusId={BUTTON_ID} onClose={onClose}>
      <div className="dialog__body">
        <p className="account__email">
          Signed in as <strong>{email}</strong>.
        </p>
        <div className="account__sync" role="status">
          <span>{SYNC_TEXT[syncState]}</span>
          {syncState === 'failed' && (
            <button type="button" className="undo__button" onClick={() => void onSync()}>
              Try again
            </button>
          )}
        </div>
        <p className="account__note">Signing out removes your habits from this device. They stay in your account.</p>
        {unsynced && (
          <p className="field-error" role="alert">
            Your latest changes haven’t reached your account yet. Try again, or sign out anyway and lose them.
          </p>
        )}
        {failure && (
          <p className="field-error" role="alert">
            {failure}
          </p>
        )}
        <div className="dialog__actions">
          <button type="button" className="button-ghost" onClick={onClose}>
            Close
          </button>
          <button type="button" className="button-primary" onClick={() => void leave()} aria-disabled={pending}>
            {pending ? 'Signing out…' : unsynced ? 'Sign out anyway' : 'Sign out'}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
