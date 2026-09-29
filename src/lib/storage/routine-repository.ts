import type { UserRoutineDocument } from '@/types'

/** Per-user routine persistence (one document). */
export interface RoutineRepository {
  readonly name: string
  get(): Promise<UserRoutineDocument | null>
  put(doc: UserRoutineDocument): Promise<void>
}
