import type { SupabaseClient } from '@supabase/supabase-js'
import { lazy, Suspense, useEffect, useState } from 'react'
import { AppHeader } from './AppHeader'
import { displayTitle, formatDate } from './documents'
import { fetchShared } from './remote'

const Preview = lazy(() => import('./Preview'))

interface Shared {
  title: string
  content: string
  updatedAt: string
}

/** Text that opens with its own `# heading` already titles the page. */
const opensWithTitle = (content: string) => /^\s*# \S/.test(content)

type State = { status: 'loading' } | { status: 'missing' } | { status: 'failed' } | { status: 'ready'; doc: Shared }

/** Only what a share link may show; anything else in the reply is ignored. */
function readShared(value: unknown): Shared | null {
  if (typeof value !== 'object' || value === null) return null
  const { title, content, updated_at: updatedAt } = value as Record<string, unknown>
  if (typeof title !== 'string' || typeof content !== 'string' || typeof updatedAt !== 'string') return null
  return Number.isNaN(Date.parse(updatedAt)) ? null : { title, content, updatedAt }
}

interface SharedViewProps {
  /** Null when the link's id is malformed. */
  linkId: string | null
  /** Null when this build has no Supabase project. */
  client: SupabaseClient | null
}

/** A shared document, read-only, for anyone with the link. */
export function SharedView({ linkId, client }: SharedViewProps) {
  const [state, setState] = useState<State>(linkId && client ? { status: 'loading' } : { status: 'missing' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!linkId || !client) return
    let current = true
    fetchShared(client, linkId).then(
      (value) => {
        if (!current) return
        const doc = readShared(value)
        setState(doc ? { status: 'ready', doc } : { status: 'missing' })
      },
      () => current && setState({ status: 'failed' }),
    )
    return () => {
      current = false
    }
  }, [client, linkId, attempt])

  useEffect(() => {
    document.title = state.status === 'ready' ? `${displayTitle({ title: state.doc.title })} · Dictum` : 'Shared document · Dictum'
  }, [state])

  return (
    <>
      <AppHeader />
      <main className="shared" aria-busy={state.status === 'loading'}>
        {state.status === 'loading' && <p className="shared__note">Loading the document…</p>}
        {state.status === 'missing' && (
          <div className="shared__message">
            <h1 className="shared__title">This document isn’t shared any more.</h1>
            <p className="shared__note">The link may have been stopped, or the document deleted.</p>
            <a className="button-ghost button-ghost--outlined" href="/">
              Go to Essentia
            </a>
          </div>
        )}
        {state.status === 'failed' && (
          <div className="shared__message">
            <h1 className="shared__title">Couldn’t load this document.</h1>
            <p className="shared__note">Check your connection and try again.</p>
            <button
              type="button"
              className="button-primary"
              onClick={() => {
                setState({ status: 'loading' })
                setAttempt((count) => count + 1)
              }}
            >
              Try again
            </button>
          </div>
        )}
        {state.status === 'ready' && (
          <article className="shared__doc">
            <header className="shared__head">
              {!opensWithTitle(state.doc.content) && <h1 className="shared__title">{displayTitle({ title: state.doc.title })}</h1>}
              <p className="label">Shared from Dictum · Updated {formatDate(state.doc.updatedAt)}</p>
            </header>
            <Suspense fallback={<p className="shared__note">Loading the document…</p>}>
              <Preview content={state.doc.content} idle="This document is empty." />
            </Suspense>
          </article>
        )}
      </main>
    </>
  )
}
