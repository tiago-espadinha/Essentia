import { useState } from 'react'
import { t } from '../locale'

interface LinkBackNoticeProps {
  title: string
  /** Sharing has stopped from here. */
  stopped: boolean
  /** Stops sharing the note through the account; rejects when it could not. */
  onStop: () => Promise<void>
}

/** Shown when a deleted shared note is put back: its link works again, unless sharing stops here. */
export function LinkBackNotice({ title, stopped, onStop }: LinkBackNoticeProps) {
  const [status, setStatus] = useState<'idle' | 'stopping' | 'failed'>('idle')

  async function stop() {
    if (status === 'stopping') return
    setStatus('stopping')
    try {
      await onStop()
      setStatus('idle')
    } catch {
      setStatus('failed')
    }
  }

  if (stopped) return <p className="link-notice" role="status">{t('Sharing stopped. The old link no longer works.')}</p>
  return (
    <p className="link-notice" role="status" data-failed={status === 'failed' || undefined}>
      {status === 'failed'
        ? t('Couldn’t reach your account. Try again.')
        : t('The share link for “{title}” works again.', { title: title.trim() || t('Untitled') })}{' '}
      <button type="button" className="undo__button" aria-disabled={status === 'stopping'} onClick={() => void stop()}>
        {t(status === 'stopping' ? 'Stopping…' : 'Stop sharing')}
      </button>
    </p>
  )
}
