import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { UserRoutineDocument, WorkoutLog } from '@/types'

/** Bump when the per-user cache (`fittrack-cache:{userId}`) gains a store. */
export const CACHE_DB_VERSION = 2

export const ROUTINE_CACHE_KEY = 'routine'
export const ROUTINE_SYNCED_AT_KEY = 'routineLastSyncedAt'

export type OutboxEntry =
  | { key: string; seq: number; op: 'put'; log: WorkoutLog }
  | { key: string; seq: number; op: 'remove' }
  | { key: string; seq: number; op: 'clear' }

export interface CachedRoutineRecord {
  id: typeof ROUTINE_CACHE_KEY
  doc: UserRoutineDocument
}

export interface RoutineOutboxEntry {
  key: typeof ROUTINE_CACHE_KEY
  seq: number
  doc: UserRoutineDocument
}

export interface CacheDB extends DBSchema {
  logs: { key: string; value: WorkoutLog }
  outbox: { key: string; value: OutboxEntry }
  meta: { key: string; value: number }
  routine: { key: string; value: CachedRoutineRecord }
  routineOutbox: { key: string; value: RoutineOutboxEntry }
}

export function openUserCache(dbName: string): Promise<IDBPDatabase<CacheDB>> {
  return openDB<CacheDB>(dbName, CACHE_DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('logs', { keyPath: 'id' })
        db.createObjectStore('outbox', { keyPath: 'key' })
        db.createObjectStore('meta')
      }
      if (oldVersion < 2) {
        db.createObjectStore('routine', { keyPath: 'id' })
        db.createObjectStore('routineOutbox', { keyPath: 'key' })
      }
    },
  })
}

/** Deletes the shared cache only when neither logs nor the routine still have uploads queued. */
export async function purgeUserCacheIfIdle(dbName: string): Promise<void> {
  const db = await openUserCache(dbName)
  const logsPending = await db.count('outbox')
  const routinePending = await db.count('routineOutbox')
  db.close()
  if (logsPending > 0 || routinePending > 0) return
  await new Promise<void>((resolve) => {
    deleteDB(dbName, { blocked: () => resolve() }).then(
      () => resolve(),
      () => resolve(),
    )
  })
}
