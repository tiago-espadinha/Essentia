import { HubLink, ThemeToggle } from '@essentia/ui'

export function AppHeader() {
  return (
    <header className="acta-header">
      <div className="acta-header__inner">
        <HubLink />
        <span className="acta-header__title app-identity">Acta{' '}<span className="app-identity__catchphrase">Your Tasks</span></span>
        <ThemeToggle />
      </div>
    </header>
  )
}
