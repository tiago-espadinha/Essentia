import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { SHORTCUTS, type Format } from './formatting'
import { shortcut } from './keys'

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
    { format: 'heading', label: 'Heading', icon: svg(<path d="M3 3.5v9M10 3.5v9M3 8h7M12.5 6.5 14 5.5v7" />) },
    { format: 'bold', label: 'Bold', icon: svg(<path d="M5 3h3.5a2.5 2.5 0 0 1 0 5H5zM5 8h4a2.5 2.5 0 0 1 0 5H5z" />) },
    { format: 'italic', label: 'Italic', icon: svg(<path d="M7 3h5M4 13h5M9.5 3l-3 10" />) },
    { format: 'link', label: 'Link', icon: svg(<path d="M7 9a2.5 2.5 0 0 0 3.5 0l2-2A2.5 2.5 0 0 0 9 3.5l-.5.5M9 7a2.5 2.5 0 0 0-3.5 0l-2 2A2.5 2.5 0 0 0 7 12.5l.5-.5" />) },
  ],
  [
    { format: 'quote', label: 'Quote', icon: svg(<path d="M3 3v10M6.5 5h6.5M6.5 8h6.5M6.5 11h4" />) },
    { format: 'bulleted', label: 'Bulleted list', icon: svg(<path d="M6.5 4h7M6.5 8h7M6.5 12h7M2.75 4h.01M2.75 8h.01M2.75 12h.01" />) },
    { format: 'numbered', label: 'Numbered list', icon: svg(<path d="M7 4h6.5M7 8h6.5M7 12h6.5M2.5 3.25 3.5 2.75v3M2.5 10a1 1 0 1 1 1.6.8L2.5 13h2" />) },
  ],
  [
    { format: 'code', label: 'Inline code', icon: svg(<path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5" />) },
    { format: 'codeblock', label: 'Code block', icon: svg(<path d="M2.5 2.5h11v11h-11zM6 6.5 4.5 8 6 9.5M10 6.5 11.5 8 10 9.5" />) },
  ],
]

const KEYS = Object.fromEntries(Object.entries(SHORTCUTS).map(([key, format]) => [format, shortcut(key)]))

const POSITION = new Map(TOOLS.flat().map(({ format }, position) => [format, position]))
const COUNT = POSITION.size

/**
 * Markdown formatting for the selection in the editor. One tab stop: the arrow
 * keys, Home and End move between the buttons, and the last one used keeps the stop.
 */
export function Toolbar({ onFormat }: { onFormat: (format: Format) => void }) {
  const [current, setCurrent] = useState(0)

  function move(event: KeyboardEvent<HTMLDivElement>) {
    const next = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: COUNT - 1 }[event.key]
    if (next === undefined) return
    event.preventDefault()
    event.currentTarget.querySelectorAll('button')[(next + COUNT) % COUNT].focus()
  }

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting" aria-controls="doc-content" onKeyDown={move}>
      {TOOLS.map((group) => (
        <div key={group[0].format} className="toolbar__group">
          {group.map(({ format, label, icon }) => {
            const position = POSITION.get(format)!
            const keys = KEYS[format]
            return (
              <button
                key={format}
                type="button"
                className="toolbar__button"
                title={keys ? `${label} (${keys.label})` : label}
                aria-keyshortcuts={keys?.aria}
                tabIndex={position === current ? 0 : -1}
                onFocus={() => setCurrent(position)}
                // Keeps the selection in the editor while the button is pressed.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onFormat(format)}
              >
                {icon}
                <span className="visually-hidden">{label}</span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
