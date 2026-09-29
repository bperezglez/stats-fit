import { useSyncExternalStore } from 'react'
import { createRepository, type WorkoutRepository } from '@/lib/storage'
import { ROUTINE } from '@/data/routine'
import type { DayId, ExportPayload, SetEntry, WorkoutLog } from '@/types'

type Status = 'loading' | 'ready' | 'error'

export interface StoreState {
  status: Status
  error: string | null
  backend: string | null
  logs: Record<string, WorkoutLog>
}

const initialState: StoreState = { status: 'loading', error: null, backend: null, logs: {} }
let state: StoreState = initialState
let repo: WorkoutRepository | null = null
let activeUserId: string | null = null
const listeners = new Set<() => void>()
const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>()
const WRITE_DEBOUNCE_MS = 250

function setState(patch: Partial<StoreState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useWorkoutStore<T>(selector: (s: StoreState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state))
}

export const logId = (weekKey: string, day: DayId) => `${weekKey}:${day}`

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

export function emptySet(): SetEntry {
  return { id: uid(), reps: null, weight: null, duration: null, distance: null }
}

function hasData(log: WorkoutLog) {
  return Object.values(log.exercises).some((sets) => sets.length > 0)
}

function schedulePersist(id: string) {
  const existing = pendingWrites.get(id)
  if (existing) clearTimeout(existing)
  pendingWrites.set(
    id,
    setTimeout(() => persistNow(id), WRITE_DEBOUNCE_MS),
  )
}

function persistNow(id: string): Promise<void> {
  pendingWrites.delete(id)
  if (!repo) return Promise.resolve()
  const log = state.logs[id]
  const op = log ? repo.put(log) : repo.remove(id)
  return op.catch((err) => {
    console.error(err)
    setState({ error: 'No se pudo guardar. Exporta tus datos por seguridad.' })
  })
}

export function flushPendingWrites(): Promise<void> {
  const ops: Promise<void>[] = []
  for (const [id, t] of pendingWrites) {
    clearTimeout(t)
    ops.push(persistNow(id))
  }
  return Promise.all(ops).then(() => undefined)
}

function writeLog(id: string, log: WorkoutLog | null) {
  const logs = { ...state.logs }
  if (log && hasData(log)) logs[id] = log
  else delete logs[id]
  setState({ logs })
  schedulePersist(id)
}

function mutateExercise(
  weekKey: string,
  day: DayId,
  exerciseId: string,
  fn: (sets: SetEntry[]) => SetEntry[],
) {
  const id = logId(weekKey, day)
  const current = state.logs[id] ?? { id, weekKey, day, exercises: {}, updatedAt: 0 }
  const nextSets = fn(current.exercises[exerciseId] ?? [])
  const exercises = { ...current.exercises }
  if (nextSets.length) exercises[exerciseId] = nextSets
  else delete exercises[exerciseId]
  writeLog(id, { ...current, exercises, updatedAt: Date.now() })
}

let initPromise: Promise<void> | null = null

async function loadFromRepository(userId: string) {
  try {
    const next = await createRepository(userId)
    const all = await next.getAll()
    if (activeUserId !== userId) return
    repo = next
    setState({
      status: 'ready',
      backend: next.name,
      logs: Object.fromEntries(all.map((l) => [l.id, l])),
    })
  } catch (err) {
    console.error(err)
    if (activeUserId !== userId) return
    setState({ status: 'error', error: 'No se pudo cargar tu historial.' })
  }
}

