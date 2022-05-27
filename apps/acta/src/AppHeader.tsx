import { HubLink, ThemeToggle } from '@essentia/ui'

export function AppHeader() {
  return (
    <header className="acta-header">
      <div className="acta-header__inner">
        <HubLink />
        <span className="acta-header__title">Acta</span>
        <ThemeToggle />
      </div>
    </header>
  )
}
