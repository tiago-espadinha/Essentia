// What the add and edit forms hold, and how it becomes a draft or field errors.
import type { Habit, HabitDraft, Weekday } from './habits'

export interface HabitForm {
  name: string
  category: string
  everyDay: boolean
  days: Weekday[]
  numeric: boolean
  unit: string
  /** As typed; '' means no target. */
  target: string
}

export type FormErrors = Partial<Record<'name' | 'days' | 'unit' | 'target', string>>

export const EMPTY_FORM: HabitForm = {
  name: '',
  category: '',
  everyDay: true,
  days: [],
  numeric: false,
  unit: '',
  target: '',
}

export function formOf(habit: Habit): HabitForm {
  return {
    name: habit.name,
    category: habit.category,
    everyDay: habit.days.length === 0,
    days: habit.days,
    numeric: habit.unit !== '',
    unit: habit.unit,
    target: habit.target === null ? '' : String(habit.target),
  }
}

export function readForm(form: HabitForm): { draft: HabitDraft; errors?: never } | { errors: FormErrors } {
  const errors: FormErrors = {}
  if (!form.name.trim()) errors.name = 'Name the habit first.'
  if (!form.everyDay && form.days.length === 0) errors.days = 'Pick at least one day.'
  if (form.numeric && !form.unit.trim()) errors.unit = 'Name the unit, like pages or minutes.'
  const target = form.target.trim() === '' ? null : Number(form.target)
  if (form.numeric && target !== null && !(Number.isFinite(target) && target > 0)) {
    errors.target = 'Use a number above zero, or leave it empty.'
  }
  if (Object.keys(errors).length > 0) return { errors }

  return {
    draft: {
      name: form.name,
      category: form.category,
      days: form.everyDay ? [] : form.days,
      unit: form.numeric ? form.unit : '',
      target: form.numeric ? target : null,
    },
  }
}
