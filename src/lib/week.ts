import type { DayId } from '@/types'

const DAY_MS = 86_400_000

/** Monday 00:00 (local) of the ISO week that contains `date`. */
export function startOfIsoWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const offset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - offset)
  return d
}

/** ISO-8601 week key, e.g. "2026-W40". Lexicographically sortable. */
export function weekKeyOf(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Monday of an ISO week key. */
export function weekStartOf(weekKey: string): Date {
  const [yearStr, weekStr] = weekKey.split('-W')
  const year = Number(yearStr)
  const week = Number(weekStr)
  const jan4 = new Date(year, 0, 4)
  const monday = startOfIsoWeek(jan4)
  monday.setDate(monday.getDate() + (week - 1) * 7)
  return monday
}

export function shiftWeek(weekKey: string, delta: number): string {
  const d = weekStartOf(weekKey)
  d.setDate(d.getDate() + delta * 7)
  return weekKeyOf(d)
}

export function weekNumber(weekKey: string): number {
  return Number(weekKey.split('-W')[1])
}

const rangeFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' })

export function weekRangeLabel(weekKey: string): string {
  const start = weekStartOf(weekKey)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return `${rangeFmt.format(start)} – ${rangeFmt.format(end)}`
}

export function currentWeekKey(): string {
  return weekKeyOf(new Date())
}

const WEEKDAYS: (DayId | null)[] = [null, 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', null]

export function todayDayId(): DayId | null {
  return WEEKDAYS[new Date().getDay()]
}

export function dateOfDay(weekKey: string, dayIndex: number): Date {
  const d = weekStartOf(weekKey)
  d.setDate(d.getDate() + dayIndex)
  return d
}
