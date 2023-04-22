import { useLocale } from '@essentia/ui'
import { useEffect } from 'react'
import { t } from '../locale'
import { AppHeader } from './AppHeader'

/**
 * What /dictum/ shows now that Folio keeps markdown notes. Nothing here is
 * deleted: Folio takes in this device's documents when it opens.
 */
export function MovedPage() {
  const locale = useLocale()
  useEffect(() => {
    document.title = `${t('Dictum is now part of Folio')} · Essentia`
  }, [locale])

  return (
    <>
      <AppHeader />
      <main className="shared">
        <div className="shared__message">
          <h1 className="shared__title">{t('Dictum is now part of Folio.')}</h1>
          <p className="shared__note">
            {t('Your markdown documents open in Folio, beside your notes, with their versions. Folio brings in the documents on this device the first time it opens here.')}
          </p>
          <p className="shared__note">{t('Links you shared from Dictum keep working.')}</p>
          <a className="button-primary" href="/folio/">{t('Open Folio')}</a>
        </div>
      </main>
    </>
  )
}
