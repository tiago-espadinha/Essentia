import { AuthForm, type Auth } from '@essentia/supabase'
import { Dialog } from '@essentia/ui'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react'
import { displayTitle, type Doc } from './documents'
import { fetchShareId, shareDocument, unshareDocument } from './remote'
import { shareUrl } from './share'
import { LIMITS, syncable } from './sync'

export const SHARE_BUTTON_ID = 'share-button'

interface ShareDialogProps {
  doc: Doc
  auth: Auth
  client: SupabaseClient
  /** Resolves to whether this device's documents reached the account. */
  onSync: () => Promise<boolean>
  onClose: () => void
}

/** A read-only link to the open document, made from the account's copy; signing in comes first. */
export function ShareDialog({ doc, auth, client, onSync, onClose }: ShareDialogProps) {
  return (
    <Dialog title="Share" titleId="share-title" returnFocusId={SHARE_BUTTON_ID} onClose={onClose}>
      {auth.status === 'signed-in' ? (
        <ShareLink key={`${auth.userId}:${doc.id}`} doc={doc} client={client} onSync={onSync} />
      ) : (
        <div className="share">
          <AuthForm
            client={client}
            intro="Sign in to share. A shared document is read from your account, and the documents on this device are added to it."
          />
        </div>
      )}
    </Dialog>
  )
}

type LinkState = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; linkId: string | null }

interface ShareLinkProps {
  doc: Doc
  client: SupabaseClient
  onSync: () => Promise<boolean>
}

function ShareLink({ doc, client, onSync }: ShareLinkProps) {
  const [state, setState] = useState<LinkState>({ status: 'loading' })
  const [pending, setPending] = useState(false)
  // Read out by screen readers: what the last action did, and whether it worked.
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null)
  // Each state swaps the controls, so focus moves to the one that comes next.
  const focusNext = useRef<string | null>(null)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!focusNext.current) return
    panel.current?.querySelector<HTMLElement>(focusNext.current)?.focus()
    focusNext.current = null
  })
  const [attempt, setAttempt] = useState(0)
  const syncFirst = useEffectEvent(onSync)

  // The document has to be in the account before it can be shared, so this device syncs first.
  const tooLarge = !syncable(doc)

  useEffect(() => {
    if (tooLarge) return
    let current = true
    syncFirst()
      .then((synced) => (synced ? fetchShareId(client, doc.id) : Promise.reject(new Error('not synced'))))
      .then(
        (linkId) => {
          if (!current) return
          focusNext.current = '.share__primary'
          setState({ status: 'ready', linkId })
        },
        () => {
          if (!current) return
          focusNext.current = '.share__primary'
          setState({ status: 'failed' })
        },
      )
    return () => {
      current = false
    }
  }, [client, doc.id, attempt, tooLarge])

  async function update(change: () => Promise<string | null>, done: string) {
    if (pending) return
    setPending(true)
    setMessage(null)
    try {
      const linkId = await change()
      focusNext.current = '.share__primary'
      setState({ status: 'ready', linkId })
      setMessage({ text: done, failed: false })
    } catch {
      setMessage({ text: 'Couldn’t reach your account. Try again.', failed: true })
    } finally {
      setPending(false)
    }
  }

  const create = () =>
    update(async () => {
      const linkId = await shareDocument(client, doc.id)
      if (!linkId) throw new Error('not in the account')
      return linkId
    }, 'Link created. Anyone with it can read this document.')

  const stop = () =>
    update(async () => {
      await unshareDocument(client, doc.id)
      return null
    }, 'Sharing stopped. The old link no longer works.')

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setMessage({ text: 'Link copied.', failed: false })
    } catch {
      // Focused, so the shortcut below copies it at once; focusing also selects it.
      document.querySelector<HTMLInputElement>('#share-url')?.focus()
      setMessage({ text: 'Couldn’t copy. The link is selected: press Ctrl+C, or ⌘C on a Mac.', failed: true })
    }
  }

  function retry() {
    setState({ status: 'loading' })
    setMessage(null)
    setAttempt((count) => count + 1)
  }

  const title = displayTitle(doc)
  let body: ReactNode
  if (tooLarge) {
    body = (
      <p className="dialog__text">
        “{title}” is too large to keep in your account, so it can’t be shared. It stays on this device. Your account
        holds titles up to {LIMITS.title} characters, {LIMITS.tags} tags and about a million characters of text.
      </p>
    )
  } else if (state.status === 'loading') {
    body = <p className="dialog__text">Checking “{title}” in your account…</p>
  } else if (state.status === 'failed') {
    body = (
      <>
        <p className="dialog__text">
          Couldn’t reach your account, so this document can’t be shared yet. Your writing is kept on this device.
        </p>
        <div className="share__actions">
          <button type="button" className="button-primary share__primary" onClick={retry}>
            Try again
          </button>
        </div>
      </>
    )
  } else if (state.linkId === null) {
    body = (
      <>
        <p className="dialog__text">
          Anyone with the link can read “{title}”, signed in or not. They can’t edit it or see your other documents.
        </p>
        <div className="share__actions">
          <button type="button" className="button-primary share__primary" aria-disabled={pending} onClick={() => void create()}>
            {pending ? 'Creating…' : 'Create link'}
          </button>
        </div>
      </>
    )
  } else {
    const url = shareUrl(state.linkId)
    body = (
      <>
        <p className="dialog__text">
          Anyone with this link can read “{title}” as last synced. Stopping breaks the link for everyone who has it;
          sharing again makes a new one.
        </p>
        <div className="share__link">
          <label className="visually-hidden" htmlFor="share-url">
            Share link
          </label>
          <input id="share-url" className="field-input share__primary" readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
          <button type="button" className="button-primary" onClick={() => void copy(url)}>
            Copy link
          </button>
        </div>
        <div className="share__actions">
          <button type="button" className="button-ghost button-ghost--danger" aria-disabled={pending} onClick={() => void stop()}>
            {pending ? 'Stopping…' : 'Stop sharing'}
          </button>
        </div>
      </>
    )
  }

  return (
    <div className="share" ref={panel}>
      {body}
      {/* One live region for the whole dialog, so each outcome is announced. */}
      <p className="share__status" role="status" data-failed={message?.failed || undefined}>
        {message?.text}
      </p>
    </div>
  )
}
