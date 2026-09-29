import type { SupabaseClient } from '@supabase/supabase-js'
import { createDefaultRoutineDocument, parseRoutineDocument } from '@/lib/routine'
import type { UserRoutineDocument } from '@/types'
import type { RoutineRepository } from './routine-repository'

const TABLE = 'user_routines'

interface RoutineRow {
  user_id: string
  version: number
  routine: unknown
  updated_at: number
}

const fromRow = (row: RoutineRow): UserRoutineDocument => {
  const payload = row.routine as { days?: unknown }
  return parseRoutineDocument({ version: 1, days: payload.days, updatedAt: Number(row.updated_at) })
}

const toRow = (userId: string, doc: UserRoutineDocument): RoutineRow => ({
  user_id: userId,
  version: doc.version,
  routine: { days: doc.days },
  updated_at: doc.updatedAt,
})

export class SupabaseRoutineRepository implements RoutineRepository {
  readonly name = 'tu cuenta'
  private client: SupabaseClient
  private userId: string

  constructor(client: SupabaseClient, userId: string) {
    this.client = client
    this.userId = userId
  }

  async get() {
    const { data, error } = await this.client
      .from(TABLE)
      .select('user_id, version, routine, updated_at')
      .eq('user_id', this.userId)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return fromRow(data as RoutineRow)
  }

  async put(doc: UserRoutineDocument) {
    const { error } = await this.client.from(TABLE).upsert(toRow(this.userId, doc), { onConflict: 'user_id' })
    if (error) throw error
  }

  /** Creates the default routine row when the user opens the app for the first time. */
  async getOrSeed(): Promise<UserRoutineDocument> {
    const existing = await this.get()
    if (existing) return existing
    const seed = createDefaultRoutineDocument()
    await this.put(seed)
    return seed
  }
}
