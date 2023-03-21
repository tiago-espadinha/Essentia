import { t } from '../locale'
import { HubLink, Search, ThemeToggle } from '@essentia/ui'
import type { ReactNode } from 'react'

export function AppHeader({ account, search }: { account: ReactNode; search?: ReactNode }) {
  return (
    <header className="virtus-header">
      <div className="virtus-header__inner">
        <HubLink />
        <span className="virtus-header__title app-identity">Virtus{' '}<span className="app-identity__catchphrase">{t("Your Habits")}</span></span>
        <div className="virtus-header__actions">
          {search ?? <Search />}
          {account}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
