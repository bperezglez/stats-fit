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
