import { exerciseStats, type ExerciseStats } from '@/lib/metrics'
import type { ExerciseKind, WorkoutLog } from '@/types'

export interface HistoryPoint extends ExerciseStats {
  weekKey: string
}

/** Weekly stats for one exercise, oldest first, skipping weeks without data. */
export function exerciseHistory(
  logs: Record<string, WorkoutLog>,
  exerciseId: string,
  kind: ExerciseKind,
  upToWeek?: string,
): HistoryPoint[] {
  const points: HistoryPoint[] = []
  for (const log of Object.values(logs)) {
    if (upToWeek && log.weekKey > upToWeek) continue
    const sets = log.exercises[exerciseId]
    if (!sets?.length) continue
    const stats = exerciseStats(sets, kind)
    if (stats.sets === 0) continue
    points.push({ weekKey: log.weekKey, ...stats })
  }
  return points.sort((a, b) => a.weekKey.localeCompare(b.weekKey))
}
