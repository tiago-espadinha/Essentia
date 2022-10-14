import { HubLink, ThemeToggle } from '@essentia/ui'

export function AppHeader() {
  return (
    <header className="dictum-header">
      <HubLink />
      <span className="dictum-header__title">Dictum</span>
      <ThemeToggle />
    </header>
  )
}
