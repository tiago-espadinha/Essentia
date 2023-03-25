import { Dialog, useLocale } from '@essentia/ui'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useState } from 'react'
import { t } from '../locale'
import { BUTTON_ID } from './AccountMenu'
import { PasswordForm } from './PasswordForm'

export function PasswordDialog({ client, userId, onClose }: {
  client: SupabaseClient; userId: string; onClose: () => void
}) {
  useLocale()
  const [pending, setPending] = useState(false)
  return <Dialog title={t('Change password')} titleId="password-title" returnFocusId={BUTTON_ID} onClose={pending ? undefined : onClose}>
    <div className="account__body">
      <PasswordForm client={client} userId={userId} onPending={setPending} />
      <button type="button" className="account__close" disabled={pending} onClick={onClose}>{t('Close')}</button>
    </div>
  </Dialog>
}
