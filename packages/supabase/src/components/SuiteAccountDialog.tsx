import { Dialog, useLocale } from '@essentia/ui'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useRef, useState } from 'react'
import { signOut } from '../data/auth'
import { t } from '../locale'
import { BUTTON_ID } from './AccountMenu'

interface Props {
  email: string
  client: SupabaseClient
  onClose: () => void
  onPassword: () => void
}

/** The hub has no sync engine: confirmation acknowledges uncertainty across all apps. */
export function SuiteAccountDialog({ email, client, onClose, onPassword }: Props) {
  useLocale()
  const [confirm, setConfirm] = useState(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const busy = useRef(false)

  async function leave() {
    if (busy.current) return
    if (!confirm) {
      setConfirm(true)
      return
    }
    busy.current = true
    setPending(true)
    setFailure(null)
    try {
      const error = await signOut(client)
      if (error) setFailure(error)
    } catch {
      setFailure('Something went wrong. Try again.')
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  return (
    <Dialog title={t('Account')} titleId="account-title" returnFocusId={BUTTON_ID} onClose={pending ? undefined : onClose}>
      <div className="account__body">
        <p className="account__email">{t('Signed in as ')}<strong>{email}</strong>.</p>
        <button type="button" className="account__close" disabled={pending} onClick={onPassword}>{t('Change password')}</button>
        <p>{t('One account connects Folio, Acta, Virtus and Merces. Open an app to check or retry its sync.')}</p>
        <nav className="account__apps" aria-label={t('Check app sync')}>
          <a href="/folio/">Folio</a>
          <a href="/acta/">Acta</a>
          <a href="/virtus/">Virtus</a>
          <a href="/merces/">Merces</a>
        </nav>
        <p className="account__note">{t('Signing out clears this device’s account data in Folio, Acta, Virtus and Merces, including saved note versions, which are not synced. Work made while signed out stays; other devices stay signed in.')}</p>
        {confirm && <p className="account__error" role="alert">{t('The hub cannot check whether every app has synced. Signing out will discard any unsynced account changes and device-only versions. Open the apps above to check first, or confirm to discard them.')}</p>}
        {failure && <p className="account__error" role="alert">{t(failure)}</p>}
        {pending && <p role="status">{t('Signing out…')}</p>}
        <div className="account__actions account__actions--answer">
          <button type="button" className="account__close" disabled={pending} onClick={onClose}>{t('Cancel')}</button>
          <button type="button" className="account__sign-out" aria-disabled={pending} onClick={() => void leave()}>
            {pending ? t('Signing out…') : failure ? t('Try again') : confirm ? t('Sign out and discard') : t('Sign out')}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
