import { HubLink, ThemeToggle } from '@essentia/ui'
import type { ReactNode } from 'react'

export function AppHeader({ account }: { account: ReactNode }) {
  return (
    <header className="virtus-header">
      <div className="virtus-header__inner">
        <HubLink />
        <span className="virtus-header__title">Virtus</span>
        <div className="virtus-header__actions">
          {account}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
