import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import type { WorkoutLog } from '@/types'
import { CachedRepository } from './cached'
import type { WorkoutRepository } from './repository'

class FakeRemote implements WorkoutRepository {
  readonly name = 'remoto'
  rows = new Map<string, WorkoutLog>()
  online = true
  failWith: unknown = null
  calls: string[] = []
  /** Runs inside bulkPut, after the request "left" but before it resolves. */
  duringBulkPut: (() => Promise<void>) | null = null

  private check(call: string) {
    this.calls.push(call)
    if (!this.online) throw new TypeError('Failed to fetch')
    if (this.failWith) throw this.failWith
  }

  async getAll() {
    this.check('getAll')
    return [...this.rows.values()]
  }

  async put(log: WorkoutLog) {
    await this.bulkPut([log])
  }

  async bulkPut(logs: WorkoutLog[]) {
    this.check(`bulkPut:${logs.map((l) => l.id).join(',')}`)
    const hook = this.duringBulkPut
    this.duringBulkPut = null
    await hook?.()
    for (const l of logs) this.rows.set(l.id, structuredClone(l))
  }

  async remove(id: string) {
    this.check(`remove:${id}`)
    this.rows.delete(id)
  }

  async clear() {
    this.check('clear')
    this.rows.clear()
  }
}

let dbCounter = 0

async function setup(remote = new FakeRemote(), dbName = `test-cache-${++dbCounter}`) {
  const repo = await new CachedRepository({ dbName, remote, autoSync: false, isOnline: () => remote.online }).open()
  return { repo, remote, dbName }
}

const log = (id: string, reps: number, updatedAt = reps): WorkoutLog => {
  const [weekKey, day] = id.split(':') as [string, WorkoutLog['day']]
  return {
    id,
    weekKey,
    day,
    exercises: { sentadilla: [{ id: 's1', reps, weight: 60, duration: null, distance: null }] },
    updatedAt,
  }
}

const A = '2026-W40:lunes'
const B = '2026-W40:martes'
const C = '2026-W41:lunes'

