import { createDefaultRoutineDocument, parseRoutineDocument } from '@/lib/routine'
import type { UserRoutineDocument } from '@/types'
import type { RoutineRepository } from './routine-repository'

/** Development storage: one JSON blob per user in localStorage. */
export class LocalRoutineRepository implements RoutineRepository {
  readonly name = 'local'
  private key: string

  constructor(userId: string) {
    this.key = `fittrack:routine:${userId}`
  }

  async get() {
    try {
      const raw = localStorage.getItem(this.key)
      if (!raw) return null
      return parseRoutineDocument(JSON.parse(raw))
    } catch {
      return null
    }
  }

  async put(doc: UserRoutineDocument) {
    localStorage.setItem(this.key, JSON.stringify(doc))
  }

  async getOrSeed(): Promise<UserRoutineDocument> {
    const existing = await this.get()
    if (existing) return existing
    const seed = createDefaultRoutineDocument()
    await this.put(seed)
    return seed
  }
}
