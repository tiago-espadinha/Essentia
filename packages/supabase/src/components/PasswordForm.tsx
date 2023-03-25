import { useLocale } from '@essentia/ui'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { passwordEligibility, passwordUpdate, requestPasswordCode, type PasswordResult } from '../data/password'
import { t } from '../locale'
import '../auth.css'

interface Props {
  client: SupabaseClient
  userId: string
  recovery?: boolean
  onPending: (pending: boolean) => void
}

type Fields = 'current' | 'new' | 'confirm' | 'code'
type Errors = Partial<Record<Fields, string>>

/** Secrets belong only to this mounted form; identity changes invalidate outstanding work. */
export function PasswordForm({ client, userId, recovery = false, onPending }: Props) {
  useLocale()
  const [eligibility, setEligibility] = useState('loading')
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  const [needsCode, setNeedsCode] = useState(false)
  const [sent, setSent] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pending, setPending] = useState(false)
  const active = useRef(false)
  const busy = useRef(false)

  useEffect(() => {
    active.current = true
    void passwordEligibility(client, userId).then(result => {
      if (active.current) setEligibility(result)
    })
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id === userId) return
      active.current = false
      setCurrent(''); setPassword(''); setConfirm(''); setCode('')
      setEligibility('expired')
      setPending(false)
    })
    return () => { active.current = false; data.subscription.unsubscribe() }
  }, [client, userId])

  useEffect(() => { onPending(pending); return () => onPending(false) }, [pending, onPending])
  useEffect(() => {
    if (eligibility === 'supported') document.getElementById(recovery ? 'password-new' : 'password-current')?.focus()
  }, [eligibility, recovery])

  function show(result: PasswordResult) {
    if (result.status === 'reauthenticate') {
      setNeedsCode(true)
      setFailure('Verify your identity with an email code before changing your password.')
    } else if (result.status === 'error') {
      setFailure(result.message)
      if (result.uncertain) { setCurrent(''); setPassword(''); setConfirm(''); setCode('') }
    }
  }

  async function sendCode() {
    if (busy.current || !active.current) return
    busy.current = true; setPending(true); setFailure(null)
    try {
      const result = await requestPasswordCode(client, userId)
      if (!active.current) return
      if (result.status === 'success') { setSent(true); setCode('') }
      else show(result)
    } finally {
      busy.current = false
      if (active.current) setPending(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current || !active.current) return
    const found: Errors = {}
    if (!recovery && !current) found.current = 'Enter your current password.'
    if (password.length < 8) found.new = 'Use at least 8 characters. Your account may require a stronger password.'
    else if (!recovery && password === current) found.new = 'Choose a password different from your current one.'
    if (!confirm || confirm !== password) found.confirm = 'Enter the same new password in both fields.'
    if (needsCode && !code.trim()) found.code = 'Enter the verification code from your email.'
    setErrors(found); setFailure(null)
    const invalid = (Object.keys(found) as Fields[])[0]
    if (invalid) { document.getElementById(`password-${invalid}`)?.focus(); return }
    busy.current = true; setPending(true)
    try {
      const result = await passwordUpdate(client, userId, {
        password, ...(!recovery && { currentPassword: current }), ...(needsCode && { nonce: code.trim() }),
      }, recovery)
      if (!active.current) return
      if (result.status === 'success') {
        setCurrent(''); setPassword(''); setConfirm(''); setCode(''); setSuccess(true)
      } else show(result)
    } finally {
      busy.current = false
      if (active.current) setPending(false)
    }
  }

  if (eligibility === 'loading') return <p role="status">{t('Checking password settings…')}</p>
  if (eligibility !== 'supported') return <p role="alert">{t(eligibility === 'unsupported'
    ? 'Password changes here require a confirmed email account. Use your sign-in provider to manage other accounts.'
    : eligibility === 'expired' ? 'Your session has changed or expired. Sign in again, or request a new recovery link from the hub.'
      : 'Couldn’t check your account. Close this form and try again.')}</p>
  if (success) return <p role="status">{t('Your password has been changed. Use the new password next time you sign in.')}</p>

  return <form className="auth password-form" onSubmit={event => void submit(event)} noValidate aria-busy={pending}>
    <p className="auth__intro">{t(recovery ? 'Choose a new password for the account verified by your recovery link.' : 'Change the password for your account across Essentia.')}</p>
    {recovery && <p>{t('Recovery can also set a password for an email account that previously used sign-in links.')}</p>}
    {!recovery && <PasswordField name="current" label="Current password" value={current} onChange={setCurrent} error={errors.current} disabled={pending} />}
    <PasswordField name="new" label="New password" value={password} onChange={setPassword} error={errors.new} disabled={pending} />
    <PasswordField name="confirm" label="Confirm new password" value={confirm} onChange={setConfirm} error={errors.confirm} disabled={pending} />
    {needsCode && <>
      <button type="button" className="auth__link" disabled={pending} onClick={() => void sendCode()}>{t(sent ? 'Send a new code' : 'Send verification code')}</button>
      {sent && <p role="status">{t('Check your email for the verification code.')}</p>}
      <PasswordField name="code" label="Verification code" value={code} onChange={setCode} error={errors.code} disabled={pending} />
    </>}
    {failure && <p className="auth__failure" role="alert">{t(failure)}</p>}
    <button type="submit" className="auth__submit" aria-disabled={pending}>{t(pending ? 'Please wait…' : 'Change password')}</button>
    {!recovery && (pending
      ? <span className="auth__link" aria-disabled="true">{t('Forgot your password?')}</span>
      : <a className="auth__link" href="/?recover=password">{t('Forgot your password?')}</a>)}
  </form>
}

function PasswordField({ name, label, value, onChange, error, disabled }: {
  name: Fields; label: string; value: string; onChange: (value: string) => void; error?: string; disabled: boolean
}) {
  const id = `password-${name}`
  return <div className="auth__field">
    <label className="label" htmlFor={id}>{t(label)}</label>
    <input id={id} className="auth__input" type={name === 'code' ? 'text' : 'password'}
      autoComplete={name === 'code' ? 'one-time-code' : name === 'current' ? 'current-password' : 'new-password'}
      value={value} onChange={event => onChange(event.target.value)} disabled={disabled}
      aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} />
    {error && <p id={`${id}-error`} className="auth__error">{t(error)}</p>}
  </div>
}
