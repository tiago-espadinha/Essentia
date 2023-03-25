# @essentia/supabase

Sign-in for the apps that sync (Virtus, Dictum, Aurum): one Supabase project
and one session for the whole suite, since every app is served from one origin.

```tsx
import { AccountMenu, getSupabase, useAuth } from '@essentia/supabase'

const client = getSupabase() // null without VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
const auth = useAuth(client) // 'disabled' | 'loading' | 'signed-out' | 'signed-in'

// In the header: sign in, sync status with a retry, and sign out (synced first).
<AccountMenu auth={auth} client={client} syncState={syncState} onSync={sync} text={TEXT} />
```

`text` words the menu for the app's data: the sign-in intro, one line per
sync state, and what signing out does to the device's copy. `AuthForm`,
`signIn`, `signUp` and `signOut` are exported for anything the menu does not cover.

Each app reads the two variables above from its own `.env.local`, which git
ignores. Without them the app hides sign-in and keeps data on the device. Only the publishable (anon) key belongs in client code; row level
security in each app's `supabase/migration.sql` is what protects the data.

The shared account menu includes password changes. It verifies the user with
`getUser`, requires a confirmed email identity and submits the current password
to Supabase Auth. An email identity alone does not prove a password exists:
the current password is verified separately with a password grant for the
server-verified email. Its temporary session is revoked with local scope before
the update; neither request replaces the shared SDK session. Wrong passwords and
passwordless accounts cannot proceed through an ordinary change. Supabase’s
conditional current-password setting remains an additional server control.
Server-required reauthentication requests an email code and submits the nonce.
These Auth requests use the captured, server-verified session token, so a later
account switch cannot redirect a mutation to the replacement account. They do not
replace the shared SDK session or rotate its refresh token.

The hub mounts `PasswordRecovery` alongside its account controls. Recovery email
requests always redirect to the same-origin hub root, which must be allowed in
Supabase Auth. Only the SDK `PASSWORD_RECOVERY` event opens the reset form;
URL flags alone open at most the email-request form. Passwords and codes remain
in transient form/request memory; app storage and logs do not receive them.
Closing recovery keeps its session signed in. Password changes do not promise
sign-out on other devices; server settings govern session behaviour.
Recovery explains that it can establish a password for an email account that
previously used sign-in links. A lost password-verification response can leave an
unknown temporary server session; the app never retries automatically or writes
its credentials to storage.
