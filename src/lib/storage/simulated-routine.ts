import { createDefaultRoutineDocument, parseRoutineDocument } from '@/lib/routine'
import type { UserRoutineDocument } from '@/types'
import type { RoutineRepository } from './routine-repository'

const LATENCY_MS = 400

/** Development stand-in for `user_routines`: slow, and unreachable while the browser is offline. */
export class SimulatedRoutineRepository implements RoutineRepository {
  readonly name = 'servidor simulado'
  private key: string

  constructor(userId: string) {
    this.key = `fittrack:simulated-routine:${userId}`
  }

  private async call<T>(fn: () => T): Promise<T> {
    await new Promise((resolve) => setTimeout(resolve, LATENCY_MS))
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new TypeError('Failed to fetch')
    return fn()
  }

  get() {
    return this.call(() => {
      const raw = localStorage.getItem(this.key)
      if (!raw) return null
      return parseRoutineDocument(JSON.parse(raw))
    })
  }

  put(doc: UserRoutineDocument) {
    return this.call(() => {
      localStorage.setItem(this.key, JSON.stringify(doc))
    })
  }

  async getOrSeed(): Promise<UserRoutineDocument> {
    const existing = await this.get()
    if (existing) return existing
    const seed = createDefaultRoutineDocument()
    await this.put(seed)
    return seed
  }
}
