export type DayId = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes'

/**
 * strength: reps × kg (volume = reps · kg)
 * timed:    isometric/mobility work, measured in seconds or minutes (+ optional kg)
 * cardio:   minutes + optional distance in km
 */
export type ExerciseKind = 'strength' | 'timed' | 'cardio'

export interface ExerciseTemplate {
  id: string
  name: string
  kind: ExerciseKind
  target: string
  cue?: string
  durationUnit?: 's' | 'min'
}

export interface DayTemplate {
  id: DayId
  short: string
  label: string
  title: string
  focus: string
  accent: string
  exercises: ExerciseTemplate[]
}

export interface SetEntry {
  id: string
  reps: number | null
  weight: number | null
  duration: number | null
  distance: number | null
}

/** One logged session: a single weekday inside a single ISO week. */
export interface WorkoutLog {
  id: string
  weekKey: string
  day: DayId
  exercises: Record<string, SetEntry[]>
  updatedAt: number
}

export interface ExportPayload {
  app: 'fittrack'
  version: 1
  exportedAt: string
  logs: WorkoutLog[]
}
