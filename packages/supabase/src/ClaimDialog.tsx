import { Dialog } from '@essentia/ui'
import { BUTTON_ID } from './AccountMenu'
import './account.css'

interface ClaimDialogProps {
  count: number
  /** What the app keeps, singular and plural: ['habit', 'habits']. */
  noun: [string, string]
  email: string
  onAnswer: (add: boolean) => void
}

/**
 * Asked on sign-in when this device holds work made while signed out. On a
 * shared device it may be someone else's, so it joins the account only when
 * the person signing in says so.
 */
export function ClaimDialog({ count, noun, email, onAnswer }: ClaimDialogProps) {
  const items = `${count} ${noun[count === 1 ? 0 : 1]}`
  return (
    <Dialog title="Add what’s on this device?" titleId="claim-title" returnFocusId={BUTTON_ID}>
      <div className="account__body">
        <p className="account__email">
          This device has {items} made while signed out. Add {count === 1 ? 'it' : 'them'} to <strong>{email}</strong>, or
          remove {count === 1 ? 'it' : 'them'} from this device.
        </p>
        <p>Removing can’t be undone.</p>
        <div className="account__actions account__actions--answer">
          <button type="button" className="account__close" onClick={() => onAnswer(false)}>
            Remove from device
          </button>
          <button type="button" className="account__sign-out" data-autofocus onClick={() => onAnswer(true)}>
            Add to account
          </button>
        </div>
      </div>
    </Dialog>
  )
}
