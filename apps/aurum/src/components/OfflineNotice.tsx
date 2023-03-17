import { t } from '../locale'
import '../../../../scripts/pwa-offline.css'

export function OfflineNotice({ saveFailed }: { saveFailed: boolean }) {
  return (
    <main className="pwa-offline">
      <h1>{t('A connection is needed.')}</h1>
      <p role="status">{saveFailed
        ? t('Couldn’t save on this device. Your latest changes may be lost if you close this page.')
        : t('Merces needs a connection. Your existing changes are kept on this device.')}</p>
      <div className="pwa-offline__actions">
        <button type="button" onClick={() => window.dispatchEvent(new Event('online'))}>{t('Try again')}</button>
        <a href="/">{t('Back to Essentia')}</a>
      </div>
    </main>
  )
}