describe('CachedRepository', () => {
  it('saves locally at once and uploads on sync', async () => {
    const { repo, remote } = await setup()
    await repo.put(log(A, 10))

    expect(await repo.getAll()).toHaveLength(1)
    expect(remote.rows.size).toBe(0)
    expect(repo.getSyncState()).toMatchObject({ status: 'pending', pending: 1 })

    const state = await repo.sync()
    expect(state).toMatchObject({ status: 'synced', pending: 0 })
    expect(state.lastSyncedAt).not.toBeNull()
    expect(remote.rows.get(A)?.exercises.sentadilla[0].reps).toBe(10)
  })

  it('keeps changes queued while offline and uploads them on reconnect', async () => {
    const { repo, remote } = await setup()
    remote.online = false
    await repo.put(log(A, 10))
    await repo.put(log(B, 8))

    expect(await repo.sync()).toMatchObject({ status: 'offline', pending: 2 })
    expect(remote.rows.size).toBe(0)
    expect(await repo.getAll()).toHaveLength(2)

    remote.online = true
    expect(await repo.sync()).toMatchObject({ status: 'synced', pending: 0 })
    expect([...remote.rows.keys()].sort()).toEqual([A, B])
  })

  it('collapses repeated edits of one session into a single upload', async () => {
    const { repo, remote } = await setup()
    await repo.put(log(A, 8))
    await repo.put(log(A, 9))
    await repo.put(log(A, 10))
    expect(repo.getSyncState().pending).toBe(1)

    await repo.sync()
    expect(remote.calls.filter((c) => c.startsWith('bulkPut'))).toEqual([`bulkPut:${A}`])
    expect(remote.rows.get(A)?.exercises.sentadilla[0].reps).toBe(10)
  })

  it('uploads deletions', async () => {
    const { repo, remote } = await setup()
    await repo.put(log(A, 10))
    await repo.sync()
    await repo.remove(A)
    await repo.sync()
    expect(remote.rows.has(A)).toBe(false)
    expect(await repo.getAll()).toEqual([])
  })

  it('pulls changes from other devices without overwriting queued local edits', async () => {
    const { repo, remote } = await setup()
    await repo.put(log(A, 10))
    await repo.put(log(B, 8))
    await repo.sync()

    // Another device edits A and B, and deletes nothing; this device edits A offline.
    remote.rows.set(A, log(A, 99, 1000))
    remote.rows.set(B, log(B, 12, 1000))
    remote.rows.set(C, log(C, 5, 1000))
    remote.online = false
    await repo.put(log(A, 11, 2000))

    const seen: WorkoutLog[][] = []
    repo.onRemoteChange((logs) => seen.push(logs))
    remote.online = true
    await repo.sync()

    const local = new Map((await repo.getAll()).map((l) => [l.id, l]))
    expect(local.get(A)?.exercises.sentadilla[0].reps).toBe(11)
    expect(remote.rows.get(A)?.exercises.sentadilla[0].reps).toBe(11)
    expect(local.get(B)?.exercises.sentadilla[0].reps).toBe(12)
    expect(local.has(C)).toBe(true)
    expect(seen).toHaveLength(1)
  })

  it('drops sessions deleted on another device', async () => {
    const { repo, remote } = await setup()
    await repo.bulkPut([log(A, 10), log(B, 8)])
    await repo.sync()
    remote.rows.delete(B)

    await repo.sync()
    expect((await repo.getAll()).map((l) => l.id)).toEqual([A])
  })

  it('does not lose an edit made while the previous version was uploading', async () => {
    const { repo, remote } = await setup()
    await repo.put(log(A, 10))
    remote.duringBulkPut = () => repo.put(log(A, 11, 50))

    await repo.sync()
    expect(repo.getSyncState().pending).toBe(0)
    expect(remote.rows.get(A)?.exercises.sentadilla[0].reps).toBe(11)
    expect((await repo.getAll())[0].exercises.sentadilla[0].reps).toBe(11)
  })

  it('replays a wipe before the sessions written after it', async () => {
    const { repo, remote } = await setup()
    await repo.bulkPut([log(A, 10), log(B, 8)])
    await repo.sync()

    remote.online = false
    await repo.put(log(A, 12))
    await repo.clear()
    await repo.put(log(C, 5))
    expect(repo.getSyncState().pending).toBe(2)

    remote.online = true
    remote.calls = []
    await repo.sync()
    expect(remote.calls.slice(0, 2)).toEqual(['clear', `bulkPut:${C}`])
    expect([...remote.rows.keys()]).toEqual([C])
    expect((await repo.getAll()).map((l) => l.id)).toEqual([C])
  })

  it('reports server rejections as errors and keeps the queue', async () => {
    const { repo, remote } = await setup()
    await repo.put(log(A, 10))
    remote.failWith = Object.assign(new Error('new row violates row-level security policy'), { code: '42501' })

    expect(await repo.sync()).toMatchObject({ status: 'error', pending: 1 })
    remote.failWith = null
    expect(await repo.sync()).toMatchObject({ status: 'synced', pending: 0 })
  })

  it('keeps the queue across app restarts', async () => {
    const { repo, remote, dbName } = await setup()
    remote.online = false
    await repo.put(log(A, 10))
    await repo.dispose()

    remote.online = true
    const { repo: reopened } = await setup(remote, dbName)
    expect(reopened.getSyncState()).toMatchObject({ status: 'pending', pending: 1 })
    await reopened.sync()
    expect(remote.rows.has(A)).toBe(true)
  })

  it('isolates each user in their own database', async () => {
    const { repo: ana } = await setup(new FakeRemote(), 'fittrack-cache:ana')
    const { repo: luis } = await setup(new FakeRemote(), 'fittrack-cache:luis')
    await ana.put(log(A, 10))

    expect(await ana.getAll()).toHaveLength(1)
    expect(await luis.getAll()).toEqual([])
  })

  it('deletes the local copy on sign-out only when everything was uploaded', async () => {
    const remote = new FakeRemote()
    const first = await setup(remote)
    remote.online = false
    await first.repo.put(log(A, 10))
    await first.repo.dispose({ purgeIfSynced: true })

    const kept = await setup(remote, first.dbName)
    expect(await kept.repo.getAll()).toHaveLength(1)
    remote.online = true
    await kept.repo.sync()
    await kept.repo.dispose({ purgeIfSynced: true })

    const purged = await setup(new FakeRemote(), first.dbName)
    expect(await purged.repo.getAll()).toEqual([])
    expect(purged.repo.getSyncState().lastSyncedAt).toBeNull()
  })
})
