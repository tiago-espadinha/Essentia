import { AuthForm, type Auth } from '@essentia/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

interface GateProps {
  auth: Auth
  client: SupabaseClient | null
}

/** What Aurum shows before anyone is signed in: it keeps no money data without an account. */
export function Gate({ auth, client }: GateProps) {
  if (!client || auth.status === 'disabled') {
    return (
      <section className="gate" aria-labelledby="gate-title">
        <h1 id="gate-title" className="gate__title">
          Aurum isn’t set up here
        </h1>
        <p className="gate__text">
          Aurum keeps your transactions in your Essentia account, and this copy of the suite has no account service
          configured. The other apps still work on this device.
        </p>
        <a className="gate__link" href="/">
          Back to Essentia
        </a>
      </section>
    )
  }

  if (auth.status === 'loading') {
    return (
      <p className="gate__loading" role="status">
        Checking your session…
      </p>
    )
  }

  return (
    <section className="gate" aria-labelledby="gate-title">
      <h1 id="gate-title" className="gate__title">
        Your money, in one place
      </h1>
      <div className="gate__form">
        <AuthForm
          client={client}
          intro="Aurum keeps your income and expenses in your account, so they follow you to every device. Sign in or create an account to start."
        />
      </div>
    </section>
  )
}
