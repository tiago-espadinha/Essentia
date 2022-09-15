import { useState } from 'react'
import { applyDraft, createHabit, logValue, toggleDay, type Habit, type HabitDraft } from './habits'
import { loadHabits, saveHabits } from './storage'

/** The habit list, saved to this device on every change. */
export function useHabits() {
  const [habits, setHabits] = useState<Habit[]>(loadHabits)
  const [saveFailed, setSaveFailed] = useState(false)

  function commit(next: Habit[]) {
    setHabits(next)
    setSaveFailed(!saveHabits(next))
  }

  const change = (id: string, edit: (habit: Habit) => Habit) =>
    commit(habits.map((habit) => (habit.id === id ? edit(habit) : habit)))

  return {
    habits,
    saveFailed,
    /** Returns false when the draft has no name. */
    add: (draft: HabitDraft) => {
      const habit = createHabit(draft)
      if (habit) commit([habit, ...habits])
      return habit !== null
    },
    update: (id: string, draft: HabitDraft) => change(id, (habit) => applyDraft(habit, draft) ?? habit),
    toggle: (id: string, day: string) => change(id, (habit) => toggleDay(habit, day)),
    log: (id: string, day: string, value: number) => change(id, (habit) => logValue(habit, day, value)),
    remove: (id: string) => commit(habits.filter((habit) => habit.id !== id)),
    /** Puts a deleted habit back before the habit that followed it, or at the end. */
    restore: (habit: Habit, beforeId: string | null) => {
      const index = habits.findIndex((candidate) => candidate.id === beforeId)
      commit(habits.toSpliced(index === -1 ? habits.length : index, 0, habit))
    },
  }
}
