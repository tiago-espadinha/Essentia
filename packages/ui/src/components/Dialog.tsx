import { t } from '../locale'
import { useLocale } from '../domain/locale'
import { useEffect, useRef, type ReactNode } from 'react'
import '../ui.css'

interface DialogProps {
  title: string
  titleId: string
  /** Gets focus back on close; looked up then, since the opener may have re-rendered. */
  returnFocusId: string
  /** Without it the dialog asks a question that must be answered: no close button, Esc or backdrop. */
  onClose?: () => void
  children: ReactNode
}

/**
 * A modal on the native <dialog>: the browser traps focus, makes the page inert
 * and closes on Esc. Opened on mount; focus goes back on unmount.
 */
export function Dialog({ title, titleId, returnFocusId, onClose, children }: DialogProps) {
  useLocale()
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current!
    if (!dialog.open) dialog.showModal()
    // A form dialog starts in its first field rather than on the close button; a question, on its marked answer.
    dialog.querySelector<HTMLElement>('input, select, textarea, [data-autofocus]')?.focus()
    return () => document.getElementById(returnFocusId)?.focus()
  }, [returnFocusId])

  return (
    <dialog
      ref={ref}
      className="ui-dialog"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('*')].filter(control => control.matches('button:not(:disabled), a[href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'))
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }}
      // Chrome lets a repeated Esc through even when cancel is refused; a question then reopens.
      onClose={onClose ?? (() => ref.current?.showModal())}
      onCancel={(event) => {
        if (!onClose) event.preventDefault()
      }}
      // A click on the backdrop lands on the dialog itself, outside its panel.
      onClick={(event) => {
        if (event.target === ref.current) onClose?.()
      }}
    >
      <div className="ui-dialog__panel">
        <div className="ui-dialog__header">
          <h2 id={titleId} className="ui-dialog__title">
            {title}
          </h2>
          {onClose && (
            <button type="button" className="ui-icon-button" onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="visually-hidden">{t('Close')}</span>
            </button>
          )}
        </div>
        {children}
      </div>
    </dialog>
  )
}
