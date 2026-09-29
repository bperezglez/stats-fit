import { catalogExerciseId } from '@/data/catalog'
import { DEFAULT_ROUTINE } from '@/data/routine'
import type { CatalogExercise } from '@/lib/catalog/catalog-types'
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

export function archivedExercises(day: DayTemplate): ExerciseTemplate[] {
  return day.exercises.filter((e) => e.archived)
}

export function createDefaultRoutineDocument(): UserRoutineDocument {
  return {
    version: 1,
    days: structuredClone(DEFAULT_ROUTINE),
    updatedAt: Date.now(),
  }
}

export function defaultTargetForKind(kind: ExerciseKind): string {
  if (kind === 'cardio') return '20 min'
  if (kind === 'timed') return '3 × 40 s'
  return '3 × 10-12'
}

export function createManualExerciseId(): string {
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `ex_${suffix}`
}

export function createManualExercise(
  partial?: Partial<Omit<ExerciseTemplate, 'id'>>,
): ExerciseTemplate {
  const kind = partial?.kind ?? 'strength'
  return {
    id: createManualExerciseId(),
    name: partial?.name?.trim() || 'Nuevo ejercicio',
    kind,
    target: partial?.target?.trim() || defaultTargetForKind(kind),
    ...(partial?.cue?.trim() ? { cue: partial.cue.trim() } : {}),
    ...(kind === 'timed' ? { durationUnit: partial?.durationUnit ?? 's' } : {}),
  }
}

export function exerciseFromCatalog(item: CatalogExercise): ExerciseTemplate {
  const template: ExerciseTemplate = {
    id: catalogExerciseId(item.id),
    catalogId: item.id,
    catalogThumb: item.thumb,
    catalogGif: item.gif,
    name: item.nameEs,
    kind: item.kind,
    target: defaultTargetForKind(item.kind),
  }
  if (item.stepsEs[0]) template.cue = item.stepsEs[0]
  if (item.kind === 'timed') template.durationUnit = 's'
  return template
}

export function findExerciseIdOwner(days: DayTemplate[], exerciseId: string): DayId | null {
  for (const day of days) {
    if (day.exercises.some((e) => e.id === exerciseId)) return day.id
  }
  return null
}

export function assertUniqueExerciseId(days: DayTemplate[], exerciseId: string, exceptDayId?: DayId) {
  const owner = findExerciseIdOwner(days, exerciseId)
  if (owner && owner !== exceptDayId) {
    throw new Error('Ya existe un ejercicio con ese identificador en tu rutina.')
  }
}

function touch(doc: UserRoutineDocument, days: DayTemplate[]): UserRoutineDocument {
  return { ...doc, days, updatedAt: Date.now() }
}

export function addExerciseToDay(
  doc: UserRoutineDocument,
  dayId: DayId,
  exercise: ExerciseTemplate,
): UserRoutineDocument {
  assertUniqueExerciseId(doc.days, exercise.id)
  const dayIndex = dayIndexOf(doc.days, dayId)
  if (dayIndex < 0) throw new Error('Día no encontrado en la rutina.')
  const days = doc.days.map((day) =>
    day.id === dayId ? { ...day, exercises: [...day.exercises, exercise] } : day,
  )
  return touch(doc, days)
}

export type ExercisePatch = Partial<Pick<ExerciseTemplate, 'name' | 'target' | 'cue' | 'kind' | 'durationUnit'>>

export function updateExerciseInDay(
  doc: UserRoutineDocument,
  dayId: DayId,
  exerciseId: string,
  patch: ExercisePatch,
): UserRoutineDocument {
  const dayIndex = dayIndexOf(doc.days, dayId)
  if (dayIndex < 0) throw new Error('Día no encontrado en la rutina.')

  const days = doc.days.map((day) => {
    if (day.id !== dayId) return day
    const exercises = day.exercises.map((exercise) => {
      if (exercise.id !== exerciseId) return exercise
      const nextKind = patch.kind ?? exercise.kind
      if (patch.kind && !KINDS.has(patch.kind)) throw new Error('Tipo de ejercicio no válido.')
      const name = patch.name !== undefined ? patch.name.trim() : exercise.name
      if (!name) throw new Error('El nombre del ejercicio no puede estar vacío.')
      const target = patch.target !== undefined ? patch.target.trim() : exercise.target
      if (!target) throw new Error('El objetivo no puede estar vacío.')

      const next: ExerciseTemplate = {
        ...exercise,
        name,
        kind: nextKind,
        target,
      }

      if (patch.cue !== undefined) {
        const cue = patch.cue.trim()
        if (cue) next.cue = cue
        else delete next.cue
      }

      if (nextKind === 'timed') {
        next.durationUnit = patch.durationUnit ?? exercise.durationUnit ?? 's'
      } else {
        delete next.durationUnit
      }

      return next
    })

    if (!exercises.some((e) => e.id === exerciseId)) {
      throw new Error('Ejercicio no encontrado en este día.')
    }

    return { ...day, exercises }
  })

  return touch(doc, days)
}

export function setExerciseArchived(
  doc: UserRoutineDocument,
  dayId: DayId,
  exerciseId: string,
  archived: boolean,
): UserRoutineDocument {
  const days = doc.days.map((day) => {
    if (day.id !== dayId) return day
    let found = false
    const exercises = day.exercises.map((exercise) => {
      if (exercise.id !== exerciseId) return exercise
      found = true
      if (archived) return { ...exercise, archived: true }
      const { archived: _removed, ...rest } = exercise
      return rest
    })
    if (!found) throw new Error('Ejercicio no encontrado en este día.')
    return { ...day, exercises }
  })
  return touch(doc, days)
}

export function restoreDefaultRoutineDocument(): UserRoutineDocument {
  return createDefaultRoutineDocument()
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
  if (typeof e.catalogId === 'string' && e.catalogId.trim()) out.catalogId = e.catalogId.trim()
  if (typeof e.catalogThumb === 'string' && e.catalogThumb.trim()) out.catalogThumb = e.catalogThumb.trim()
  if (typeof e.catalogGif === 'string' && e.catalogGif.trim()) out.catalogGif = e.catalogGif.trim()
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

  const exerciseIds = new Set<string>()
  for (const day of days) {
    for (const exercise of day.exercises) {
      if (exerciseIds.has(exercise.id)) {
        throw new Error('La rutina guardada contiene ejercicios duplicados.')
      }
      exerciseIds.add(exercise.id)
    }
  }

  return {
    version: 1,
    days,
    updatedAt: typeof payload.updatedAt === 'number' && Number.isFinite(payload.updatedAt) ? payload.updatedAt : Date.now(),
  }
}

export function routineDayIds(days: DayTemplate[]): Set<DayId> {
  return new Set(days.map((d) => d.id))
}
