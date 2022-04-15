import { ThemeToggle } from '@essentia/ui'
import { suiteApps } from './apps'

export default function App() {
  return (
    <>
      <header className="hub__bar">
        <ThemeToggle />
      </header>

      <main className="hub">
        <h1 className="hub__title">Essentia</h1>
        <p className="hub__lede">Small, calm tools for the essentials of a working day.</p>

        {suiteApps.length === 0 ? (
          <section className="hub__empty" aria-labelledby="hub-empty-title">
            <h2 id="hub-empty-title" className="hub__empty-title">Nothing here yet.</h2>
            <p className="hub__empty-text">Apps appear in this list as they join the suite.</p>
          </section>
        ) : (
          <nav aria-label="Apps">
            <ul className="hub__apps">
              {suiteApps.map((app) => (
                <li key={app.name}>
                  <a className="hub__app" href={app.path}>
                    <span className="hub__app-name">{app.name}</span>
                    <span className="hub__app-latin">{app.latin}</span>
                    <span className="hub__app-desc">{app.description}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </main>
    </>
  )
}
