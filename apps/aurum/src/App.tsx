import { useAuth } from '@essentia/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AccountMenu } from './AccountMenu'
import { AppHeader } from './AppHeader'
import { Gate } from './Gate'
import { SYNC_FAILED, useTransactions } from './useTransactions'

export default function App({ client }: { client: SupabaseClient | null }) {
  const auth = useAuth(client)
  const { transactions, ready, saveFailed, syncState, sync } = useTransactions(client)
  const signedIn = auth.status === 'signed-in'

  return (
    <>
      <AppHeader account={signedIn && <AccountMenu auth={auth} client={client} syncState={syncState} onSync={sync} />} />
      <main className="aurum">
        {!signedIn ? (
          <Gate auth={auth} client={client} />
        ) : (
          <>
            <h1 className="visually-hidden">Aurum transactions</h1>
            {saveFailed && (
              <p className="notice notice--error" role="alert">
                Couldn’t save on this device. Your latest changes may be lost if you close this page.
              </p>
            )}
            {syncState === 'failed' && (
              <p className="notice notice--error" role="alert">
                {SYNC_FAILED}{' '}
                <button type="button" className="notice__action" onClick={() => void sync()}>
                  Try again
                </button>
              </p>
            )}
            {!ready ? (
              <div className="skeleton" role="status" aria-label="Loading your transactions">
                <span className="skeleton__line" />
                <span className="skeleton__line" />
                <span className="skeleton__line" />
              </div>
            ) : (
              <p className="aurum__count">{transactions.length} transactions</p>
            )}
          </>
        )}
      </main>
    </>
  )
}
