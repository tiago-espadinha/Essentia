import { HubLink, ThemeToggle } from '@essentia/ui'
import type { ReactNode } from 'react'

/** `account` is the account control, once someone is signed in. */
export function AppHeader({ account }: { account?: ReactNode }) {
  return (
    <header className="aurum-header">
      <div className="aurum-header__inner">
        <HubLink />
        <span className="aurum-header__title app-identity">Merces{' '}<span className="app-identity__catchphrase">Your Money</span></span>
        <div className="aurum-header__actions">
          {account}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
