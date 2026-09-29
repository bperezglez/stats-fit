import { useSyncExternalStore } from 'react'
import {
  createRepository,
  isSyncedRepository,
  type SyncState,
  type SyncedRepository,
  type WorkoutRepository,
} from '@/lib/storage'
import { ROUTINE } from '@/data/routine'
import type { DayId, ExportPayload, SetEntry, WorkoutLog } from '@/types'

type Status = 'loading' | 'ready' | 'error'

export interface StoreState {
  status: Status
  error: string | null
  backend: string | null
  logs: Record<string, WorkoutLog>
  /** Only set when the backend is a remote database behind the offline cache. */
  sync: SyncState | null
}

const initialState: StoreState = { status: 'loading', error: null, backend: null, logs: {}, sync: null }
let state: StoreState = initialState
let repo: WorkoutRepository | null = null
let unsubscribeRepo: (() => void) | null = null
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
let purgeOnReset = false

const byId = (logs: WorkoutLog[]) => Object.fromEntries(logs.map((l) => [l.id, l]))

/** Server data wins, except for logs with an edit still waiting in the debounce. */
function applyRemoteLogs(logs: WorkoutLog[]) {
  const next = byId(logs)
  for (const id of pendingWrites.keys()) {
    if (state.logs[id]) next[id] = state.logs[id]
    else delete next[id]
  }
  setState({ logs: next })
}

function connect(next: SyncedRepository) {
  const offState = next.onSyncStateChange((sync) => setState({ sync }))
  const offRemote = next.onRemoteChange(applyRemoteLogs)
  unsubscribeRepo = () => {
    offState()
    offRemote()
  }
}

async function loadFromRepository(userId: string) {
  let next: WorkoutRepository | null = null
  try {
    next = await createRepository(userId)
    // A device that never downloaded this account waits for the server once;
    // afterwards the local copy is shown immediately and refreshed in the background.
    const firstTime = isSyncedRepository(next) && next.getSyncState().lastSyncedAt === null
    if (firstTime && isSyncedRepository(next)) {
      const synced = await next.sync()
      if (synced.status === 'error') throw new Error('Primera sincronización rechazada')
    }
    const all = await next.getAll()
    if (activeUserId !== userId) {
      if (isSyncedRepository(next)) await next.dispose()
      return
    }
    repo = next
    if (isSyncedRepository(next)) connect(next)
    setState({
      status: 'ready',
      backend: next.name,
      logs: byId(all),
      sync: isSyncedRepository(next) ? next.getSyncState() : null,
    })
    if (!firstTime && isSyncedRepository(next)) void next.sync()
  } catch (err) {
    console.error(err)
    if (next && isSyncedRepository(next)) await next.dispose()
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

  /**
   * Persists anything pending for the current user, then forgets their data.
   * The offline copy is deleted only if `prepareSignOut` confirmed it was fully uploaded.
   */
  async reset() {
    const flushing = flushPendingWrites()
    const previous = repo
    const purgeIfSynced = purgeOnReset
    purgeOnReset = false
    unsubscribeRepo?.()
    unsubscribeRepo = null
    repo = null
    activeUserId = null
    initPromise = null
    setState(initialState)
    await flushing
    if (previous && isSyncedRepository(previous)) await previous.dispose({ purgeIfSynced })
  },

  syncNow(): Promise<SyncState | null> {
    return repo && isSyncedRepository(repo) ? repo.sync() : Promise.resolve(null)
  },

  /**
   * Call before signing out, while the session can still write: uploads what it
   * can and returns how many changes stay queued on this device.
   */
  async prepareSignOut(): Promise<number> {
    await flushPendingWrites()
    if (!repo || !isSyncedRepository(repo)) return 0
    const { pending } = await repo.sync()
    purgeOnReset = pending === 0
    return pending
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
