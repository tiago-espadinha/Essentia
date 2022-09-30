# @essentia/supabase

Sign-in for the apps that sync (Virtus, Dictum, Aurum): one Supabase project
and one session for the whole suite, since every app is served from one origin.

```tsx
import { AuthForm, getSupabase, signOut, useAuth } from '@essentia/supabase'

const client = getSupabase() // null without VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
const auth = useAuth(client) // 'disabled' | 'loading' | 'signed-out' | 'signed-in'
```

Each app reads the two variables from its own `.env.local` (names in
`.env.example`). Without them the app hides sign-in and keeps data on the
device. Only the publishable (anon) key belongs in client code; row level
security in each app's `supabase/migration.sql` is what protects the data.
