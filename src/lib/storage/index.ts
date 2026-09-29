import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { IndexedDbRepository } from './indexeddb'
import { LocalStorageRepository } from './local-storage'
import type { WorkoutRepository } from './repository'

export type { WorkoutRepository }

/** Each user gets an isolated store: their own Supabase rows or their own local database. */
export async function createRepository(userId: string): Promise<WorkoutRepository> {
  if (isSupabaseConfigured) {
    const { SupabaseRepository } = await import('./supabase')
    return new SupabaseRepository(await getSupabase(), userId)
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
