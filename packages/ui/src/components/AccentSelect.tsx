import { useEffect, useId, useState, useSyncExternalStore } from 'react'
import { accents, currentAccent, setAccent, subscribeAccent, type Accent } from '../domain/accent'
import '../ui.css'

export function AccentSelect() {
  const id = useId()
  const accent = useSyncExternalStore(subscribeAccent, currentAccent)
  const [unsaved, setUnsaved] = useState(false)
  useEffect(() => subscribeAccent(() => setUnsaved(false)), [])

  return (
    <div className="ui-accent">
      <div className="ui-accent__label">
        <label htmlFor={id}>Accent</label>
        <select
          id={id}
          value={accent}
          aria-describedby={unsaved ? `${id}-error` : undefined}
          onChange={(event) => setUnsaved(!setAccent(event.target.value as Accent))}
        >
          {accents.map((value) => (
            <option key={value} value={value}>{value[0]!.toUpperCase() + value.slice(1)}</option>
          ))}
        </select>
      </div>
      <p id={`${id}-error`} role="status" className="ui-accent__error">
        {unsaved ? 'Accent changed for this page. Your browser could not save it.' : ''}
      </p>
    </div>
  )
}
