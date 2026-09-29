import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { CachedRepository } from './cached'
import { IndexedDbRepository } from './indexeddb'
import { LocalStorageRepository } from './local-storage'
import type { WorkoutRepository } from './repository'

export type { SyncState, SyncStatus, SyncedRepository, WorkoutRepository } from './repository'
export { isSyncedRepository } from './repository'

/**
 * Each user gets an isolated store: their own Supabase rows (behind their own
 * offline cache `fittrack-cache:{userId}`) or their own local database.
 */
export async function createRepository(userId: string): Promise<WorkoutRepository> {
  if (isSupabaseConfigured) {
    const { SupabaseRepository } = await import('./supabase')
    const remote = new SupabaseRepository(await getSupabase(), userId)
    if (typeof indexedDB === 'undefined') return remote
    try {
      return await new CachedRepository({ dbName: `fittrack-cache:${userId}`, remote }).open()
    } catch (err) {
      console.warn('Caché offline no disponible, usando solo el servidor', err)
      return remote
    }
  }
  if (import.meta.env.DEV && import.meta.env.VITE_SIMULATE_SYNC === 'true') {
    const { SimulatedRemoteRepository } = await import('./simulated-remote')
    const remote = new SimulatedRemoteRepository(userId)
    return new CachedRepository({ dbName: `fittrack-cache:${userId}`, remote }).open()
  }
  if (typeof indexedDB !== 'undefined') {
    try {
      const repo = new IndexedDbRepository(`fittrack:${userId}`)
      await repo.getAll()
      return repo
    } catch (err) {
      console.warn('IndexedDB no disponible, usando localStorage', err)
    }
  }
  return new LocalStorageRepository(`fittrack:${userId}:logs`)
}
