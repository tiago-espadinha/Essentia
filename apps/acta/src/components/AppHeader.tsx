import type { ReactNode } from 'react'
import { t } from '../locale'
import { HubLink, Search, ThemeToggle } from '@essentia/ui'

export function AppHeader({ account, search }: { account?: ReactNode; search?: ReactNode }) {
  return (
    <header className="acta-header">
      <div className="acta-header__inner">
        <HubLink />
        <span className="acta-header__title app-identity">Acta{' '}<span className="app-identity__catchphrase">{t("Your Tasks")}</span></span>
        <div className="ui-header-actions">{search ?? <Search />}{account}<ThemeToggle /></div>
      </div>
    </header>
  )
}
