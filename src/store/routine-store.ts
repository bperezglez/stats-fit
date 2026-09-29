import { useSyncExternalStore } from 'react'
import { DEFAULT_ROUTINE } from '@/data/routine'
import {
  addExerciseToDay,
  buildDayById,
  buildExerciseById,
  createDefaultRoutineDocument,
  exerciseHasLoggedSets,
  removeOrArchiveExercise,
  reorderExercises,
  restoreDefaultRoutineDocument,
  setDayEnabled,
  setExerciseArchived,
  updateDayMeta,
  updateExerciseInDay,
  type DayMetaPatch,
  type ExercisePatch,
  type ExerciseRemovalResult,
} from '@/lib/routine'
import type { SyncState } from '@/lib/storage'
import { createRoutineRepository, isSyncedRoutineRepository, type SyncedRoutineRepository } from '@/lib/storage/routine-index'
import { getWorkoutLogs } from '@/store/workout-store'
import type { DayId, DayTemplate, ExerciseTemplate, UserRoutineDocument } from '@/types'

type Status = 'loading' | 'ready' | 'error'

type RoutineRepo = Awaited<ReturnType<typeof createRoutineRepository>>

export interface RoutineState {
  status: Status
  error: string | null
  /** Set when another device saved a newer routine and this one was replaced. */
  notice: string | null
  days: DayTemplate[]
  dayById: Record<DayId, DayTemplate>
  exerciseById: Record<string, ExerciseTemplate & { day: DayId }>
  updatedAt: number
  sync: SyncState | null
}

const applyDoc = (doc: UserRoutineDocument) => ({
  days: doc.days,
  dayById: buildDayById(doc.days),
  exerciseById: buildExerciseById(doc.days),
  updatedAt: doc.updatedAt,
})

const fallback = applyDoc({ version: 1, days: DEFAULT_ROUTINE, updatedAt: 0 })

const initialState = (): RoutineState => ({
  status: 'loading',
  error: null,
  notice: null,
  sync: null,
  ...fallback,
})

let state: RoutineState = initialState()
let activeUserId: string | null = null
let initPromise: Promise<void> | null = null
let repo: RoutineRepo | null = null
let unsubscribeRepo: (() => void) | null = null
let pendingWrite: ReturnType<typeof setTimeout> | null = null
let purgeOnReset = false
let acceptRemoteNotice = false
const listeners = new Set<() => void>()
const WRITE_DEBOUNCE_MS = 250

const REMOTE_NOTICE = 'Tu rutina cambió en otro dispositivo.'
const REMOTE_REPLACED_NOTICE =
  'Tu rutina cambió en otro dispositivo. Se ha cargado esa versión y se han descartado cambios locales que aún no se habían subido.'

function setState(patch: Partial<RoutineState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useRoutineStore<T>(selector: (s: RoutineState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state))
}

const cacheKey = (userId: string) => `fittrack:routine-cache:${userId}`

function readCache(userId: string): UserRoutineDocument | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as UserRoutineDocument
    return parsed?.version === 1 && Array.isArray(parsed.days) ? parsed : null
  } catch {
    return null
  }
}

function writeCache(userId: string, doc: UserRoutineDocument) {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(doc))
  } catch {
    /* quota or private mode */
  }
}

function clearCache(userId: string) {
  localStorage.removeItem(cacheKey(userId))
}

function currentDocument(): UserRoutineDocument {
  return {
    version: 1,
    days: state.days,
    updatedAt: state.updatedAt > 0 ? state.updatedAt : Date.now(),
  }
}

async function persistNow(): Promise<void> {
  pendingWrite = null
  if (!repo || !activeUserId) return Promise.resolve()

  const doc = currentDocument()
  writeCache(activeUserId, doc)

  try {
    await repo.put(doc)
  } catch (err) {
    console.error(err)
    setState({ error: 'No se pudo guardar tu rutina. Los cambios están en este dispositivo.' })
  }
}

function schedulePersist() {
  if (pendingWrite) clearTimeout(pendingWrite)
  pendingWrite = setTimeout(() => {
    void persistNow()
  }, WRITE_DEBOUNCE_MS)
}

export function flushRoutineWrites(): Promise<void> {
  if (pendingWrite) {
    clearTimeout(pendingWrite)
    pendingWrite = null
    return persistNow()
  }
  return Promise.resolve()
}

function applyMutation(mutator: (doc: UserRoutineDocument) => UserRoutineDocument) {
  const next = mutator(currentDocument())
  setState({ ...applyDoc(next), error: null })
  schedulePersist()
}

function connectRepo(next: SyncedRoutineRepository, userId: string) {
  const offState = next.onSyncStateChange((sync) => {
    if (activeUserId === userId) setState({ sync })
  })
  const offRemote = next.onRemoteChange((doc, info) => {
    if (activeUserId !== userId) return
    writeCache(userId, doc)
    setState({
      ...applyDoc(doc),
      error: null,
      notice: acceptRemoteNotice ? (info.replacedPending ? REMOTE_REPLACED_NOTICE : REMOTE_NOTICE) : state.notice,
    })
  })
  unsubscribeRepo = () => {
    offState()
    offRemote()
  }
}

