import { t } from './locale'
import { Search, useLocale, formatNumber, useRecordMotion } from '@essentia/ui'
import { useAuth } from '@essentia/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { AccountMenu } from './components/AccountMenu'
import { AppHeader } from './components/AppHeader'
import { Budgets } from './components/Budgets'
import { DataTools } from './components/DataTools'
import { EditDialog } from './components/EditDialog'
import { Filters } from './components/Filters'
import { Gate } from './components/Gate'
import { Hero } from './components/Hero'
import { InsightsView } from './components/InsightsView'
import { QuickAdd } from './components/QuickAdd'
import { Recurring } from './components/Recurring'
import { TransactionRow } from './components/TransactionRow'
import { formatMoney } from './domain/money'
import {
  categoriesOf,
  editId,
  filterTransactions,
  isFiltered,
  monthsOf,
  NO_FILTER,
  totals,
  type Transaction,
  type TransactionFilter,
} from './domain/transactions'
import { UndoNotice } from './components/UndoNotice'
import { SYNC_FAILED, useTransactions } from './hooks/useTransactions'
import { OfflineNotice } from './components/OfflineNotice'
import { Views, type View } from './components/Views'

function subscribeConnection(notify: () => void) {
  window.addEventListener('online', notify)
  window.addEventListener('offline', notify)
  return () => {
    window.removeEventListener('online', notify)
    window.removeEventListener('offline', notify)
  }
}

