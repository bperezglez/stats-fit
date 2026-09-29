import type { WorkoutLog } from '@/types'
import { LocalStorageRepository } from './local-storage'
import type { WorkoutRepository } from './repository'

const LATENCY_MS = 400

/** Development stand-in for Supabase: slow, and unreachable while the browser is offline. */
export class SimulatedRemoteRepository implements WorkoutRepository {
  readonly name = 'servidor simulado'
  private store: LocalStorageRepository

  constructor(userId: string) {
    this.store = new LocalStorageRepository(`fittrack:simulated-remote:${userId}`)
  }

  private async call<T>(fn: () => Promise<T>): Promise<T> {
    await new Promise((r) => setTimeout(r, LATENCY_MS))
    if (!navigator.onLine) throw new TypeError('Failed to fetch')
    return fn()
  }

  getAll() {
    return this.call(() => this.store.getAll())
  }

  put(log: WorkoutLog) {
    return this.call(() => this.store.put(log))
  }

  bulkPut(logs: WorkoutLog[]) {
    return this.call(() => this.store.bulkPut(logs))
  }

  remove(id: string) {
    return this.call(() => this.store.remove(id))
  }

  clear() {
    return this.call(() => this.store.clear())
  }
}