export const actions = {
  /** Idempotent per user, because StrictMode mounts twice. */
  init(userId: string) {
    if (activeUserId === userId && initPromise) return initPromise
    if (activeUserId) void actions.reset()
    activeUserId = userId
    initPromise = loadFromRepository(userId)
    return initPromise
  },

  retry() {
    if (!activeUserId) return
    const userId = activeUserId
    activeUserId = null
    initPromise = null
    setState(initialState)
    return actions.init(userId)
  },

  /** Persists anything pending for the current user, then forgets their data. */
  async reset() {
    const flushing = flushPendingWrites()
    repo = null
    activeUserId = null
    initPromise = null
    setState(initialState)
    await flushing
  },

  dismissError() {
    setState({ error: null })
  },

  addSet(weekKey: string, day: DayId, exerciseId: string, seed?: Partial<SetEntry>) {
    mutateExercise(weekKey, day, exerciseId, (sets) => {
      const last = sets[sets.length - 1]
      const base = last ?? seed
      return [
        ...sets,
        {
          ...emptySet(),
          reps: base?.reps ?? null,
          weight: base?.weight ?? null,
          duration: base?.duration ?? null,
          distance: base?.distance ?? null,
        },
      ]
    })
  },

  updateSet(weekKey: string, day: DayId, exerciseId: string, setId: string, patch: Partial<SetEntry>) {
    mutateExercise(weekKey, day, exerciseId, (sets) =>
      sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
    )
  },

  removeSet(weekKey: string, day: DayId, exerciseId: string, setId: string) {
    mutateExercise(weekKey, day, exerciseId, (sets) => sets.filter((s) => s.id !== setId))
  },

  replaceSets(weekKey: string, day: DayId, exerciseId: string, sets: SetEntry[]) {
    mutateExercise(weekKey, day, exerciseId, () => sets.map((s) => ({ ...s, id: uid() })))
  },

  /** Copies the most recent earlier session of this weekday into `weekKey`. */
  copyPreviousDay(weekKey: string, day: DayId): string | null {
    const source = findPreviousLog(state.logs, weekKey, day)
    if (!source) return null
    const id = logId(weekKey, day)
    writeLog(id, cloneLog(source, weekKey))
    return source.weekKey
  },

  /** Copies every weekday from the most recent earlier week that has data. */
  copyPreviousWeek(weekKey: string): { fromWeek: string; days: number } | null {
    const previousWeeks = [...new Set(Object.values(state.logs).map((l) => l.weekKey))]
      .filter((w) => w < weekKey)
      .sort()
    const fromWeek = previousWeeks.at(-1)
    if (!fromWeek) return null
    let days = 0
    for (const d of ROUTINE) {
      const src = state.logs[logId(fromWeek, d.id)]
      if (!src) continue
      writeLog(logId(weekKey, d.id), cloneLog(src, weekKey))
      days++
    }
    return { fromWeek, days }
  },

  clearDay(weekKey: string, day: DayId) {
    writeLog(logId(weekKey, day), null)
  },

  exportPayload(): ExportPayload {
    return {
      app: 'fittrack',
      version: 1,
      exportedAt: new Date().toISOString(),
      logs: Object.values(state.logs).sort((a, b) => a.id.localeCompare(b.id)),
    }
  },

  async importPayload(raw: unknown, mode: 'merge' | 'replace'): Promise<number> {
    const logs = parseImport(raw)
    if (!repo) throw new Error('Almacenamiento no inicializado')
    await flushPendingWrites()
    if (mode === 'replace') await repo.clear()
    await repo.bulkPut(logs)
    const base = mode === 'replace' ? {} : state.logs
    setState({ logs: { ...base, ...Object.fromEntries(logs.map((l) => [l.id, l])) } })
    return logs.length
  },

  async clearAll() {
    if (!repo) return
    pendingWrites.forEach(clearTimeout)
    pendingWrites.clear()
    await repo.clear()
    setState({ logs: {} })
  },
}

export function findPreviousLog(
  logs: Record<string, WorkoutLog>,
  weekKey: string,
  day: DayId,
): WorkoutLog | undefined {
  let best: WorkoutLog | undefined
  for (const log of Object.values(logs)) {
    if (log.day !== day || log.weekKey >= weekKey) continue
    if (!best || log.weekKey > best.weekKey) best = log
  }
  return best
}

function cloneLog(source: WorkoutLog, weekKey: string): WorkoutLog {
  const exercises: Record<string, SetEntry[]> = {}
  for (const [exId, sets] of Object.entries(source.exercises)) {
    exercises[exId] = sets.map((s) => ({ ...s, id: uid() }))
  }
  return { id: logId(weekKey, source.day), weekKey, day: source.day, exercises, updatedAt: Date.now() }
}

const DAY_IDS = new Set(ROUTINE.map((d) => d.id))
const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function parseImport(raw: unknown): WorkoutLog[] {
  const payload = raw as Partial<ExportPayload>
  if (!payload || payload.app !== 'fittrack' || !Array.isArray(payload.logs)) {
    throw new Error('El archivo no es una copia de seguridad de FitTrack.')
  }
  return payload.logs.map((l) => {
    if (typeof l.weekKey !== 'string' || !/^\d{4}-W\d{2}$/.test(l.weekKey) || !DAY_IDS.has(l.day)) {
      throw new Error('El archivo contiene sesiones con un formato no válido.')
    }
    const exercises: Record<string, SetEntry[]> = {}
    for (const [exId, sets] of Object.entries(l.exercises ?? {})) {
      if (!Array.isArray(sets)) continue
      exercises[exId] = sets.map((s) => ({
        id: typeof s.id === 'string' ? s.id : uid(),
        reps: numOrNull(s.reps),
        weight: numOrNull(s.weight),
        duration: numOrNull(s.duration),
        distance: numOrNull(s.distance),
      }))
    }
    return {
      id: logId(l.weekKey, l.day),
      weekKey: l.weekKey,
      day: l.day,
      exercises,
      updatedAt: typeof l.updatedAt === 'number' ? l.updatedAt : Date.now(),
    }
  })
}
