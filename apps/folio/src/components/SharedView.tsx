import { useLocale } from '@essentia/ui'
import type { SupabaseClient } from '@supabase/supabase-js'
import { lazy, Suspense, useEffect, useState } from 'react'
import { t } from '../locale'
import { AppHeader } from './AppHeader'
import { fetchShared } from '../data/remote'
import { formatDate, type NoteFormat } from '../domain/notes'
import { sanitizeHtml } from '../domain/sanitize'

const Preview = lazy(() => import('./Preview'))

interface Shared {
  title: string
  content: string
  format: NoteFormat
  updatedAt: string
}

type State = { status: 'loading' } | { status: 'missing' } | { status: 'failed' } | { status: 'ready'; note: Shared }

/** A markdown note that opens with its own `# heading` already titles the page. */
const opensWithTitle = ({ format, content }: Shared) => format === 'markdown' && /^\s*# \S/.test(content)

/**
 * Only what a share link may show; anything else in the reply is ignored. A
 * body is rich only when the reply says so: anything else, including a reply
 * from before the format was returned, is markdown, which never renders HTML.
 */
function readShared(value: unknown): Shared | null {
  if (typeof value !== 'object' || value === null) return null
  const { title, content, format, updated_at: updatedAt } = value as Record<string, unknown>
  if (typeof title !== 'string' || typeof content !== 'string' || typeof updatedAt !== 'string') return null
  if (Number.isNaN(Date.parse(updatedAt))) return null
  return { title, content, format: format === 'rich' ? 'rich' : 'markdown', updatedAt }
}

function SharedBody({ note }: { note: Shared }) {
  if (!note.content.trim()) return <p className="shared__note">{t('This note is empty.')}</p>
  if (note.format === 'rich') {
    // Cleaned here as well as when written: the reply is untrusted, whoever wrote it.
    return <div className="editor__body shared__body" dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.content) }} />
  }
  return (
    <Suspense fallback={<p className="shared__note">{t('Loading the note…')}</p>}>
      <Preview content={note.content} shared />
    </Suspense>
  )
}

interface SharedViewProps {
  /** Null when the link's id is malformed. */
  linkId: string | null
  /** Null when this build has no Supabase project. */
  client: SupabaseClient | null
}

/** A shared note, read-only, for anyone with the link. */
export function SharedView({ linkId, client }: SharedViewProps) {
  const locale = useLocale()
  const [state, setState] = useState<State>(linkId && client ? { status: 'loading' } : { status: 'missing' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!linkId || !client) return
    let current = true
    fetchShared(client, linkId).then(
      (value) => {
        if (!current) return
        const note = readShared(value)
        setState(note ? { status: 'ready', note } : { status: 'missing' })
      },
      () => current && setState({ status: 'failed' }),
    )
    return () => {
      current = false
    }
  }, [client, linkId, attempt])

  useEffect(() => {
    document.title = `${state.status === 'ready' ? state.note.title.trim() || t('Untitled') : t('Shared note')} · Folio`
  }, [state, locale])

  return (
    <>
      <AppHeader />
      <main className="shared" aria-busy={state.status === 'loading'}>
        {state.status === 'loading' && <p className="shared__note">{t('Loading the note…')}</p>}
        {state.status === 'missing' && (
          <div className="shared__message">
            <h1 className="shared__title">{t('This note isn’t shared any more.')}</h1>
            <p className="shared__note">{t('The link may have been stopped, or the note deleted.')}</p>
            <a className="button-ghost button-ghost--outlined" href="/">{t('Go to Essentia')}</a>
          </div>
        )}
        {state.status === 'failed' && (
          <div className="shared__message">
            <h1 className="shared__title">{t('Couldn’t load this note.')}</h1>
            <p className="shared__note">{t('Check your connection and try again.')}</p>
            <button
              type="button"
              className="button-primary"
              onClick={() => {
                setState({ status: 'loading' })
                setAttempt((count) => count + 1)
              }}
            >{t('Try again')}</button>
          </div>
        )}
        {state.status === 'ready' && (
          <article className="shared__doc">
            <header className="shared__head">
              {!opensWithTitle(state.note) && <h1 className="shared__title">{state.note.title.trim() || t('Untitled')}</h1>}
              <p className="label">{t('Shared from Folio · Updated {date}', { date: formatDate(state.note.updatedAt) })}</p>
            </header>
            <SharedBody note={state.note} />
          </article>
        )}
      </main>
    </>
  )
}
