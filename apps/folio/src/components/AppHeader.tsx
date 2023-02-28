import { HubLink, ThemeToggle } from '@essentia/ui'

export function AppHeader() {
  return (
    <header className="folio-header">
      <HubLink />
      <span className="folio-header__title">Folio</span>
      <ThemeToggle />
    </header>
  )
}
