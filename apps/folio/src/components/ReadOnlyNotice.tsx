import { t } from '../locale'

/** Shown when the notes could not be stored on this device: they stay readable and can be saved elsewhere. */
export function ReadOnlyNotice({ onExport }: { onExport: () => void }) {
  return (
    <div className="read-only" role="alert">
      <p>
        <strong className="read-only__lead">{t('Couldn’t set up your notes on this device.')}</strong>{' '}
        {t('Nothing is lost: they show read-only, and Folio tries again next time.')}
      </p>
      <button type="button" className="button-ghost button-ghost--outlined" onClick={onExport}>{t('Export all')}</button>
    </div>
  )
}
