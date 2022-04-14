import './ui.css'

/** Back to the hub at the site root; every app shows it in its header. */
export function HubLink() {
  return (
    <a className="ui-hub-link" href="/">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="visually-hidden">Back to </span>
      Essentia
    </a>
  )
}
