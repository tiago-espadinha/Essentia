import { HubLink, ThemeToggle } from '@essentia/ui'

export function AppHeader() {
  return (
    <header className="virtus-header">
      <div className="virtus-header__inner">
        <HubLink />
        <span className="virtus-header__title">Virtus</span>
        <ThemeToggle />
      </div>
    </header>
  )
}
