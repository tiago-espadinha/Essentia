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
