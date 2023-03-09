const outlines: Record<string, string> = {
  Folio: 'M5 3h10l4 4v14H5z M15 3v5h4 M8 12h8 M8 16h6',
  Acta: 'M9 6h11 M9 12h11 M9 18h11 M3 6l1 1 2-3 M3 12l1 1 2-3 M3 18l1 1 2-3',
  Virtus: 'M12 21v-9 M12 16C5 16 3 12 3 7c6 0 9 3 9 9z M12 12c0-6 3-9 9-9 0 6-3 9-9 9z',
  Merces: 'M3 6h16v15H3z M3 6V3h13v3 M15 11h6v5h-6z',
}

export function AppIcon({ name }: { name: string }) {
  return (
    <svg className="hub__icon" width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d={outlines[name] ?? outlines.Folio} />
    </svg>
  )
}
