import { HubLink, ThemeToggle } from '@essentia/ui'

export function AppHeader() {
  return (
    <header className="folio-header">
      <HubLink />
      <span className="folio-header__title app-identity">Folio{' '}<span className="app-identity__catchphrase">Your Notes</span></span>
      <ThemeToggle />
    </header>
  )
}
