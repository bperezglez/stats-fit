import { DEFAULT_ROUTINE } from '@/data/routine'
import type { DayId, DayTemplate, ExerciseKind, ExerciseTemplate, UserRoutineDocument } from '@/types'

const DAY_IDS = new Set<DayId>(['lunes', 'martes', 'miercoles', 'jueves', 'viernes'])
const KINDS = new Set<ExerciseKind>(['strength', 'timed', 'cardio'])

export function buildDayById(days: DayTemplate[]): Record<DayId, DayTemplate> {
  return Object.fromEntries(days.map((d) => [d.id, d])) as Record<DayId, DayTemplate>
}

export function buildExerciseById(
  days: DayTemplate[],
): Record<string, ExerciseTemplate & { day: DayId }> {
  return Object.fromEntries(days.flatMap((d) => d.exercises.map((e) => [e.id, { ...e, day: d.id }])))
}

export function dayIndexOf(days: DayTemplate[], dayId: DayId): number {
  return days.findIndex((d) => d.id === dayId)
}

export function activeExercises(day: DayTemplate): ExerciseTemplate[] {
  return day.exercises.filter((e) => !e.archived)
}

export function createDefaultRoutineDocument(): UserRoutineDocument {
  return {
    version: 1,
    days: structuredClone(DEFAULT_ROUTINE),
    updatedAt: Date.now(),
  }
}

function parseExercise(raw: unknown): ExerciseTemplate | null {
  if (!raw || typeof raw !== 'object') return null
  const e = raw as Partial<ExerciseTemplate>
  if (typeof e.id !== 'string' || !e.id.trim()) return null
  if (typeof e.name !== 'string' || !e.name.trim()) return null
  if (typeof e.target !== 'string') return null
  if (!e.kind || !KINDS.has(e.kind)) return null
  const out: ExerciseTemplate = {
    id: e.id.trim(),
    name: e.name.trim(),
    kind: e.kind,
    target: e.target,
  }
  if (typeof e.cue === 'string' && e.cue.trim()) out.cue = e.cue.trim()
  if (e.durationUnit === 's' || e.durationUnit === 'min') out.durationUnit = e.durationUnit
  if (e.archived === true) out.archived = true
  return out
}

function parseDay(raw: unknown): DayTemplate | null {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Partial<DayTemplate>
  if (!d.id || !DAY_IDS.has(d.id)) return null
  if (typeof d.short !== 'string' || typeof d.label !== 'string') return null
  if (typeof d.title !== 'string' || typeof d.focus !== 'string') return null
  if (typeof d.accent !== 'string') return null
  if (!Array.isArray(d.exercises)) return null
  const exercises = d.exercises.map(parseExercise).filter((e): e is ExerciseTemplate => e !== null)
  const ids = new Set<string>()
  for (const e of exercises) {
    if (ids.has(e.id)) return null
    ids.add(e.id)
  }
  return { id: d.id, short: d.short, label: d.label, title: d.title, focus: d.focus, accent: d.accent, exercises }
}

/** Validates JSON from Postgres or local storage; throws on corrupt data. */
export function parseRoutineDocument(raw: unknown): UserRoutineDocument {
  const payload = raw as Partial<UserRoutineDocument>
  if (!payload || payload.version !== 1 || !Array.isArray(payload.days)) {
    throw new Error('La rutina guardada tiene un formato no válido.')
  }
  const days = payload.days.map(parseDay).filter((d): d is DayTemplate => d !== null)
  if (days.length !== payload.days.length) {
    throw new Error('La rutina guardada contiene días o ejercicios no válidos.')
  }
  const dayIds = new Set(days.map((d) => d.id))
  if (dayIds.size !== days.length) throw new Error('La rutina guardada tiene días duplicados.')
  return {
    version: 1,
    days,
    updatedAt: typeof payload.updatedAt === 'number' && Number.isFinite(payload.updatedAt) ? payload.updatedAt : Date.now(),
  }
}

export function routineDayIds(days: DayTemplate[]): Set<DayId> {
  return new Set(days.map((d) => d.id))
}
