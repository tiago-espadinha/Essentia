// Badges are read from the habits as they are now, so they carry no date, and
// deleting a habit can take a badge away with it.
import { streaks, type Habit } from './habits'
import { dayTally, withStarts } from './stats'

export type BadgeIcon = 'leaf' | 'check' | 'flame' | 'sun'

export interface Badge {
  id: string
  name: string
  description: string
  icon: BadgeIcon
  earned: boolean
}

interface Facts {
  habits: number
  checkIns: number
  longestStreak: number
  perfectDay: boolean
}

const BADGES: (Omit<Badge, 'earned'> & { earned: (facts: Facts) => boolean })[] = [
  { id: 'first-habit', name: 'First step', description: 'Create your first habit', icon: 'leaf', earned: (f) => f.habits >= 1 },
  { id: 'five-habits', name: 'Ambitious', description: 'Track five habits at once', icon: 'leaf', earned: (f) => f.habits >= 5 },
  { id: 'first-check-in', name: 'Getting started', description: 'Check in for the first time', icon: 'check', earned: (f) => f.checkIns >= 1 },
  { id: '10-check-ins', name: 'Building momentum', description: 'Check in 10 times', icon: 'check', earned: (f) => f.checkIns >= 10 },
  { id: '50-check-ins', name: 'Dedicated', description: 'Check in 50 times', icon: 'check', earned: (f) => f.checkIns >= 50 },
  { id: '100-check-ins', name: 'Century', description: 'Check in 100 times', icon: 'check', earned: (f) => f.checkIns >= 100 },
  { id: '3-day-streak', name: 'Three in a row', description: 'Reach a 3-day streak', icon: 'flame', earned: (f) => f.longestStreak >= 3 },
  { id: '7-day-streak', name: 'Week warrior', description: 'Reach a 7-day streak', icon: 'flame', earned: (f) => f.longestStreak >= 7 },
  { id: '30-day-streak', name: 'Monthly master', description: 'Reach a 30-day streak', icon: 'flame', earned: (f) => f.longestStreak >= 30 },
  { id: 'perfect-day', name: 'Perfect day', description: 'Do every habit due on one day', icon: 'sun', earned: (f) => f.perfectDay },
]

/** A day with something due and all of it done, today included once it is complete. */
function hasPerfectDay(habits: Habit[], today: string): boolean {
  const started = withStarts(habits)
  // A perfect day has a check-in, so only logged days need a look. No day is
  // passed as the open one, so a habit still open today counts as due.
  const logged = new Set(habits.flatMap((habit) => Object.keys(habit.log)))
  return [...logged].some((day) => {
    if (day > today) return false
    const { done, due } = dayTally(started, day, '')
    return due > 0 && done === due
  })
}

export function badges(habits: Habit[], today: string): Badge[] {
  const facts: Facts = {
    habits: habits.length,
    checkIns: habits.reduce((sum, habit) => sum + Object.keys(habit.log).length, 0),
    longestStreak: Math.max(0, ...habits.map((habit) => streaks(habit, today).longest)),
    perfectDay: hasPerfectDay(habits, today),
  }
  return BADGES.map(({ earned, ...badge }) => ({ ...badge, earned: earned(facts) }))
}
