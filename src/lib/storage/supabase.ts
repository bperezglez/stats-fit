import type { SupabaseClient } from '@supabase/supabase-js'
import type { DayId, SetEntry, WorkoutLog } from '@/types'
import type { WorkoutRepository } from './repository'

const TABLE = 'workout_logs'
const PAGE_SIZE = 1000

interface WorkoutLogRow {
  user_id: string
  id: string
  week_key: string
  day: DayId
  exercises: Record<string, SetEntry[]>
  updated_at: number
}

const toRow = (userId: string, log: WorkoutLog): WorkoutLogRow => ({
  user_id: userId,
  id: log.id,
  week_key: log.weekKey,
  day: log.day,
  exercises: log.exercises,
  updated_at: log.updatedAt,
})

const fromRow = (row: WorkoutLogRow): WorkoutLog => ({
  id: row.id,
  weekKey: row.week_key,
  day: row.day,
  exercises: row.exercises ?? {},
  updatedAt: Number(row.updated_at),
})

/**
 * Every query is also filtered by `user_id`, but the real isolation is the
 * row-level security policy in supabase/migrations: a user can only ever read
 * or write rows where `user_id = auth.uid()`.
 */
export class SupabaseRepository implements WorkoutRepository {
  readonly name = 'tu cuenta'
  private client: SupabaseClient
  private userId: string

  constructor(client: SupabaseClient, userId: string) {
    this.client = client
    this.userId = userId
  }

  async getAll() {
    const logs: WorkoutLog[] = []
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await this.client
        .from(TABLE)
        .select('user_id, id, week_key, day, exercises, updated_at')
        .eq('user_id', this.userId)
        .order('id')
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw error
      logs.push(...(data as WorkoutLogRow[]).map(fromRow))
      if (data.length < PAGE_SIZE) return logs
    }
  }

  async put(log: WorkoutLog) {
    await this.bulkPut([log])
  }

  async bulkPut(logs: WorkoutLog[]) {
    for (let i = 0; i < logs.length; i += PAGE_SIZE) {
      const rows = logs.slice(i, i + PAGE_SIZE).map((l) => toRow(this.userId, l))
      const { error } = await this.client.from(TABLE).upsert(rows, { onConflict: 'user_id,id' })
      if (error) throw error
    }
  }

  async remove(id: string) {
    const { error } = await this.client.from(TABLE).delete().eq('user_id', this.userId).eq('id', id)
    if (error) throw error
  }

  async clear() {
    const { error } = await this.client.from(TABLE).delete().eq('user_id', this.userId)
    if (error) throw error
  }
}
