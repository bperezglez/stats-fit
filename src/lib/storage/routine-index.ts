import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import type { SyncState } from './repository'
import { LocalRoutineRepository } from './local-routine'
import type { RoutineRepository } from './routine-repository'
import type { UserRoutineDocument } from '@/types'

export type { RoutineRepository } from './routine-repository'

export type RoutineRepositoryWithSeed = RoutineRepository & {
  getOrSeed: () => Promise<UserRoutineDocument>
}

export interface SyncedRoutineRepository extends RoutineRepositoryWithSeed {
  getSyncState: () => SyncState
  sync: () => Promise<SyncState>
  onSyncStateChange: (listener: (state: SyncState) => void) => () => void
  onRemoteChange: (
    listener: (doc: UserRoutineDocument, info: { replacedPending: boolean }) => void,
  ) => () => void
  dispose: (options?: { purgeIfSynced?: boolean }) => Promise<void>
}

export function isSyncedRoutineRepository(repo: RoutineRepository): repo is SyncedRoutineRepository {
  return 'sync' in repo && typeof (repo as { sync?: unknown }).sync === 'function'
}

async function wrapRoutineCache(userId: string, remote: RoutineRepositoryWithSeed): Promise<RoutineRepositoryWithSeed> {
  if (typeof indexedDB === 'undefined') return remote
  try {
    const { CachedRoutineRepository } = await import('./cached-routine')
    return await new CachedRoutineRepository({ dbName: `fittrack-cache:${userId}`, remote }).open()
  } catch (err) {
    console.warn('Caché offline de la rutina no disponible, usando solo el servidor', err)
    return remote
  }
}

export async function createRoutineRepository(userId: string): Promise<RoutineRepositoryWithSeed> {
  if (isSupabaseConfigured) {
    const { SupabaseRoutineRepository } = await import('./supabase-routine')
    return wrapRoutineCache(userId, new SupabaseRoutineRepository(await getSupabase(), userId))
  }
  if (import.meta.env.DEV && import.meta.env.VITE_SIMULATE_SYNC === 'true') {
    const { SimulatedRoutineRepository } = await import('./simulated-routine')
    return wrapRoutineCache(userId, new SimulatedRoutineRepository(userId))
  }
  return new LocalRoutineRepository(userId)
}
