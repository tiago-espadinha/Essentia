import { formatNumber, useLocale } from '@essentia/ui'
import { t } from '../locale'
import { Dialog } from '@essentia/ui'
import { BUTTON_ID } from './AccountMenu'
import '../account.css'

interface ClaimDialogProps {
  count: number
  /** What the app keeps, singular and plural: ['habit', 'habits']. */
  noun: [string, string]
  email: string
  /**
   * What declining does: 'remove' deletes the work from this device; 'keep'
   * leaves it on this device, apart from the account, for when signed out.
   */
  decline?: 'remove' | 'keep'
  onAnswer: (add: boolean) => void
}

/**
 * Asked on sign-in when this device holds work made while signed out. On a
 * shared device it may be someone else's, so it joins the account only when
 * the person signing in says so.
 */
export function ClaimDialog({ count, noun, email, decline = 'remove', onAnswer }: ClaimDialogProps) {
  useLocale()
  const one = count === 1
  const items = `${formatNumber(count)} ${noun[one ? 0 : 1]}`
  const keep = decline === 'keep'
  return (
    <Dialog title={t("Add what’s on this device?")} titleId="claim-title" returnFocusId={BUTTON_ID}>
      <div className="account__body">
        <p className="account__email">
          {t('This device has {items} made while signed out.', { items })}{' '}
          {t(one ? 'Add it to' : 'Add them to')} <strong>{email}</strong>,{' '}
          {keep
            ? t(one ? 'or keep it on this device only.' : 'or keep them on this device only.')
            : t(one ? 'or remove it from this device.' : 'or remove them from this device.')}
        </p>
        <p>{keep ? t('Kept work stays here and comes back when you sign out.') : t("Removing can’t be undone.")}</p>
        <div className="account__actions account__actions--answer">
          <button type="button" className="account__close" onClick={() => onAnswer(false)}>
            {keep ? t('Keep on this device') : t("Remove from device")}
          </button>
          <button type="button" className="account__sign-out" data-autofocus onClick={() => onAnswer(true)}>
            {t("Add to account")}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
