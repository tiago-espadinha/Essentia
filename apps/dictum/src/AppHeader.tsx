import { HubLink, ThemeToggle } from '@essentia/ui'
import type { ReactNode } from 'react'

/** `account` is the sign-in control; the shared reading view has none. */
export function AppHeader({ account }: { account?: ReactNode }) {
  return (
    <header className="dictum-header">
      <HubLink />
      <span className="dictum-header__title">Dictum</span>
      <div className="dictum-header__actions">
        {account}
        <ThemeToggle />
      </div>
    </header>
  )
}
