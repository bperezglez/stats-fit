import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { LocalRoutineRepository } from './local-routine'
import type { RoutineRepository } from './routine-repository'

export type { RoutineRepository } from './routine-repository'

export async function createRoutineRepository(userId: string): Promise<RoutineRepository & { getOrSeed: () => Promise<import('@/types').UserRoutineDocument> }> {
  if (isSupabaseConfigured) {
    const { SupabaseRoutineRepository } = await import('./supabase-routine')
    return new SupabaseRoutineRepository(await getSupabase(), userId)
  }
  return new LocalRoutineRepository(userId)
}
