import { HubLink, Search, ThemeToggle } from '@essentia/ui'
import type { ReactNode } from 'react'

/** `account` is the sign-in control; the shared reading view has none. */
export function AppHeader({ account, search }: { account?: ReactNode; search?: ReactNode }) {
  return (
    <header className="dictum-header">
      <HubLink />
      <span className="dictum-header__title">Dictum</span>
      <div className="dictum-header__actions">
        {search ?? <Search />}
          {account}
        <ThemeToggle />
      </div>
    </header>
  )
}
