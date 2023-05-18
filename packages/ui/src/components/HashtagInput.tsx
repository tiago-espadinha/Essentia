import { useLayoutEffect, useRef, useState, type InputHTMLAttributes, type KeyboardEvent, type RefObject } from 'react'
import { t } from '../locale'
import { applyTag, tagAtCaret, tagSuggestions } from '../domain/hashtag'

interface HashtagInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'role' | 'id'> {
  id: string
  inputRef: RefObject<HTMLInputElement | null>
  value: string
  onValueChange: (value: string) => void
  /** Categories in use, offered while a '#' word is typed. */
  categories: readonly string[]
  /** The longest category the app accepts; longer tags are plain text. */
  maxTag: number
}

/**
 * A text input that suggests categories while a '#name' word is typed: arrows
 * move, Enter or Tab pick, Escape closes, a tap picks. Without a '#' word it
 * behaves as a plain input, so Enter still submits the form.
 */
export function HashtagInput({ id, inputRef, value, onValueChange, categories, maxTag, onKeyDown, ...input }: HashtagInputProps) {
  const [caret, setCaret] = useState<number | null>(null)
  const [active, setActive] = useState(-1)
  // The start of a tag word whose list Escape closed; typing elsewhere reopens.
  const [dismissed, setDismissed] = useState<number | null>(null)
  const nextCaret = useRef<number | null>(null)

  const at = caret === null ? null : tagAtCaret(value, caret)
  const options = at ? tagSuggestions(categories, at.query, maxTag) : []
  const open = at !== null && options.length > 0 && dismissed !== at.start
  const listId = `${id}-tags`

  useLayoutEffect(() => {
    if (nextCaret.current === null) return
    inputRef.current?.setSelectionRange(nextCaret.current, nextCaret.current)
    nextCaret.current = null
  }, [value, inputRef])

  function pick(name: string) {
    if (!at) return
    const next = applyTag(value, at, name)
    nextCaret.current = next.caret
    setCaret(next.caret)
    setActive(-1)
    onValueChange(next.value)
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (open && at) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const step = event.key === 'ArrowDown' ? 1 : -1
        setActive(active < 0 ? (step > 0 ? 0 : options.length - 1) : (active + step + options.length) % options.length)
        return
      }
      if ((event.key === 'Enter' && active >= 0) || event.key === 'Tab') {
        event.preventDefault()
        pick(options[Math.max(active, 0)])
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setDismissed(at.start)
        setActive(-1)
        return
      }
    }
    onKeyDown?.(event)
  }

  const track = (target: HTMLInputElement) => setCaret(target.selectionStart)

  return (
    <div className="ui-hashtag">
      <input
        {...input}
        ref={inputRef}
        id={id}
        value={value}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(event) => {
          onValueChange(event.target.value)
          track(event.target)
          setActive(-1)
          setDismissed(null)
        }}
        onSelect={(event) => track(event.currentTarget)}
        onFocus={(event) => track(event.currentTarget)}
        onBlur={() => setCaret(null)}
        onKeyDown={onKey}
      />
      {open && (
        <ul id={listId} className="ui-hashtag__list" role="listbox" aria-label={t('Categories')}>
          {options.map((name, index) => (
            <li
              key={name}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className="ui-hashtag__option"
              // Keep focus in the input so a tap or click picks without closing the list first.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(name)}
            >
              <span aria-hidden="true">#</span>{name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Names the category a tag in the text will file the item under; quiet when there is none. */
export function HashtagChip({ category }: { category: string | null }) {
  return (
    <p className="ui-hashtag-chip" aria-live="polite">
      {category && t('Category: {category}', { category })}
    </p>
  )
}
