import { t } from '../locale'
import { formatSigned } from '../domain/money'
import { editId, shortDate, type Transaction } from '../domain/transactions'

interface TransactionRowProps {
  transaction: Transaction
  onEdit: (t: Transaction) => void
  onDelete: (t: Transaction) => void
}

export function TransactionRow({ transaction: item, onEdit, onDelete }: TransactionRowProps) {
  return (
    <li className="row" data-id={item.id} data-motion-item={item.id}>
      <div className="row__body">
        <p className="row__description">{item.description}</p>
        <p className="row__meta">
          <span className="label">{shortDate(item.date)}</span>
          <span className="label">{item.category}</span>
        </p>
      </div>
      <p className={`row__amount amount${item.type === 'income' ? ' amount--income' : ''}`}>
        <span className="visually-hidden">{t(item.type === 'income' ? 'Income' : 'Expense')} </span>
        {formatSigned(item.amount, item.type)}
      </p>
      <div className="row__actions">
        <button id={editId(item)} type="button" className="row__action" onClick={() => onEdit(item)}>
          {t("Edit")}<span className="visually-hidden"> “{item.description}”</span>
        </button>
        <button type="button" className="row__action" onClick={() => onDelete(item)}>
          {t("Delete")}<span className="visually-hidden"> “{item.description}”</span>
        </button>
      </div>
    </li>
  )
}
