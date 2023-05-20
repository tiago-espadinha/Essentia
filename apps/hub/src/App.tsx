import { useLocale } from '@essentia/ui'
import { t } from './locale'
import { AccentSelect, LocaleSelect, Search, ThemeToggle } from '@essentia/ui'
import { suiteApps, type SuiteApp } from './domain/apps'
import { AppSample } from './AppSample'
import { Account } from './Account'

// The link's ::after stretches over the card, so the whole card opens the app
// while staying a real link (new-tab clicks work) with a short name.
function AppCard({ app }: { app: SuiteApp }) {
  return (
    <li className="hub-card">
      <AppSample name={app.name} />
      <div className="hub-card__foot">
        <h2 className="hub-card__name"><a className="hub-card__link" href={app.path}>{app.name}</a></h2>
        <p className="hub-card__catchphrase">{t(app.catchphrase ?? app.latin)}</p>
      </div>
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
              {listed.map((app) => <AppCard key={app.path} app={app} />)}
            </ul>
          </nav>
        )}
      </main>
    </>
  )
}
