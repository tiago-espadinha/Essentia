import { groupForToday, queryHabits, type Habit, type ListQuery } from './habits'

export type View = 'today' | 'streaks' | 'week' | 'stats'

export const VIEW_LABELS: Record<View, string> = {
  today: 'Today',
  streaks: 'Streaks',
  week: 'Week',
  stats: 'Stats',
}

export interface ListSection {
  id: string
  title: string
  habits: Habit[]
}

/** The titled lists of a list view; Streaks orders by current streak whatever the sort. */
export function sectionsFor(view: 'today' | 'streaks', habits: Habit[], query: ListQuery, today: string): ListSection[] {
  if (view === 'streaks') {
    return [{ id: 'section-streaks', title: 'By streak', habits: queryHabits(habits, { ...query, sort: 'streak' }, today) }]
  }
  const groups = groupForToday(queryHabits(habits, query, today), today)
  return [
    { id: 'section-due', title: 'To do', habits: groups.due },
    { id: 'section-done', title: 'Done today', habits: groups.done },
    { id: 'section-not-due', title: 'Not due today', habits: groups.notDue },
  ]
}
