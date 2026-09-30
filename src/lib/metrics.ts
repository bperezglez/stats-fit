import type { ExerciseKind, SetEntry, WorkoutLog } from '@/types'

export function setVolume(s: SetEntry): number {
  return (s.reps ?? 0) * (s.weight ?? 0)
}

export function isFilled(s: SetEntry, kind: ExerciseKind): boolean {
  if (kind === 'strength') return (s.reps ?? 0) > 0
  return (s.duration ?? 0) > 0 || (s.distance ?? 0) > 0
}

export interface ExerciseStats {
  sets: number
  volume: number
  maxWeight: number
  totalReps: number
  totalDuration: number
  maxDuration: number
  totalDistance: number
}

export function exerciseStats(sets: SetEntry[] | undefined, kind: ExerciseKind): ExerciseStats {
  const stats: ExerciseStats = {
    sets: 0,
    volume: 0,
    maxWeight: 0,
    totalReps: 0,
    totalDuration: 0,
    maxDuration: 0,
    totalDistance: 0,
  }
  for (const s of sets ?? []) {
    if (!isFilled(s, kind)) continue
    stats.sets++
    stats.volume += setVolume(s)
    stats.maxWeight = Math.max(stats.maxWeight, s.weight ?? 0)
    stats.totalReps += s.reps ?? 0
    stats.totalDuration += s.duration ?? 0
    stats.maxDuration = Math.max(stats.maxDuration, s.duration ?? 0)
    stats.totalDistance += s.distance ?? 0
  }
  return stats
}

/** Primary headline metric for an exercise kind (used for week-over-week deltas). */
export function headlineValue(stats: ExerciseStats, kind: ExerciseKind): number {
  if (kind === 'strength') return stats.volume
  return stats.totalDuration
}

export function logVolume(log: WorkoutLog | undefined): number {
  if (!log) return 0
  let total = 0
  for (const sets of Object.values(log.exercises)) {
    for (const s of sets) total += setVolume(s)
  }
  return total
}

export function logSetCount(log: WorkoutLog | undefined): number {
  if (!log) return 0
  let count = 0
  for (const sets of Object.values(log.exercises)) {
    for (const s of sets) {
      if ((s.reps ?? 0) > 0 || (s.duration ?? 0) > 0 || (s.distance ?? 0) > 0) count++
    }
  }
  return count
}

function setHasValue(set: SetEntry) {
  return set.reps != null || set.weight != null || set.duration != null || set.distance != null
}

/**
 * Previous-session rows to show when this week has not logged the exercise yet.
 * They are a guide only: callers must not treat them as this week's workout.
 */
export function sessionGuide(current: SetEntry[] | undefined, previous: SetEntry[] | undefined): SetEntry[] | null {
  if (current && current.length > 0) return null
  if (!previous?.some(setHasValue)) return null
  return previous
}

export function percentDelta(current: number, previous: number): number | null {
  if (!previous || !current) return null
  return ((current - previous) / previous) * 100
}

const numberFmt = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })
const compactFmt = new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 })

export function fmt(n: number): string {
  return numberFmt.format(n)
}

export function fmtCompact(n: number): string {
  return n >= 10_000 ? compactFmt.format(n) : numberFmt.format(n)
}
