import { useEffect, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { activeFormats, applyFormat, type Format } from './editing'

const svg = (path: ReactNode) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {path}
  </svg>
)

const TOOLS: { format: Format; label: string; icon: ReactNode }[][] = [
  [
    { format: 'bold', label: 'Bold', icon: svg(<path d="M5 3h3.5a2.5 2.5 0 0 1 0 5H5zM5 8h4a2.5 2.5 0 0 1 0 5H5z" />) },
    { format: 'italic', label: 'Italic', icon: svg(<path d="M7 3h5M4 13h5M9.5 3l-3 10" />) },
    { format: 'underline', label: 'Underline', icon: svg(<path d="M4.5 3v4.5a3.5 3.5 0 0 0 7 0V3M3.5 13.5h9" />) },
  ],
  [
    { format: 'h1', label: 'Heading 1', icon: svg(<path d="M2 3.5v9M8 3.5v9M2 8h6M11.5 6.5 13.5 5v7.5" />) },
    { format: 'h2', label: 'Heading 2', icon: svg(<path d="M2 3.5v9M8 3.5v9M2 8h6M10.5 6.5a1.75 1.75 0 1 1 3 1.3L10.5 12.5h3.5" />) },
    { format: 'blockquote', label: 'Quote', icon: svg(<path d="M3 3v10M6.5 5h6.5M6.5 8h6.5M6.5 11h4" />) },
  ],
  [
    { format: 'bulleted', label: 'Bulleted list', icon: svg(<path d="M6.5 4h7M6.5 8h7M6.5 12h7M2.75 4h.01M2.75 8h.01M2.75 12h.01" />) },
    { format: 'numbered', label: 'Numbered list', icon: svg(<path d="M7 4h6.5M7 8h6.5M7 12h6.5M2.5 3.25 3.5 2.75v3M2.5 10a1 1 0 1 1 1.6.8L2.5 13h2" />) },
  ],
]

const FORMATS = TOOLS.flat().map((tool) => tool.format)

interface ToolbarProps {
  bodyRef: RefObject<HTMLDivElement | null>
  /** Called after a format is applied, so the body can be saved. */
  onFormat: () => void
}

/**
 * Formatting for the note body, with pressed states that follow the selection.
 * One Tab stop: the arrow keys, Home and End move between the buttons.
 */
export function Toolbar({ bodyRef, onFormat }: ToolbarProps) {
  const [active, setActive] = useState<Set<Format>>(() => new Set())
  const [current, setCurrent] = useState<Format>(FORMATS[0])

  useEffect(() => {
    // Selection changes anywhere on the page; re-render only when the formats differ.
    const update = () => {
      if (!bodyRef.current) return
      const next = activeFormats(bodyRef.current)
      setActive((current) => ([...current].join() === [...next].join() ? current : next))
    }
    document.addEventListener('selectionchange', update)
    return () => document.removeEventListener('selectionchange', update)
  }, [bodyRef])

  function format(target: Format) {
    const body = bodyRef.current!
    if (!body.contains(document.activeElement)) body.focus()
    applyFormat(body, target)
    setCurrent(target)
    setActive(activeFormats(body))
    onFormat()
  }

  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    const index = FORMATS.indexOf(current)
    const next = {
      ArrowRight: (index + 1) % FORMATS.length,
      ArrowLeft: (index - 1 + FORMATS.length) % FORMATS.length,
      Home: 0,
      End: FORMATS.length - 1,
    }[event.key]
    if (next === undefined) return
    event.preventDefault()
    setCurrent(FORMATS[next])
    event.currentTarget.querySelectorAll('button')[next].focus()
  }

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting" onKeyDown={moveFocus}>
      {TOOLS.map((group, index) => (
        <div key={index} className="toolbar__group">
          {group.map(({ format: target, label, icon }) => (
            <button
              key={target}
              type="button"
              className="toolbar__button"
              aria-label={label}
              title={label}
              aria-pressed={active.has(target)}
              tabIndex={target === current ? 0 : -1}
              onFocus={() => setCurrent(target)}
              // Keep the selection in the body when the button is pressed.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => format(target)}
            >
              {icon}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
