import { useEffect, useId, useState } from 'react'
import { setLocale, subscribeLocale, useLocale, type Locale } from '../domain/locale'
import { t } from '../locale'
import '../ui.css'

export function LocaleSelect() {
  const id = useId()
  const locale = useLocale()
  const [unsaved, setUnsaved] = useState(false)
  useEffect(() => subscribeLocale(() => setUnsaved(false)), [])
  return (
    <div className="ui-accent">
      <div className="ui-accent__label">
        <label htmlFor={id}>{t('Language')}</label>
        <select id={id} value={locale} aria-describedby={unsaved ? `${id}-error` : undefined}
          onChange={(event) => setUnsaved(!setLocale(event.target.value as Locale))}>
          <option value="en-GB" lang="en-GB">English (UK)</option>
          <option value="pt-PT" lang="pt-PT">Português (Portugal)</option>
        </select>
      </div>
      <p id={`${id}-error`} role="status" className="ui-accent__error">
        {unsaved ? t('Language changed for this page. Your browser could not save it.') : ''}
      </p>
    </div>
  )
}
