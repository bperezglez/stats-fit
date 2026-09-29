import { IndexedDbRepository } from './indexeddb'
import { LocalStorageRepository } from './local-storage'
import type { WorkoutRepository } from './repository'

export type { WorkoutRepository }

export async function createRepository(): Promise<WorkoutRepository> {
  if (typeof indexedDB !== 'undefined') {
    try {
      const repo = new IndexedDbRepository()
      await repo.getAll()
      return repo
    } catch (err) {
      console.warn('IndexedDB no disponible, usando localStorage', err)
    }
  }
  return new LocalStorageRepository()
}
