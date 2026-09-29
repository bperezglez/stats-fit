import type { WorkoutLog } from '@/types'
import type { WorkoutRepository } from './repository'

/** Fallback for browsers where IndexedDB is unavailable (e.g. some private modes). */
export class LocalStorageRepository implements WorkoutRepository {
  readonly name = 'localStorage'
  private key: string

  constructor(key = 'fittrack:logs') {
    this.key = key
  }

  private read(): Record<string, WorkoutLog> {
    try {
      return JSON.parse(localStorage.getItem(this.key) ?? '{}')
    } catch {
      return {}
    }
  }

  private write(data: Record<string, WorkoutLog>) {
    localStorage.setItem(this.key, JSON.stringify(data))
  }

  async getAll() {
    return Object.values(this.read())
  }

  async put(log: WorkoutLog) {
    const data = this.read()
    data[log.id] = log
    this.write(data)
  }

  async bulkPut(logs: WorkoutLog[]) {
    const data = this.read()
    for (const l of logs) data[l.id] = l
    this.write(data)
  }

  async remove(id: string) {
    const data = this.read()
    delete data[id]
    this.write(data)
  }

  async clear() {
    localStorage.removeItem(this.key)
  }
}
