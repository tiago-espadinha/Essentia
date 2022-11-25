import { useAuth } from '@essentia/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useRef, useState } from 'react'
import { AccountMenu } from './AccountMenu'
import { AppHeader } from './AppHeader'
import { EditDialog } from './EditDialog'
import { Gate } from './Gate'
import { Hero } from './Hero'
import { QuickAdd } from './QuickAdd'
import { TransactionRow } from './TransactionRow'
import { editId, totals, type Transaction } from './transactions'
import { UndoNotice } from './UndoNotice'
import { SYNC_FAILED, useTransactions } from './useTransactions'

export default function App({ client }: { client: SupabaseClient | null }) {
  const auth = useAuth(client)
  const { transactions, ready, saveFailed, syncState, sync, add, update, remove, putBack } = useTransactions(client)
  // The transaction being edited, by id: a sync can remove it, and the dialog then closes.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleted, setDeleted] = useState<Transaction | null>(null)
  const addRef = useRef<HTMLInputElement>(null)
  // A row whose Edit button takes focus once the list has rendered; '' or a gone row means the add field.
  const focusAfter = useRef<string | null>(null)
  const signedIn = auth.status === 'signed-in'

  useEffect(() => {
    const id = focusAfter.current
    if (id === null) return
    focusAfter.current = null
    const t = transactions.find((item) => item.id === id)
    ;(t ? document.getElementById(editId(t)) : addRef.current)?.focus()
  })

  const editing = transactions.find((t) => t.id === editingId) ?? null
  if (editingId !== null && !editing) setEditingId(null)
  // An undo belongs to the account that deleted it, even when another signs in straight after.
  const owner = signedIn ? auth.userId : null
  const [undoOwner, setUndoOwner] = useState(owner)
  if (undoOwner !== owner) {
    setUndoOwner(owner)
    setDeleted(null)
  }

  function deleteTransaction(t: Transaction) {
    const position = transactions.findIndex((item) => item.id === t.id)
    focusAfter.current = (transactions[position + 1] ?? transactions[position - 1])?.id ?? ''
    remove(t.id)
    setDeleted(t)
  }

  function undoDelete() {
    if (!deleted) return
    putBack(deleted)
    focusAfter.current = deleted.id
    setDeleted(null)
  }

  return (
    <>
      <AppHeader account={signedIn && <AccountMenu auth={auth} client={client} syncState={syncState} onSync={sync} />} />
      <main className="aurum">
        {!signedIn ? (
          <Gate auth={auth} client={client} />
        ) : (
          <>
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
              <>
                <h1 className="visually-hidden">Your money</h1>
                <div className="skeleton" role="status" aria-label="Loading your transactions">
                  <span className="skeleton__line" />
                  <span className="skeleton__line" />
                  <span className="skeleton__line" />
                </div>
              </>
            ) : (
              <>
                <Hero count={transactions.length} totals={totals(transactions)} />
                <QuickAdd
                  inputRef={addRef}
                  onAdd={(fields) => {
                    add(fields)
                    setDeleted(null)
                  }}
                />
                <UndoNotice deleted={deleted} onUndo={undoDelete} />
                <section aria-labelledby="list-title">
                  <div className="section-row">
                    <h2 id="list-title" className="label">
                      Transactions
                    </h2>
                    <span className="section-row__rule" />
                  </div>
                  {transactions.length === 0 ? (
                    <div className="empty">
                      <p className="empty__title">Nothing recorded yet.</p>
                      <p className="empty__text">Add what came in or went out today, and the balance follows.</p>
                    </div>
                  ) : (
                    <ul className="rows">
                      {transactions.map((t) => (
                        <TransactionRow key={t.id} transaction={t} onEdit={(item) => setEditingId(item.id)} onDelete={deleteTransaction} />
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </main>
      {editing && (
        <EditDialog
          key={editing.id}
          transaction={editing}
          onSave={(fields) => {
            update(editing.id, fields)
            setEditingId(null)
          }}
          onClose={() => setEditingId(null)}
        />
      )}
    </>
  )
}
