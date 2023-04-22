import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { formatNumber, useLocale } from '../domain/locale'
import { t } from '../locale'
import '../ui.css'

export interface SearchRecord {
  id: string
  title: string
  text: string
}

interface SearchProps {
  records?: SearchRecord[]
  onSelect?: (id: string) => void
  sourceLabel?: string
  sourceState?: 'ready' | 'loading' | 'unavailable'
  sessionKey?: string
}

const destinations = [
  { title: 'Essentia', href: '/' },
  { title: 'Folio', href: '/folio/' },
  { title: 'Acta', href: '/acta/' },
  { title: 'Virtus', href: '/virtus/' },
  { title: 'Merces', href: '/merces/' },
]
const LIMIT = 20

function isMac() {
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform)
}

/** Sources are supplied by the active app; private content never leaves its existing owner. */
export function Search({ sessionKey = 'local', ...props }: SearchProps) {
  useLocale()
  const [opener, setOpener] = useState<HTMLElement | null>(null)
  const [session, setSession] = useState(sessionKey)
  const trigger = useRef<HTMLButtonElement>(null)
  if (session !== sessionKey) {
    setSession(sessionKey)
    setOpener(null)
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.repeat || event.altKey || event.shiftKey) return
      if (event.key.toLowerCase() !== 'k' || (isMac() ? !event.metaKey || event.ctrlKey : !event.ctrlKey || event.metaKey)) return
      if (document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) return
      event.preventDefault()
      event.stopPropagation()
      setOpener(document.activeElement instanceof HTMLElement ? document.activeElement : trigger.current)
    }
    // Editor handlers get first refusal for existing formatting shortcuts.
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return <>
    <button ref={trigger} type="button" className="ui-icon-button ui-search-trigger" aria-label={t('Search')} aria-haspopup="dialog"
      aria-keyshortcuts={isMac() ? 'Meta+K' : 'Control+K'} title={`${t('Search')} (${isMac() ? '⌘K' : 'Ctrl+K'})`}
      onClick={() => {
        setOpener(document.activeElement instanceof HTMLElement ? document.activeElement : trigger.current)
      }}>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <circle cx="7.5" cy="7.5" r="5" stroke="currentColor" strokeWidth="1.5" />
        <path d="m11.5 11.5 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span className="ui-search-trigger__label">{t('Search')}</span>
    </button>
    {opener && <SearchDialog {...props} opener={opener} onClose={() => setOpener(null)} />}
  </>
}

function SearchDialog({ records = [], onSelect, sourceLabel, sourceState = 'ready', opener, onClose }: Omit<SearchProps, 'sessionKey'> & {
  opener: HTMLElement | null
  onClose: () => void
}) {
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const results = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<string | null>(null)
  const needle = query.trim().toLocaleLowerCase()
  const links = destinations.filter(item => item.title.toLocaleLowerCase().includes(needle))
  const matches = needle && sourceState === 'ready'
    ? records.filter(item => `${item.title}\n${item.text}`.toLocaleLowerCase().includes(needle)) : []
  const shown = matches.slice(0, LIMIT)
  const count = links.length + shown.length
  const optionKeys = [...links.map(item => `app:${item.href}`), ...shown.map(item => `record:${item.id}`)]
  const selected = active === null ? -1 : optionKeys.indexOf(active)

  useLayoutEffect(() => {
    const modal = dialog.current!
    modal.showModal()
    input.current?.focus()
    // Restore before the app's effects move focus to a selected record.
    return () => {
      modal.close()
      if (opener?.isConnected) opener.focus()
    }
  }, [opener])

  function onInputKey(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (count) {
        const next = selected < 0 ? (event.key === 'ArrowDown' ? 0 : count - 1)
          : (selected + (event.key === 'ArrowDown' ? 1 : -1) + count) % count
        setActive(optionKeys[next])
        results.current?.querySelectorAll<HTMLElement>('[role="option"]')[next]?.scrollIntoView?.({ block: 'nearest' })
      }
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (active === null || selected >= 0) {
        results.current?.querySelectorAll<HTMLElement>('[role="option"]')[active === null ? 0 : selected]?.click()
      }
    }
  }

  function onDialogKey(event: ReactKeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('*')].filter(control => control.matches('button:not(:disabled), a[href], input:not(:disabled)'))
    const first = controls[0]
    const last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  return <dialog ref={dialog} className="ui-dialog ui-search" aria-labelledby={`${id}-title`}
    onKeyDown={onDialogKey}
    onCancel={event => { event.preventDefault(); onClose() }} onClose={() => { if (!dialog.current?.open) onClose() }}
    onClick={event => { if (event.target === dialog.current) onClose() }}>
    <div className="ui-dialog__panel">
      <div className="ui-dialog__header">
        <h2 id={`${id}-title`} className="ui-dialog__title">{t('Search')}</h2>
        <button type="button" className="ui-icon-button" aria-label={t('Close')} onClick={onClose}>×</button>
      </div>
      <label className="ui-search__label" htmlFor={`${id}-input`}>{t(sourceLabel ? 'Find an app or a record' : 'Find an app')}</label>
      <input ref={input} id={`${id}-input`} className="ui-search__input" role="combobox" autoComplete="off"
        aria-expanded="true" aria-autocomplete="list" aria-controls={`${id}-results`}
        aria-activedescendant={selected >= 0 ? `${id}-option-${selected}` : undefined}
        aria-describedby={`${id}-status`} value={query} onKeyDown={onInputKey}
        onChange={event => { setQuery(event.target.value); setActive(null) }} />
      <p id={`${id}-status`} className="ui-search__status" role="status">
        {sourceLabel && sourceState === 'loading' ? t('Loading records…')
          : sourceLabel && sourceState === 'unavailable' ? t('Records are unavailable. You can still open an app.')
          : !needle ? t(sourceLabel ? 'Choose an app, or type to find records in this app.' : 'Choose an app.')
          : count === 0 ? t('No results. Try another search.')
          : sourceLabel ? t('{shown} of {total} matching records', { shown: formatNumber(shown.length), total: formatNumber(matches.length) })
          : t('Choose an app.')}
      </p>
      <div ref={results} id={`${id}-results`} className="ui-search__results" role="listbox" aria-label={t('Search results')}>
        {links.length > 0 && <div role="group" aria-label={t('Apps')}>
          <p className="ui-search__heading" aria-hidden="true">{t('Apps')}</p>
          {links.map((item, index) => <a key={item.href} id={`${id}-option-${index}`} role="option" aria-selected={selected === index}
            className="ui-search__result" href={item.href} onFocus={() => setActive(`app:${item.href}`)}>
            <span>{item.title}</span><span aria-hidden="true">↗</span>
          </a>)}
        </div>}
        {sourceLabel && shown.length > 0 && <div role="group" aria-label={sourceLabel}>
          <p className="ui-search__heading" aria-hidden="true">{sourceLabel}</p>
          {shown.map((item, index) => <button key={item.id} type="button" id={`${id}-option-${links.length + index}`} role="option"
            aria-selected={selected === links.length + index} className="ui-search__result" onFocus={() => setActive(`record:${item.id}`)}
            onClick={() => { onClose(); onSelect?.(item.id) }}>
            {item.title || t('Untitled')}
          </button>)}
        </div>}
      </div>
      <p className="ui-search__hint">{t('↑ ↓ to choose · Enter to open · Esc to close')}</p>
    </div>
  </dialog>
}
