import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { t } from '../locale'

export const MORE_BUTTON_ID = 'more-button'
const MENU_ID = 'more-menu'

export interface MoreMenuItem {
  label: string
  onSelect: () => void
  danger?: boolean
}

/**
 * The note actions that do not fit the editor bar below 1024 px, as a menu
 * button: it opens on the first item (the last with ArrowUp), arrows and
 * Home/End move, Escape closes back to the trigger, Tab or a click outside
 * closes it where focus goes.
 */
export function MoreMenu({ items }: { items: MoreMenuItem[] }) {
  const [open, setOpen] = useState<'first' | 'last' | null>(null)
  const wrapper = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const entries = () => [...(wrapper.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])]

  useEffect(() => {
    if (!open) return
    const list = entries()
    list[open === 'first' ? 0 : list.length - 1]?.focus()
    function outside(event: PointerEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(null)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  function close() {
    setOpen(null)
    trigger.current?.focus()
  }

  function triggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    setOpen(event.key === 'ArrowDown' ? 'first' : 'last')
  }

  function menuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const list = entries()
    const index = list.indexOf(document.activeElement as HTMLButtonElement)
    const target = {
      ArrowDown: (index + 1) % list.length,
      ArrowUp: (index - 1 + list.length) % list.length,
      Home: 0,
      End: list.length - 1,
    }[event.key]
    if (target !== undefined) {
      event.preventDefault()
      list[target].focus()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'Tab') {
      setOpen(null)
    }
  }

  return (
    <div className="more-menu" ref={wrapper}>
      <button
        ref={trigger}
        id={MORE_BUTTON_ID}
        type="button"
        className="button-ghost more-menu__trigger"
        aria-label={t('More actions')}
        aria-haspopup="menu"
        aria-expanded={open !== null}
        aria-controls={open ? MENU_ID : undefined}
        onClick={() => (open ? close() : setOpen('first'))}
        onKeyDown={triggerKeyDown}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <circle cx="3.5" cy="8" r="1.25" />
          <circle cx="8" cy="8" r="1.25" />
          <circle cx="12.5" cy="8" r="1.25" />
        </svg>
        <span className="more-menu__label">{t('More')}</span>
      </button>
      {open && (
        <div id={MENU_ID} className="more-menu__list" role="menu" aria-labelledby={MORE_BUTTON_ID} onKeyDown={menuKeyDown}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={item.danger ? 'more-menu__item more-menu__item--danger' : 'more-menu__item'}
              onClick={() => {
                // The action decides where focus goes next: a dialog, or the list after a delete.
                setOpen(null)
                item.onSelect()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
