import { currentLocale, Dialog } from '@essentia/ui'
import { t } from '../locale'
import { convert, type Loss } from '../domain/convert'
import type { Note } from '../domain/notes'

/** What markdown to rich text keeps as written, in the order the sentence names them. */
const AS_TEXT: Partial<Record<Loss, string>> = {
  code: 'code',
  links: 'links',
  tables: 'tables',
  taskLists: 'task lists',
  images: 'images',
  strikethrough: 'strikethrough',
  rules: 'horizontal rules',
}

/** The sentences naming what this note's conversion cannot carry over. */
function lossLines(losses: Loss[]): string[] {
  if (losses.length === 0) return [t('Nothing is lost.')]
  const lines: string[] = []
  if (losses.includes('underline')) lines.push(t('Underline is removed.'))
  const asText = losses.flatMap((loss) => (AS_TEXT[loss] ? [t(AS_TEXT[loss])] : []))
  if (asText.length) {
    const items = new Intl.ListFormat(currentLocale(), { type: 'conjunction' }).format(asText)
    const sentence = t('{items} stay as text, with their markdown symbols.', { items })
    lines.push(sentence[0].toLocaleUpperCase(currentLocale()) + sentence.slice(1))
  }
  if (losses.includes('deepHeadings')) lines.push(t('Headings below level 2 become level 2.'))
  return lines
}

interface ConvertDialogProps {
  note: Note
  /** The control that opened the dialog: the bar button or the More menu. */
  returnFocusId: string
  onConvert: () => void
  onClose: () => void
}

/** Asks before a note changes format, saying what carries over and what does not. */
export function ConvertDialog({ note, returnFocusId, onConvert, onClose }: ConvertDialogProps) {
  const toMarkdown = note.format === 'rich'
  return (
    <Dialog
      title={t(toMarkdown ? 'Convert to markdown?' : 'Convert to rich text?')}
      titleId="convert-title"
      returnFocusId={returnFocusId}
      onClose={onClose}
    >
      <div className="dialog__text convert">
        <p>{t('Folio saves this version first; restore it any time from Versions.')}</p>
        <p>{t('Headings, lists, quotes, bold and italic carry over.')}</p>
        {lossLines(convert(note).losses).map((line) => <p key={line}>{line}</p>)}
      </div>
      <div className="dialog__actions">
        <button type="button" className="button-ghost button-ghost--outlined" data-autofocus onClick={onClose}>{t('Cancel')}</button>
        <button type="button" className="button-primary" onClick={onConvert}>{t('Convert')}</button>
      </div>
    </Dialog>
  )
}
