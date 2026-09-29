import type { IDBPDatabase } from 'idb'
import type { WorkoutLog } from '@/types'
import { openUserCache, purgeUserCacheIfIdle, type CacheDB, type OutboxEntry } from './cache-db'
import type { SyncState, SyncStatus, SyncedRepository, WorkoutRepository } from './repository'

/** Outbox key for "wipe everything"; cannot collide with a log id (`YYYY-Www:day`). */
const CLEAR_KEY = '*clear*'

/**
 * One entry per log id: a newer write to the same log replaces the queued one,
 * so the outbox never holds more than one operation per session.
 */
const SYNC_DELAY_MS = 800
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000]

export interface CachedRepositoryOptions {
  dbName: string
  remote: WorkoutRepository
  /** Background syncing (after writes, on reconnect, on retry). Tests turn it off to drive `sync()` by hand. */
  autoSync?: boolean
  isOnline?: () => boolean
}

const defaultIsOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false

function isNetworkError(err: unknown) {
  const message = err instanceof Error ? err.message : String((err as { message?: unknown })?.message ?? err)
  return err instanceof TypeError || /fetch|network|timeout|offline|load failed/i.test(message)
}

const sameLog = (a: WorkoutLog, b: WorkoutLog) =>
  a.updatedAt === b.updatedAt && JSON.stringify(a.exercises) === JSON.stringify(b.exercises)

/**
 * Offline-first wrapper around a remote repository. Reads and writes hit a
 * per-user IndexedDB copy, so the app works without a connection; writes are
 * also queued in an outbox that is uploaded in the background. Pulls never
 * overwrite a log that still has a queued local change.
 */
export class CachedRepository implements SyncedRepository {
  readonly name: string
  private readonly dbName: string
  private readonly remote: WorkoutRepository
  private readonly autoSync: boolean
  private readonly isOnline: () => boolean
  private readonly db: Promise<IDBPDatabase<CacheDB>>
  private state: SyncState = { status: 'synced', pending: 0, lastSyncedAt: null }
  private seq = 0
  private running: Promise<SyncState> | null = null
  private rerun = false
  private failures = 0
  private timer: ReturnType<typeof setTimeout> | undefined
  private disposed = false
  private readonly stateListeners = new Set<(state: SyncState) => void>()
  private readonly remoteListeners = new Set<(logs: WorkoutLog[]) => void>()
  private readonly cleanups: (() => void)[] = []

  constructor({ dbName, remote, autoSync = true, isOnline = defaultIsOnline }: CachedRepositoryOptions) {
    this.name = remote.name
    this.dbName = dbName
    this.remote = remote
    this.autoSync = autoSync
    this.isOnline = isOnline
    this.db = openUserCache(dbName)
  }

  /** Restores the queue counters from disk and starts listening for reconnects. */
  async open(): Promise<this> {
    const db = await this.db
    const entries = await db.getAll('outbox')
    this.seq = entries.reduce((max, e) => Math.max(max, e.seq), 0)
    const lastSyncedAt = (await db.get('meta', 'lastSyncedAt')) ?? null
    this.state = { status: entries.length ? 'pending' : 'synced', pending: entries.length, lastSyncedAt }

    if (this.autoSync && typeof window !== 'undefined') {
      const onOnline = () => void this.sync()
      const onVisible = () => document.visibilityState === 'visible' && void this.sync()
      window.addEventListener('online', onOnline)
      document.addEventListener('visibilitychange', onVisible)
      this.cleanups.push(
        () => window.removeEventListener('online', onOnline),
        () => document.removeEventListener('visibilitychange', onVisible),
      )
    }
    return this
  }

  getSyncState() {
    return this.state
  }

  onSyncStateChange(listener: (state: SyncState) => void) {
    this.stateListeners.add(listener)
    return () => void this.stateListeners.delete(listener)
  }

  onRemoteChange(listener: (logs: WorkoutLog[]) => void) {
    this.remoteListeners.add(listener)
    return () => void this.remoteListeners.delete(listener)
  }

  async getAll() {
    return (await this.db).getAll('logs')
  }

  async put(log: WorkoutLog) {
    await this.bulkPut([log])
  }

  async bulkPut(logs: WorkoutLog[]) {
    if (!logs.length) return
    const tx = (await this.db).transaction(['logs', 'outbox'], 'readwrite')
    const ops: Promise<unknown>[] = []
    for (const log of logs) {
      ops.push(tx.objectStore('logs').put(log))
      ops.push(tx.objectStore('outbox').put({ key: log.id, seq: ++this.seq, op: 'put', log }))
    }
    await Promise.all([...ops, tx.done])
    await this.afterLocalWrite()
  }

  async remove(id: string) {
    const tx = (await this.db).transaction(['logs', 'outbox'], 'readwrite')
    await Promise.all([
      tx.objectStore('logs').delete(id),
      tx.objectStore('outbox').put({ key: id, seq: ++this.seq, op: 'remove' }),
      tx.done,
    ])
    await this.afterLocalWrite()
  }

