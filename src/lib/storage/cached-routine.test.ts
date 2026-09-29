import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createDefaultRoutineDocument } from '@/lib/routine'
import type { UserRoutineDocument, WorkoutLog } from '@/types'
import { CachedRepository } from './cached'
import { CachedRoutineRepository } from './cached-routine'
import type { RoutineRepository } from './routine-repository'
import type { WorkoutRepository } from './repository'

class FakeRoutineRemote implements RoutineRepository {
  readonly name = 'remoto'
  doc: UserRoutineDocument | null = null
  online = true
  failWith: unknown = null

  private check() {
    if (!this.online) throw new TypeError('Failed to fetch')
    if (this.failWith) throw this.failWith
  }

  async get() {
    this.check()
    return this.doc ? structuredClone(this.doc) : null
  }

  async put(doc: UserRoutineDocument) {
    this.check()
    this.doc = structuredClone(doc)
  }
}

class FakeLogs implements WorkoutRepository {
  readonly name = 'remoto'
  async getAll() {
    return []
  }
  async put() {}
  async bulkPut() {}
  async remove() {}
  async clear() {}
}

let dbCounter = 0

async function setup(remote = new FakeRoutineRemote(), dbName = `test-routine-${++dbCounter}`) {
  const repo = await new CachedRoutineRepository({
    dbName,
    remote,
    autoSync: false,
    isOnline: () => remote.online,
  }).open()
  return { repo, remote, dbName }
}

const titled = (title: string, updatedAt: number): UserRoutineDocument => {
  const doc = createDefaultRoutineDocument()
  doc.updatedAt = updatedAt
  doc.days[0] = { ...doc.days[0], title }
  return doc
}

describe('CachedRoutineRepository', () => {
  it('queues a local edit and uploads it on sync', async () => {
    const { repo, remote } = await setup()
    const doc = titled('Local', 10)
    await repo.put(doc)

    expect((await repo.get())?.days[0].title).toBe('Local')
    expect(remote.doc).toBeNull()
    expect(repo.getSyncState()).toMatchObject({ status: 'pending', pending: 1 })

    const state = await repo.sync()
    expect(state).toMatchObject({ status: 'synced', pending: 0 })
    expect(state.lastSyncedAt).not.toBeNull()
    expect(remote.doc?.days[0].title).toBe('Local')
  })

  it('keeps the routine queued while offline', async () => {
    const { repo, remote } = await setup()
    remote.online = false
    await repo.put(titled('Offline', 20))

    expect(await repo.sync()).toMatchObject({ status: 'offline', pending: 1 })
    expect(remote.doc).toBeNull()

    remote.online = true
    expect(await repo.sync()).toMatchObject({ status: 'synced', pending: 0 })
    expect(remote.doc?.days[0].title).toBe('Offline')
  })

  it('lets the newer remote routine replace a queued local edit', async () => {
    const { repo, remote } = await setup()
    await repo.put(titled('Base', 100))
    await repo.sync()

    remote.doc = titled('Remoto', 500)
    const seen: boolean[] = []
    repo.onRemoteChange((_doc, info) => seen.push(info.replacedPending))
    await repo.put(titled('Local', 200))
    await repo.sync()

    expect((await repo.get())?.days[0].title).toBe('Remoto')
    expect(remote.doc?.days[0].title).toBe('Remoto')
    expect(repo.getSyncState().pending).toBe(0)
    expect(seen).toEqual([true])
  })

  it('uploads a newer local routine over an older remote copy', async () => {
    const { repo, remote } = await setup()
    remote.doc = titled('Viejo', 100)
    const seen: boolean[] = []
    repo.onRemoteChange(() => seen.push(true))

    await repo.put(titled('Nuevo', 300))
    await repo.sync()

    expect(remote.doc?.days[0].title).toBe('Nuevo')
    expect((await repo.get())?.days[0].title).toBe('Nuevo')
    expect(seen).toEqual([])
  })

  it('pulls a newer routine from another device when nothing is queued', async () => {
    const { repo, remote } = await setup()
    await repo.put(titled('Local', 100))
    await repo.sync()

    remote.doc = titled('Otro dispositivo', 400)
    const seen: boolean[] = []
    repo.onRemoteChange((_doc, info) => seen.push(info.replacedPending))
    await repo.sync()

    expect((await repo.get())?.days[0].title).toBe('Otro dispositivo')
    expect(seen).toEqual([false])
  })

  it('seeds an empty account and uploads the default routine', async () => {
    const { repo, remote } = await setup()
    const doc = await repo.getOrSeed()
    expect(doc.days).toHaveLength(5)
    expect(remote.doc).toBeNull()

    await repo.sync()
    expect(remote.doc?.version).toBe(1)
    expect(remote.doc?.days).toHaveLength(5)
  })

  it('keeps the routine queue across restarts', async () => {
    const { repo, remote, dbName } = await setup()
    remote.online = false
    await repo.put(titled('Pendiente', 15))
    await repo.dispose()

    remote.online = true
    const reopened = await setup(remote, dbName)
    expect(reopened.repo.getSyncState()).toMatchObject({ status: 'pending', pending: 1 })
    await reopened.repo.sync()
    expect(remote.doc?.days[0].title).toBe('Pendiente')
  })

  it('shares the cache database with workout logs', async () => {
    const dbName = `fittrack-cache-share-${++dbCounter}`
    const logs = await new CachedRepository({
      dbName,
      remote: new FakeLogs(),
      autoSync: false,
      isOnline: () => true,
    }).open()
    const { repo } = await setup(new FakeRoutineRemote(), dbName)
    const log: WorkoutLog = {
      id: '2026-W40:lunes',
      weekKey: '2026-W40',
      day: 'lunes',
      exercises: {},
      updatedAt: 1,
    }
    await logs.put(log)
    await repo.put(titled('Junto', 8))

    expect(await logs.getAll()).toHaveLength(1)
    expect((await repo.get())?.days[0].title).toBe('Junto')
    await logs.dispose()
    await repo.dispose()
  })
})
