import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { WorkoutLog } from '@/types'
import type { WorkoutRepository } from './repository'

interface FitTrackDB extends DBSchema {
  logs: {
    key: string
    value: WorkoutLog
    indexes: { byWeek: string }
  }
}

export class IndexedDbRepository implements WorkoutRepository {
  readonly name = 'IndexedDB'
  private db: Promise<IDBPDatabase<FitTrackDB>>

  constructor(dbName = 'fittrack') {
    this.db = openDB<FitTrackDB>(dbName, 1, {
      upgrade(db) {
        const store = db.createObjectStore('logs', { keyPath: 'id' })
        store.createIndex('byWeek', 'weekKey')
      },
    })
  }

  async getAll() {
    return (await this.db).getAll('logs')
  }

  async put(log: WorkoutLog) {
    await (await this.db).put('logs', log)
  }

  async bulkPut(logs: WorkoutLog[]) {
    const tx = (await this.db).transaction('logs', 'readwrite')
    await Promise.all([...logs.map((l) => tx.store.put(l)), tx.done])
  }

  async remove(id: string) {
    await (await this.db).delete('logs', id)
  }

  async clear() {
    await (await this.db).clear('logs')
  }
}
