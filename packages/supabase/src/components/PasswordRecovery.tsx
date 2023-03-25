import { Dialog, useLocale } from '@essentia/ui'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { requestPasswordRecovery } from '../data/password'
import { emptyRecoveryStore, ensureRecoveryCapture } from '../data/recovery'
import { t } from '../locale'
import { PasswordForm } from './PasswordForm'
import '../account.css'

/** Hub-only callback UI. URL flags can request email, but only the SDK event opens reset. */
export function PasswordRecovery({ client }: { client: SupabaseClient | null }) {
  useLocale()
  const [request, setRequest] = useState<{ expired: boolean } | null>(() => {
    const url = new URL(location.href)
    const expired = url.searchParams.has('error_code') || new URLSearchParams(url.hash.slice(1)).has('error_code')
    return url.searchParams.get('recover') === 'password' || expired ? { expired } : null
  })
  const [pending, setPending] = useState(false)
  const store = useMemo(() => client ? ensureRecoveryCapture(client) : emptyRecoveryStore, [client])
  const recovery = useSyncExternalStore(store.subscribe, store.getSnapshot, emptyRecoveryStore.getSnapshot)
  if (recovery && request) setRequest(null)

  useEffect(() => {
    if (!client) return
    const url = new URL(location.href)
    const hash = new URLSearchParams(url.hash.slice(1))
    const expired = url.searchParams.has('error_code') || hash.has('error_code')
    if (url.searchParams.get('recover') === 'password' || expired) {
      url.searchParams.delete('recover')
      for (const key of ['error', 'error_code', 'error_description']) {
        url.searchParams.delete(key); hash.delete(key)
      }
      // Preserve unrelated navigation state; error strings never enter rendered feedback.
      if (expired) url.hash = hash.toString()
      history.replaceState(history.state, '', url)
    }
  }, [client])

  if (!client || (!recovery && !request)) return null
  const close = () => { store.dismiss(); setRequest(null) }
  return <Dialog title={t('Reset password')} titleId="recovery-title" returnFocusId="account-button" onClose={pending ? undefined : close}>
    <div className="account__body">
      {recovery ? <>
        <p className="account__email">{t('Signed in as ')}<strong>{recovery.email}</strong>.</p>
        <p>{t('Closing this form leaves this device signed in. You can sign out from Account.')}</p>
        <PasswordForm key={recovery.attempt} client={client} userId={recovery.userId} recovery onPending={setPending} />
      </> : <>
        {request?.expired && <p role="alert" className="auth__failure">{t('This recovery link is invalid or expired. Request a new link below.')}</p>}
        <RecoveryRequest client={client} onPending={setPending} />
      </>}
      <button type="button" className="account__close" disabled={pending} onClick={close}>{t('Close')}</button>
    </div>
  </Dialog>
}

function RecoveryRequest({ client, onPending }: { client: SupabaseClient; onPending: (pending: boolean) => void }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [pending, setPending] = useState(false)
  const busy = useRef(false)
  const active = useRef(false)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  useEffect(() => { onPending(pending); return () => onPending(false) }, [pending, onPending])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current) return
    const address = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError('Enter an email address like name@example.com.')
      document.getElementById('recovery-email')?.focus()
      return
    }
    busy.current = true; setPending(true); setError(null)
    try {
      const result = await requestPasswordRecovery(client, address)
      if (!active.current) return
      if (result.status === 'success') setSent(true)
      else if (result.status === 'error') setError(result.message)
    } finally {
      busy.current = false
      if (active.current) setPending(false)
    }
  }

  if (sent) return <p role="status">{t('If this email has an account, you’ll receive a recovery link. Check your inbox and spam folder.')}</p>
  return <form className="auth password-form" onSubmit={event => void submit(event)} noValidate aria-busy={pending}>
    <p className="auth__intro">{t('Request a link to choose a new password for your email account.')}</p>
    <div className="auth__field">
      <label className="label" htmlFor="recovery-email">{t('Email')}</label>
      <input id="recovery-email" className="auth__input" type="email" autoComplete="email" value={email}
        onChange={event => setEmail(event.target.value)} disabled={pending}
        aria-invalid={error ? true : undefined} aria-describedby={error ? 'recovery-error' : undefined} />
      {error && <p id="recovery-error" role="alert" className="auth__failure">{t(error)}</p>}
    </div>
    <button type="submit" className="auth__submit" aria-disabled={pending}>{t(pending ? 'Please wait…' : 'Send recovery link')}</button>
  </form>
}
