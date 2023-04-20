import type { ReactNode } from 'react'
import { t } from '../locale'
import { HubLink, Search, ThemeToggle } from '@essentia/ui'

/** `account` is the sign-in control, shown when the suite has an account service. */
export function AppHeader({ account, search }: { account?: ReactNode; search?: ReactNode }) {
  return (
    <header className="folio-header">
      <HubLink />
      <span className="folio-header__title app-identity">Folio{' '}<span className="app-identity__catchphrase">{t("Your Notes")}</span></span>
      <div className="ui-header-actions">{search ?? <Search />}{account}<ThemeToggle /></div>
    </header>
  )
}
