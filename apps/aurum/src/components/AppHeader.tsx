import { t } from '../locale'
import { HubLink, Search, ThemeToggle } from '@essentia/ui'
import type { ReactNode } from 'react'

/** `account` is the account control, once someone is signed in. */
export function AppHeader({ account, search }: { account?: ReactNode; search?: ReactNode }) {
  return (
    <header className="aurum-header">
      <div className="aurum-header__inner">
        <HubLink />
        <span className="aurum-header__title app-identity">{t("Merces")}{' '}<span className="app-identity__catchphrase">{t("Your Money")}</span></span>
        <div className="aurum-header__actions">
          {search ?? <Search />}
          {account}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
