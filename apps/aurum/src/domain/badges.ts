// Finance badges, read from the records as they are now. Nothing is stored, so
// a badge is never awarded twice, imported history counts at once, and deleting
// the records a badge rests on takes it away. No rule is earned by spending more.
import type { Budget } from './budgets'
import { addMonths } from './insights'
import type { RecurringItem } from './recurring'
import { monthOf, type Transaction } from './transactions'

export type BadgeIcon = 'entry' | 'run' | 'plan' | 'black'

export interface Badge {
  id: string
  name: string
  description: string
  icon: BadgeIcon
  earned: boolean
  /** How far along a counted badge is, in transactions or months; absent for a yes-or-no one. */
  progress?: { value: number; goal: number; unit: 'transactions' | 'months' }
}

export interface BadgeData {
  transactions: Transaction[]
  budgets: Budget[]
  recurring: RecurringItem[]
}

interface Facts {
  entries: number
  longestRun: number
  budgets: number
  recurring: number
  inTheBlack: boolean
}

type Counted = { goal: number; unit: 'transactions' | 'months'; value: (facts: Facts) => number }
type Rule = Omit<Badge, 'earned' | 'progress'> & (Counted | { earned: (facts: Facts) => boolean })

const RULES: Rule[] = [
  { id: 'first-entry', name: 'First entry', description: 'Record your first transaction', icon: 'entry', earned: (f) => f.entries >= 1 },
  { id: '50-entries', name: 'Keeping count', description: 'Record 50 transactions', icon: 'entry', goal: 50, unit: 'transactions', value: (f) => f.entries },
  { id: '250-entries', name: 'Ledger keeper', description: 'Record 250 transactions', icon: 'entry', goal: 250, unit: 'transactions', value: (f) => f.entries },
  { id: '3-month-run', name: 'Three months running', description: 'Record something in 3 months in a row', icon: 'run', goal: 3, unit: 'months', value: (f) => f.longestRun },
  { id: '12-month-run', name: 'A year on the books', description: 'Record something in 12 months in a row', icon: 'run', goal: 12, unit: 'months', value: (f) => f.longestRun },
  { id: 'first-budget', name: 'First budget', description: 'Set a monthly budget', icon: 'plan', earned: (f) => f.budgets >= 1 },
  { id: 'first-recurring', name: 'On autopilot', description: 'Add a recurring item', icon: 'plan', earned: (f) => f.recurring >= 1 },
  { id: 'in-the-black', name: 'In the black', description: 'End a month with more coming in than going out', icon: 'black', earned: (f) => f.inTheBlack },
]

/** The most months in a row with a transaction, up to and including `current`. */
function longestRun(months: Set<string>, current: string): number {
  let longest = 0
  for (const month of months) {
    // Count only from the start of a run, so each run is walked once.
    if (month > current || months.has(addMonths(month, -1))) continue
    let length = 1
    for (let next = addMonths(month, 1); next <= current && months.has(next); next = addMonths(next, 1)) length += 1
    longest = Math.max(longest, length)
  }
  return longest
}

/** A month before `current` whose income came to more than its expenses. */
function hasMonthInTheBlack(transactions: Transaction[], current: string): boolean {
  const balance = new Map<string, number>()
  for (const t of transactions) {
    const month = monthOf(t.date)
    if (month < current) balance.set(month, (balance.get(month) ?? 0) + (t.type === 'income' ? t.amount : -t.amount))
  }
  return [...balance.values()].some((net) => net > 0)
}

export function badges({ transactions, budgets, recurring }: BadgeData, today: string): Badge[] {
  const current = monthOf(today)
  const facts: Facts = {
    entries: transactions.length,
    longestRun: longestRun(new Set(transactions.map((t) => monthOf(t.date))), current),
    budgets: budgets.length,
    recurring: recurring.length,
    inTheBlack: hasMonthInTheBlack(transactions, current),
  }
  return RULES.map((rule) => {
    const { id, name, description, icon } = rule
    if ('earned' in rule) return { id, name, description, icon, earned: rule.earned(facts) }
    const value = Math.min(rule.value(facts), rule.goal)
    return { id, name, description, icon, earned: value >= rule.goal, progress: { value, goal: rule.goal, unit: rule.unit } }
  })
}
