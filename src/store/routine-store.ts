import { useSyncExternalStore } from 'react'
import { DEFAULT_ROUTINE } from '@/data/routine'
import { buildDayById, buildExerciseById } from '@/lib/routine'
import { createRoutineRepository } from '@/lib/storage/routine-index'
import type { DayId, DayTemplate, ExerciseTemplate, UserRoutineDocument } from '@/types'

type Status = 'loading' | 'ready' | 'error'

export interface RoutineState {
  status: Status
  error: string | null
  days: DayTemplate[]
  dayById: Record<DayId, DayTemplate>
  exerciseById: Record<string, ExerciseTemplate & { day: DayId }>
}

const applyDoc = (doc: UserRoutineDocument): Omit<RoutineState, 'status' | 'error'> => ({
  days: doc.days,
  dayById: buildDayById(doc.days),
  exerciseById: buildExerciseById(doc.days),
})

const fallback = applyDoc({ version: 1, days: DEFAULT_ROUTINE, updatedAt: 0 })

let state: RoutineState = { status: 'loading', error: null, ...fallback }
let activeUserId: string | null = null
let initPromise: Promise<void> | null = null
const listeners = new Set<() => void>()

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

async function loadRoutine(userId: string) {
  const cached = readCache(userId)
  if (cached) {
    setState({ ...applyDoc(cached), status: 'loading', error: null })
  }

  try {
    const repo = await createRoutineRepository(userId)
    const doc = await repo.getOrSeed()
    if (activeUserId !== userId) return
    writeCache(userId, doc)
    setState({ status: 'ready', error: null, ...applyDoc(doc) })
  } catch (err) {
    console.error(err)
    if (activeUserId !== userId) return
    if (cached) {
      setState({ status: 'ready', error: 'No se pudo actualizar tu rutina. Mostrando la copia guardada en este dispositivo.' })
      return
    }
    setState({
      status: 'ready',
      error: 'No se pudo cargar tu rutina. Usando la rutina por defecto.',
      ...fallback,
    })
  }
}

export const routineActions = {
  init(userId: string) {
    if (activeUserId === userId && initPromise) return initPromise
    if (activeUserId && activeUserId !== userId) routineActions.reset()
    activeUserId = userId
    initPromise = loadRoutine(userId)
    return initPromise
  },

  retry() {
    if (!activeUserId) return Promise.resolve()
    const userId = activeUserId
    activeUserId = null
    initPromise = null
    setState({ status: 'loading', error: null, ...fallback })
    return routineActions.init(userId)
  },

  reset() {
    if (activeUserId) clearCache(activeUserId)
    activeUserId = null
    initPromise = null
    setState({ status: 'loading', error: null, ...fallback })
  },

  dismissError() {
    setState({ error: null })
  },
}

/** For non-React callers (e.g. workout-store). */
export function getRoutineDays(): DayTemplate[] {
  return state.days
}