  /** Earlier queued changes are pointless once everything is wiped, so the queue restarts with the clear. */
  async clear() {
    const tx = (await this.db).transaction(['logs', 'outbox'], 'readwrite')
    const outbox = tx.objectStore('outbox')
    await Promise.all([
      tx.objectStore('logs').clear(),
      outbox.clear().then(() => outbox.put({ key: CLEAR_KEY, seq: ++this.seq, op: 'clear' })),
      tx.done,
    ])
    await this.afterLocalWrite()
  }

  sync(): Promise<SyncState> {
    if (this.disposed) return Promise.resolve(this.state)
    if (this.running) {
      this.rerun = true
      return this.running
    }
    clearTimeout(this.timer)
    this.running = this.run().finally(() => {
      this.running = null
    })
    return this.running
  }

  async dispose({ purgeIfSynced = false }: { purgeIfSynced?: boolean } = {}) {
    this.disposed = true
    clearTimeout(this.timer)
    this.cleanups.splice(0).forEach((fn) => fn())
    this.stateListeners.clear()
    this.remoteListeners.clear()
    await this.running?.catch(() => undefined)
    const db = await this.db
    const pending = await db.count('outbox')
    db.close()
    if (purgeIfSynced && pending === 0) await purgeUserCacheIfIdle(this.dbName)
  }

  private async run(): Promise<SyncState> {
    do {
      this.rerun = false
      if (!this.isOnline()) return this.fail(new TypeError('offline'))
      this.setState({ status: 'syncing' })
      try {
        await this.push()
        await this.pull()
      } catch (err) {
        return this.fail(err)
      }
    } while (this.rerun && !this.disposed)

    this.failures = 0
    const pending = await (await this.db).count('outbox')
    this.setState({ status: pending ? 'pending' : 'synced', pending })
    if (pending) this.schedule(SYNC_DELAY_MS)
    return this.state
  }

  private async fail(err: unknown): Promise<SyncState> {
    const offline = !this.isOnline() || isNetworkError(err)
    if (!offline) console.error('Sincronización fallida', err)
    const pending = await (await this.db).count('outbox')
    const status: SyncStatus = offline ? 'offline' : 'error'
    this.setState({ status, pending })
    this.schedule(RETRY_DELAYS_MS[Math.min(this.failures, RETRY_DELAYS_MS.length - 1)])
    this.failures++
    return this.state
  }

  private async push() {
    const db = await this.db
    const entries = await db.getAll('outbox')
    if (!entries.length) return

    const clear = entries.find((e) => e.op === 'clear')
    if (clear) {
      await this.remote.clear()
      await this.ack([clear])
    }
    const puts = entries.filter((e): e is Extract<OutboxEntry, { op: 'put' }> => e.op === 'put')
    if (puts.length) {
      await this.remote.bulkPut(puts.map((e) => e.log))
      await this.ack(puts)
    }
    for (const e of entries) {
      if (e.op !== 'remove') continue
      await this.remote.remove(e.key)
      await this.ack([e])
    }
  }

  /** Drops uploaded entries, unless a newer write to the same log replaced them meanwhile. */
  private async ack(sent: OutboxEntry[]) {
    const tx = (await this.db).transaction('outbox', 'readwrite')
    for (const e of sent) {
      const current = await tx.store.get(e.key)
      if (current?.seq === e.seq) await tx.store.delete(e.key)
    }
    await tx.done
    this.setState({ pending: await (await this.db).count('outbox') })
  }

  private async pull() {
    const remoteLogs = await this.remote.getAll()
    const db = await this.db
    const tx = db.transaction(['logs', 'outbox', 'meta'], 'readwrite')
    const logs = tx.objectStore('logs')
    const pendingKeys = new Set(await tx.objectStore('outbox').getAllKeys())
    if (pendingKeys.has(CLEAR_KEY)) {
      await tx.done
      this.rerun = true
      return
    }

    const local = new Map((await logs.getAll()).map((l) => [l.id, l]))
    const remoteIds = new Set<string>()
    let changed = false
    for (const log of remoteLogs) {
      remoteIds.add(log.id)
      if (pendingKeys.has(log.id)) continue
      const mine = local.get(log.id)
      if (!mine || !sameLog(mine, log)) {
        void logs.put(log)
        changed = true
      }
    }
    for (const id of local.keys()) {
      if (remoteIds.has(id) || pendingKeys.has(id)) continue
      void logs.delete(id)
      changed = true
    }
    const lastSyncedAt = Date.now()
    void tx.objectStore('meta').put(lastSyncedAt, 'lastSyncedAt')
    await tx.done

    this.setState({ lastSyncedAt })
    if (changed && !this.disposed) {
      const all = await db.getAll('logs')
      this.remoteListeners.forEach((l) => l(all))
    }
  }

  private async afterLocalWrite() {
    const pending = await (await this.db).count('outbox')
    if (this.running) {
      this.rerun = true
      this.setState({ pending })
      return
    }
    this.setState({ pending, status: 'pending' })
    this.schedule(SYNC_DELAY_MS)
  }

  private schedule(delay: number) {
    if (!this.autoSync || this.disposed) return
    clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.sync(), delay)
  }

  private setState(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch }
    this.stateListeners.forEach((l) => l(this.state))
  }
}