export default function App({ client }: { client: SupabaseClient | null }) {
  const online = useSyncExternalStore(subscribeConnection, () => navigator.onLine)
  const locale = useLocale()
  useEffect(() => { document.title = `Merces · ${t('Your Money')} · Essentia` }, [locale])
  const auth = useAuth(client)
  const {
    transactions,
    budgets,
    planReady,
    ready,
    saveFailed,
    syncState,
    sync,
    add,
    addAll,
    update,
    remove,
    putBack,
    setBudget,
    removeBudget,
    recurring,
    addRecurring,
    setRecurringPaused,
    removeRecurring,
  } = useTransactions(client)
  // The transaction being edited, by id: a sync can remove it, and the dialog then closes.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleted, setDeleted] = useState<Transaction | null>(null)
  const [filter, setFilter] = useState<TransactionFilter>(NO_FILTER)
  const [view, setView] = useState<View>('transactions')
  const addRef = useRef<HTMLInputElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const motion = useRecordMotion(mainRef)
  // A row whose Edit button takes focus once the list has rendered; '' or a gone row means the add field.
  const focusAfter = useRef<string | null>(null)
  const signedIn = auth.status === 'signed-in'

  const categories = categoriesOf(transactions)
  const months = monthsOf(transactions)
  // A category or month filter lapses once no transaction carries it any more.
  const activeFilter: TransactionFilter = {
    ...filter,
    category: filter.category !== null && categories.includes(filter.category) ? filter.category : null,
    month: filter.month !== null && months.includes(filter.month) ? filter.month : null,
  }
  const visible = filterTransactions(transactions, activeFilter)
  const filtered = isFiltered(activeFilter)

  useEffect(() => {
    const id = focusAfter.current
    if (id === null) return
    focusAfter.current = null
    const t = visible.find((item) => item.id === id)
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
    const position = visible.findIndex((item) => item.id === t.id)
    focusAfter.current = (visible[position + 1] ?? visible[position - 1])?.id ?? ''
    motion(() => remove(t.id))
    setDeleted(t)
  }

  function undoDelete() {
    if (!deleted) return
    motion(() => putBack(deleted))
    focusAfter.current = deleted.id
    setDeleted(null)
  }

  const searchSession = `${signedIn ? auth.userId : auth.status}:${online}`
  const search = <Search key={searchSession} sessionKey={searchSession} sourceLabel={t('Transactions')}
    sourceState={!online || !signedIn ? 'unavailable' : !ready ? (syncState === 'failed' ? 'unavailable' : 'loading') : 'ready'}
    records={online && signedIn && ready ? transactions.map((item) => ({ id: item.id, title: item.description, text: item.category })) : []}
    onSelect={(id) => {
      setView('transactions')
      setFilter(NO_FILTER)
      focusAfter.current = id
    }} />

  if (!online) return <><AppHeader search={search} /><OfflineNotice saveFailed={saveFailed} /></>

  return (
    <>
      <AppHeader search={search} account={signedIn && <AccountMenu auth={auth} client={client} syncState={syncState} onSync={sync} />} />
      <main className="aurum" ref={mainRef}>
        {!signedIn ? (
          <Gate auth={auth} client={client} />
        ) : (
          <>
            {saveFailed && (
              <p className="notice notice--error" role="alert">
                {t("Couldn’t save on this device. Your latest changes may be lost if you close this page.")}</p>
            )}
            {syncState === 'failed' && (
              <p className="notice notice--error" role="alert">
                {t(SYNC_FAILED)}{' '}
                <button type="button" className="notice__action" onClick={() => void sync()}>
                  {t("Try again")}</button>
              </p>
            )}
            {!ready ? (
              <>
                <h1 className="visually-hidden">{t("Your money")}</h1>
                <div className="skeleton" role="status" aria-label={t("Loading your transactions")}>
                  <span className="skeleton__line" />
                  <span className="skeleton__line" />
                  <span className="skeleton__line" />
                </div>
              </>
            ) : (
              <div className="aurum-workspace ui-workspace-layout">
                <Hero count={transactions.length} totals={totals(transactions)} />
                <div className="workspace">
                  <Views view={view} onChange={setView} />
                  {view === 'plan' ? (
                    <div className="plan-layout">
                      <Budgets
                        budgets={budgets}
                        ready={planReady}
                        transactions={transactions}
                        onSet={setBudget}
                        onRemove={removeBudget}
                      />
                      <Recurring
                        items={recurring}
                        ready={planReady}
                        onAdd={addRecurring}
                        onPause={setRecurringPaused}
                        onRemove={removeRecurring}
                      />
                    </div>
                  ) : view === 'insights' ? (
                    <div className="insights-layout">
                      <InsightsView
                        transactions={transactions}
                        onAdd={() => {
                          focusAfter.current = ''
                          setView('transactions')
                        }}
                      />
                      <DataTools transactions={transactions} onImport={addAll} />
                    </div>
                  ) : (
                    <>
                      <QuickAdd
                        inputRef={addRef}
                        onAdd={(fields) => {
                          motion(() => add(fields))
                          setDeleted(null)
                          setFilter(NO_FILTER)
                        }}
                      />
                      <UndoNotice deleted={deleted} onUndo={undoDelete} />
                      <section aria-labelledby="list-title">
                        <div className="section-row">
                          <h2 id="list-title" className="label">
                            {t("Transactions")}</h2>
                          <span className="section-row__rule" />
                        </div>
                        {transactions.length > 0 && (
                          <Filters filter={activeFilter} categories={categories} months={months} onChange={setFilter} />
                        )}
                        {filtered && (
                          <p className="filtered" role="status">
                            {t("{shown} of {total} shown · net {amount}", { shown: formatNumber(visible.length), total: formatNumber(transactions.length), amount: formatMoney(totals(visible).balance) })}
                          </p>
                        )}
                        {transactions.length === 0 ? (
                          <div className="empty">
                            <p className="empty__title">{t("Nothing recorded yet.")}</p>
                            <p className="empty__text">{t("Add what came in or went out today, and the balance follows.")}</p>
                          </div>
                        ) : visible.length === 0 ? (
                          <div className="empty">
                            <p className="empty__title">{t("Nothing matches.")}</p>
                            <p className="empty__text">{t("No transaction fits these filters.")}</p>
                            <button type="button" className="button-ghost empty__action" onClick={() => setFilter(NO_FILTER)}>
                              {t("Clear filters")}</button>
                          </div>
                        ) : (
                          <ul className="rows">
                            {visible.map((t) => (
                              <TransactionRow
                                key={t.id}
                                transaction={t}
                                onEdit={(item) => setEditingId(item.id)}
                                onDelete={deleteTransaction}
                              />
                            ))}
                          </ul>
                        )}
                      </section>
                    </>
                  )}
                </div>
              </div>
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
            // The edit may take the row out of the filtered list; focus then goes to the add field.
            focusAfter.current = editing.id
          }}
          onClose={() => setEditingId(null)}
        />
      )}
    </>
  )
}
