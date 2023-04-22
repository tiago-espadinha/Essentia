import { Dialog, formatNumber } from '@essentia/ui'
import { AuthForm, type Auth } from '@essentia/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react'
import { t } from '../locale'
import type { Note } from '../domain/notes'
import { shareUrl } from '../domain/share'
import { fetchShareId, shareNote, unshareNote } from '../data/remote'
import { LIMITS, syncable } from '../data/sync'

interface ShareDialogProps {
  note: Note
  auth: Auth
  client: SupabaseClient
  returnFocusId: string
  /** Resolves to whether this device's notes reached the account. */
  onSync: () => Promise<boolean>
  /** Called with whether the note has a link after the account answered. */
  onShared: (on: boolean) => void
  onClose: () => void
}

/** A read-only link to the open note, made from the account's copy; signing in comes first. */
export function ShareDialog({ note, auth, client, returnFocusId, onSync, onShared, onClose }: ShareDialogProps) {
  return (
    <Dialog title={t('Share')} titleId="share-title" returnFocusId={returnFocusId} onClose={onClose}>
      {auth.status === 'signed-in' ? (
        <ShareLink key={`${auth.userId}:${note.id}`} note={note} client={client} onSync={onSync} onShared={onShared} />
      ) : (
        <div className="share">
          <AuthForm client={client} intro={t('Sign in to share. A shared note is read from your account.')} />
        </div>
      )}
    </Dialog>
  )
}

type LinkState = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; linkId: string | null }

interface ShareLinkProps {
  note: Note
  client: SupabaseClient
  onSync: () => Promise<boolean>
  onShared: (on: boolean) => void
}

function ShareLink({ note, client, onSync, onShared }: ShareLinkProps) {
  const [state, setState] = useState<LinkState>({ status: 'loading' })
  const [pending, setPending] = useState(false)
  // Read out by screen readers: what the last action did, and whether it worked.
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null)
  const [attempt, setAttempt] = useState(0)
  // Each state swaps the controls, so focus moves to the one that comes next.
  const focusNext = useRef(false)
  const panel = useRef<HTMLDivElement>(null)
  const urlField = useRef<HTMLInputElement>(null)
  const syncFirst = useEffectEvent(onSync)
  const reportShared = useEffectEvent(onShared)
  // The note has to be in the account before it can be shared, so this device syncs first.
  const tooLarge = !syncable(note)

  useEffect(() => {
    if (!focusNext.current) return
    focusNext.current = false
    panel.current?.querySelector<HTMLElement>('.share__primary')?.focus()
  })

  useEffect(() => {
    if (tooLarge) return
    let current = true
    syncFirst()
      .then((synced) => (synced ? fetchShareId(client, note.id) : Promise.reject(new Error('not synced'))))
      .then(
        (linkId) => {
          if (!current) return
          focusNext.current = true
          setState({ status: 'ready', linkId })
          reportShared(linkId !== null)
        },
        () => {
          if (!current) return
          focusNext.current = true
          setState({ status: 'failed' })
        },
      )
    return () => {
      current = false
    }
  }, [client, note.id, attempt, tooLarge])

  async function update(change: () => Promise<string | null>, done: string) {
    if (pending) return
    setPending(true)
    setMessage(null)
    try {
      const linkId = await change()
      focusNext.current = true
      setState({ status: 'ready', linkId })
      onShared(linkId !== null)
      setMessage({ text: done, failed: false })
    } catch {
      setMessage({ text: 'Couldn’t reach your account. Try again.', failed: true })
    } finally {
      setPending(false)
    }
  }

  const create = () =>
    update(async () => {
      const linkId = await shareNote(client, note.id)
      if (!linkId) throw new Error('not in the account')
      return linkId
    }, 'Link created. Anyone with it can read this note.')

  const stop = () =>
    update(async () => {
      await unshareNote(client, note.id)
      return null
    }, 'Sharing stopped. The old link no longer works.')

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setMessage({ text: 'Link copied.', failed: false })
    } catch {
      // Focusing selects it, so the shortcut below copies it at once.
      urlField.current?.focus()
      setMessage({ text: 'Couldn’t copy. The link is selected: press Ctrl+C, or ⌘C on a Mac.', failed: true })
    }
  }

  function retry() {
    setState({ status: 'loading' })
    setMessage(null)
    setAttempt((count) => count + 1)
  }

  const title = note.title.trim() || t('Untitled')
  let body: ReactNode
  if (tooLarge) {
    body = (
      <p className="dialog__text">
        {t('“{title}” is too large to keep in your account, so it can’t be shared. It stays on this device. Your account holds titles up to {characters} characters, {tags} tags and about a million characters of text.', { title, characters: formatNumber(LIMITS.title), tags: formatNumber(LIMITS.tags) })}
      </p>
    )
  } else if (state.status === 'loading') {
    body = <p className="dialog__text">{t('Checking “{title}” in your account…', { title })}</p>
  } else if (state.status === 'failed') {
    body = (
      <>
        <p className="dialog__text">{t('Couldn’t reach your account, so this note can’t be shared yet. Your writing is kept on this device.')}</p>
        <div className="share__actions">
          <button type="button" className="button-primary share__primary" onClick={retry}>{t('Try again')}</button>
        </div>
      </>
    )
  } else if (state.linkId === null) {
    body = (
      <>
        <p className="dialog__text">
          {t('Anyone with the link can read “{title}”, signed in or not. They can’t edit it or see your other notes.', { title })}
        </p>
        <div className="share__actions">
          <button type="button" className="button-primary share__primary" aria-disabled={pending} onClick={() => void create()}>
            {t(pending ? 'Creating…' : 'Create link')}
          </button>
        </div>
      </>
    )
  } else {
    const url = shareUrl(state.linkId)
    body = (
      <>
        <p className="dialog__text">
          {t('Anyone with this link can read “{title}” as last synced. Stopping breaks the link for everyone who has it; sharing again makes a new one.', { title })}
        </p>
        <div className="share__link">
          <label className="visually-hidden" htmlFor="share-url">{t('Share link')}</label>
          <input ref={urlField} id="share-url" className="field-input share__primary" readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
          <button type="button" className="button-primary" onClick={() => void copy(url)}>{t('Copy link')}</button>
        </div>
        <div className="share__actions">
          <button type="button" className="button-ghost button-ghost--danger" aria-disabled={pending} onClick={() => void stop()}>
            {t(pending ? 'Stopping…' : 'Stop sharing')}
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
        {message && t(message.text)}
      </p>
    </div>
  )
}