async function loadRoutine(userId: string) {
  const cached = readCache(userId)
  if (cached) {
    setState({ ...applyDoc(cached), status: 'loading', error: null, notice: null })
  }

  try {
    repo = await createRoutineRepository(userId)
    if (isSyncedRoutineRepository(repo)) connectRepo(repo, userId)
    const doc = await repo.getOrSeed()
    if (activeUserId !== userId) return
    writeCache(userId, doc)
    setState({
      status: 'ready',
      error: null,
      notice: null,
      ...applyDoc(doc),
      sync: isSyncedRoutineRepository(repo) ? repo.getSyncState() : null,
    })
    acceptRemoteNotice = true
  } catch (err) {
    console.error(err)
    if (activeUserId !== userId) return
    acceptRemoteNotice = true
    if (cached) {
      setState({
        status: 'ready',
        error: 'No se pudo actualizar tu rutina. Mostrando la copia guardada en este dispositivo.',
      })
      return
    }
    setState({
      status: 'ready',
      error: 'No se pudo cargar tu rutina. Usando la rutina por defecto.',
      ...fallback,
      notice: null,
    })
  }
}

export const routineActions = {
  init(userId: string) {
    if (activeUserId === userId && initPromise) return initPromise
    if (activeUserId && activeUserId !== userId) void routineActions.reset()
    activeUserId = userId
    initPromise = loadRoutine(userId)
    return initPromise
  },

  retry() {
    if (!activeUserId) return Promise.resolve()
    const userId = activeUserId
    const previous = repo
    unsubscribeRepo?.()
    unsubscribeRepo = null
    activeUserId = null
    initPromise = null
    repo = null
    acceptRemoteNotice = false
    setState(initialState())
    if (previous && isSyncedRoutineRepository(previous)) void previous.dispose()
    return routineActions.init(userId)
  },

  reset() {
    const userId = activeUserId
    if (userId) clearCache(userId)
    const previous = repo
    const purgeIfSynced = purgeOnReset
    purgeOnReset = false
    acceptRemoteNotice = false
    unsubscribeRepo?.()
    unsubscribeRepo = null
    activeUserId = null
    initPromise = null
    repo = null
    if (pendingWrite) {
      clearTimeout(pendingWrite)
      pendingWrite = null
    }
    setState(initialState())
    if (previous && isSyncedRoutineRepository(previous)) return previous.dispose({ purgeIfSynced })
    return Promise.resolve()
  },

  /** Uploads the queued routine before sign-out. Returns 1 when a change stays on this device. */
  async prepareSignOut(): Promise<number> {
    await flushRoutineWrites()
    if (!repo || !isSyncedRoutineRepository(repo)) return 0
    const { pending } = await repo.sync()
    purgeOnReset = pending === 0
    return pending
  },

  syncNow(): Promise<SyncState | null> {
    return repo && isSyncedRoutineRepository(repo) ? repo.sync() : Promise.resolve(null)
  },

  dismissError() {
    setState({ error: null })
  },

  dismissNotice() {
    setState({ notice: null })
  },

  updateDayMeta(dayId: DayId, patch: DayMetaPatch) {
    applyMutation((doc) => updateDayMeta(doc, dayId, patch))
  },

  setDayEnabled(dayId: DayId, enabled: boolean) {
    applyMutation((doc) => setDayEnabled(doc, dayId, enabled))
  },

  reorderExercises(dayId: DayId, fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return
    applyMutation((doc) => reorderExercises(doc, dayId, fromIndex, toIndex))
  },

  addExercise(dayId: DayId, exercise: ExerciseTemplate) {
    applyMutation((doc) => addExerciseToDay(doc, dayId, exercise))
  },

  updateExercise(dayId: DayId, exerciseId: string, patch: ExercisePatch) {
    applyMutation((doc) => updateExerciseInDay(doc, dayId, exerciseId, patch))
  },

  /**
   * Archives the exercise when any workout log has sets for it; otherwise deletes it.
   * The id is never reused for a different exercise because archived rows stay in the routine.
   */
  removeExercise(dayId: DayId, exerciseId: string): ExerciseRemovalResult['action'] {
    const hasLoggedSets = exerciseHasLoggedSets(Object.values(getWorkoutLogs()), exerciseId)
    applyMutation((doc) => removeOrArchiveExercise(doc, dayId, exerciseId, hasLoggedSets).doc)
    return hasLoggedSets ? 'archived' : 'removed'
  },

  archiveExercise(dayId: DayId, exerciseId: string) {
    applyMutation((doc) => setExerciseArchived(doc, dayId, exerciseId, true))
  },

  restoreExercise(dayId: DayId, exerciseId: string) {
    applyMutation((doc) => setExerciseArchived(doc, dayId, exerciseId, false))
  },

  restoreDefault() {
    applyMutation(() => restoreDefaultRoutineDocument())
  },
}

/** For non-React callers (e.g. workout-store). */
export function getRoutineDays(): DayTemplate[] {
  return state.days
}

/** Seed helper for tests and repositories. */
export { createDefaultRoutineDocument }
