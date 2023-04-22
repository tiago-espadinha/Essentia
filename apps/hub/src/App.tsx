import { useLocale } from '@essentia/ui'
import { t } from './locale'
import { AccentSelect, LocaleSelect, Search, ThemeToggle } from '@essentia/ui'
import { suiteApps, type SuiteApp } from './domain/apps'
import { AppIcon } from './AppIcon'
import { Account } from './Account'

function AppEntry({ app }: { app: SuiteApp }) {
  return (
    <li className="hub__entry">
      <AppIcon name={app.name} />
      <div>
        <h2 className="hub__app-name">{app.name}</h2>
        <p className="hub__catchphrase">{t(app.catchphrase ?? app.latin)}</p>
      </div>
      <p className="hub__app-desc">{t(app.description)}</p>
      <a className="hub__open" href={app.path}>
        {t('Open {name}', { name: app.name })} <span aria-hidden="true">↗</span>
      </a>
    </li>
  )
}

export default function App({ apps = suiteApps }: { apps?: SuiteApp[] }) {
  useLocale()
  const listed = apps.filter((app) => !app.retired)

  return (
    <>
      <header className="hub__bar">
        <span className="hub__wordmark">Essentia</span>
        <div className="hub__appearance">
          <Account />
          <Search />
          <LocaleSelect />
          <AccentSelect />
          <ThemeToggle />
        </div>
      </header>

      <main className="hub">
        <h1 className="hub__title">{t("The essentials of a working day.")}</h1>
        <p className="hub__lede">{t("A little space to think, do, grow and plan.")}</p>

        {listed.length === 0 ? (
          <section className="hub__empty" aria-labelledby="hub-empty-title">
            <h2 id="hub-empty-title" className="hub__section-title">{t("Nothing here yet.")}</h2>
            <p className="hub__empty-text">{t("Apps appear here as they join the suite.")}</p>
          </section>
        ) : (
          <nav aria-label={t("Everyday tools")}>
            <ul className="hub__apps">
              {listed.map((app) => <AppEntry key={app.path} app={app} />)}
            </ul>
          </nav>
        )}
      </main>
    </>
  )
}
