import type { SupabaseClient } from '@supabase/supabase-js'
import { useState, type FormEvent } from 'react'
import { signIn, signUp } from './auth'
import './auth.css'

type Mode = 'sign-in' | 'sign-up'
type FieldErrors = { email?: string; password?: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function check(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {}
  if (!email) errors.email = 'Enter your email address.'
  else if (!EMAIL.test(email)) errors.email = 'Enter an email address like name@example.com.'
  if (!password) errors.password = 'Enter a password.'
  return errors
}

interface AuthFormProps {
  client: SupabaseClient
  /** What signing in does in this app, shown above the fields. */
  intro: string
}

/** Sign in or create an account with email and password; the session then reaches the app through useAuth. */
export function AuthForm({ client, intro }: AuthFormProps) {
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [confirmTo, setConfirmTo] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const address = email.trim()
    const found = check(address, password)
    setErrors(found)
    setFailure(null)
    const invalid = found.email ? 'auth-email' : found.password ? 'auth-password' : null
    if (invalid) {
      document.getElementById(invalid)?.focus()
      return
    }

    setPending(true)
    if (mode === 'sign-in') {
      setFailure(await signIn(client, address, password))
    } else {
      const result = await signUp(client, address, password)
      setFailure(result.error)
      if (result.confirm) setConfirmTo(address)
    }
    setPending(false)
  }

  if (confirmTo) {
    return (
      <div className="auth" role="status">
        <p>
          Check your inbox at <strong>{confirmTo}</strong> and open the link to confirm your account, then sign in.
        </p>
        <button
          type="button"
          className="auth__link"
          onClick={() => {
            setConfirmTo(null)
            setMode('sign-in')
            setPassword('')
          }}
        >
          Back to sign in
        </button>
      </div>
    )
  }

  const signingIn = mode === 'sign-in'
  return (
    <form className="auth" onSubmit={submit} noValidate aria-busy={pending}>
      <p className="auth__intro">{intro}</p>
      <Field id="auth-email" label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} error={errors.email} />
      <Field
        id="auth-password"
        label="Password"
        type="password"
        autoComplete={signingIn ? 'current-password' : 'new-password'}
        value={password}
        onChange={setPassword}
        error={errors.password}
      />
      {failure && (
        <p className="auth__failure" role="alert">
          {failure}
        </p>
      )}
      <button type="submit" className="auth__submit" aria-disabled={pending}>
        {pending ? 'Please wait…' : signingIn ? 'Sign in' : 'Create account'}
      </button>
      <p className="auth__switch">
        {signingIn ? 'No account yet?' : 'Already have an account?'}{' '}
        <button
          type="button"
          className="auth__link"
          onClick={() => {
            setMode(signingIn ? 'sign-up' : 'sign-in')
            setErrors({})
            setFailure(null)
          }}
        >
          {signingIn ? 'Create one' : 'Sign in'}
        </button>
      </p>
    </form>
  )
}

interface FieldProps {
  id: string
  label: string
  type: 'email' | 'password'
  autoComplete: string
  value: string
  onChange: (value: string) => void
  error: string | undefined
}

/** A labelled input with its error underneath, tied to it for screen readers. */
function Field({ id, label, type, autoComplete, value, onChange, error }: FieldProps) {
  const errorId = `${id}-error`
  return (
    <div className="auth__field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="auth__input"
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <p id={errorId} className="auth__error">
          {error}
        </p>
      )}
    </div>
  )
}
