import type { ReactNode } from 'react'
import { t } from '../locale'
import { HubLink, Search, ThemeToggle } from '@essentia/ui'

export function AppHeader({ search }: { search?: ReactNode }) {
  return (
    <header className="folio-header">
      <HubLink />
      <span className="folio-header__title app-identity">Folio{' '}<span className="app-identity__catchphrase">{t("Your Notes")}</span></span>
      <div className="ui-header-actions">{search ?? <Search />}<ThemeToggle /></div>
    </header>
  )
}
