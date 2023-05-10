import { groupForToday, queryHabits, type Habit, type ListQuery } from './habits'

export type View = 'today' | 'week' | 'stats'

export const VIEW_LABELS: Record<View, string> = {
  today: 'Today',
  week: 'Week',
  stats: 'Stats',
}

export interface ListSection {
  id: string
  title: string
  habits: Habit[]
}

/** Today's titled lists: due, done, and not due today. */
export function sectionsFor(habits: Habit[], query: ListQuery, today: string): ListSection[] {
  const groups = groupForToday(queryHabits(habits, query, today), today)
  return [
    { id: 'section-due', title: 'To do', habits: groups.due },
    { id: 'section-done', title: 'Done today', habits: groups.done },
    { id: 'section-not-due', title: 'Not due today', habits: groups.notDue },
  ]
}
