export type DayId = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes'

/**
 * strength: reps × kg (volume = reps · kg)
 * timed:    isometric/mobility work, measured in seconds or minutes (+ optional kg)
 * cardio:   minutes + optional distance in km
 */
export type ExerciseKind = 'strength' | 'timed' | 'cardio'

export interface ExerciseTemplate {
  id: string
  /** Dataset id when added from the global catalog, e.g. "0043". */
  catalogId?: string
  /** Paths under `public/` when sourced from the catalog. */
  catalogThumb?: string
  catalogGif?: string
  name: string
  kind: ExerciseKind
  target: string
  cue?: string
  durationUnit?: 's' | 'min'
  /** Hidden from the session UI but kept for history. */
  archived?: boolean
}

/** Persisted per user in `user_routines.routine`. */
export interface UserRoutineDocument {
  version: 1
  days: DayTemplate[]
  updatedAt: number
}

export interface DayTemplate {
  id: DayId
  short: string
  label: string
  title: string
  focus: string
  accent: string
  /** When false, the day stays in the routine but is hidden from the session. Defaults to true. */
  enabled?: boolean
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
