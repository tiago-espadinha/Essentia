import { formatSigned } from './money'
import { editId, shortDate, type Transaction } from './transactions'

interface TransactionRowProps {
  transaction: Transaction
  onEdit: (t: Transaction) => void
  onDelete: (t: Transaction) => void
}

export function TransactionRow({ transaction: t, onEdit, onDelete }: TransactionRowProps) {
  return (
    <li className="row" data-id={t.id}>
      <div className="row__body">
        <p className="row__description">{t.description}</p>
        <p className="row__meta">
          <span className="label">{shortDate(t.date)}</span>
          <span className="label">{t.category}</span>
        </p>
      </div>
      <p className={`row__amount amount${t.type === 'income' ? ' amount--income' : ''}`}>
        <span className="visually-hidden">{t.type === 'income' ? 'Income' : 'Expense'} </span>
        {formatSigned(t.amount, t.type)}
      </p>
      <div className="row__actions">
        <button id={editId(t)} type="button" className="row__action" onClick={() => onEdit(t)}>
          Edit<span className="visually-hidden"> “{t.description}”</span>
        </button>
        <button type="button" className="row__action" onClick={() => onDelete(t)}>
          Delete<span className="visually-hidden"> “{t.description}”</span>
        </button>
      </div>
    </li>
  )
}
