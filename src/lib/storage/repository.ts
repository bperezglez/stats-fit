import type { WorkoutLog } from '@/types'

/**
 * Persistence boundary. The UI only talks to the store, and the store only
 * talks to this interface, so a remote backend (Supabase, Firebase…) can be
 * dropped in by implementing these five methods.
 */
export interface WorkoutRepository {
  readonly name: string
  getAll(): Promise<WorkoutLog[]>
  put(log: WorkoutLog): Promise<void>
  bulkPut(logs: WorkoutLog[]): Promise<void>
  remove(id: string): Promise<void>
  clear(): Promise<void>
}

/**
 * - synced:  nothing waiting to be uploaded.
 * - syncing: talking to the server right now.
 * - pending: local changes waiting for the next attempt.
 * - offline: the last attempt failed because there is no connection.
 * - error:   the server rejected the last attempt; it will be retried.
 */
export type SyncStatus = 'synced' | 'syncing' | 'pending' | 'offline' | 'error'

export interface SyncState {
  status: SyncStatus
  pending: number
  lastSyncedAt: number | null
}

/** A repository that answers from a local copy and uploads changes in the background. */
export interface SyncedRepository extends WorkoutRepository {
  getSyncState(): SyncState
  /** Pushes queued changes, then pulls the server copy. Resolves once the attempt finishes. */
  sync(): Promise<SyncState>
  onSyncStateChange(listener: (state: SyncState) => void): () => void
  /** Called with the full local copy whenever a pull changed it. */
  onRemoteChange(listener: (logs: WorkoutLog[]) => void): () => void
  /** Stops background work. With `purgeIfSynced`, deletes the local copy if nothing is left to upload. */
  dispose(options?: { purgeIfSynced?: boolean }): Promise<void>
}

export const isSyncedRepository = (repo: WorkoutRepository): repo is SyncedRepository =>
  'sync' in repo && typeof repo.sync === 'function'
