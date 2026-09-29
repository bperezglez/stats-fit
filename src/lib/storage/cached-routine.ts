import type { IDBPDatabase } from 'idb'
import { createDefaultRoutineDocument } from '@/lib/routine'
import type { UserRoutineDocument } from '@/types'
import {
  openUserCache,
  purgeUserCacheIfIdle,
  ROUTINE_CACHE_KEY,
  ROUTINE_SYNCED_AT_KEY,
  type CacheDB,
  type RoutineOutboxEntry,
} from './cache-db'
import type { SyncState, SyncStatus } from './repository'
import type { RoutineRepository } from './routine-repository'

const SYNC_DELAY_MS = 800
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000]

export interface RoutineRemoteChange {
  replacedPending: boolean
}

export interface CachedRoutineRepositoryOptions {
  dbName: string
  remote: RoutineRepository
  autoSync?: boolean
  isOnline?: () => boolean
}

const defaultIsOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false

function isNetworkError(err: unknown) {
  const message = err instanceof Error ? err.message : String((err as { message?: unknown })?.message ?? err)
  return err instanceof TypeError || /fetch|network|timeout|offline|load failed/i.test(message)
}

const sameDoc = (a: UserRoutineDocument, b: UserRoutineDocument) =>
  a.version === b.version && a.updatedAt === b.updatedAt && JSON.stringify(a.days) === JSON.stringify(b.days)

/**
 * Offline copy of the single user routine, stored in the same IndexedDB database
 * as workout logs (`routine` + `routineOutbox`). Last write wins by `updatedAt`.
 */
export class CachedRoutineRepository implements RoutineRepository {
  readonly name: string
  private readonly dbName: string
  private readonly remote: RoutineRepository
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
  private readonly remoteListeners = new Set<(doc: UserRoutineDocument, info: RoutineRemoteChange) => void>()
  private readonly cleanups: (() => void)[] = []

  constructor({ dbName, remote, autoSync = true, isOnline = defaultIsOnline }: CachedRoutineRepositoryOptions) {
    this.name = remote.name
    this.dbName = dbName
    this.remote = remote
    this.autoSync = autoSync
    this.isOnline = isOnline
    this.db = openUserCache(dbName)
  }

  async open(): Promise<this> {
    const db = await this.db
    const pending = await db.get('routineOutbox', ROUTINE_CACHE_KEY)
    this.seq = pending?.seq ?? 0
    const lastSyncedAt = (await db.get('meta', ROUTINE_SYNCED_AT_KEY)) ?? null
    this.state = { status: pending ? 'pending' : 'synced', pending: pending ? 1 : 0, lastSyncedAt }

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

  onRemoteChange(listener: (doc: UserRoutineDocument, info: RoutineRemoteChange) => void) {
    this.remoteListeners.add(listener)
    return () => void this.remoteListeners.delete(listener)
  }

  async get() {
    return this.read()
  }

  async put(doc: UserRoutineDocument) {
    const entry: RoutineOutboxEntry = { key: ROUTINE_CACHE_KEY, seq: ++this.seq, doc }
    await this.write(doc, entry)
    await this.afterLocalWrite()
  }

  async getOrSeed(): Promise<UserRoutineDocument> {
    await this.sync()
    const local = await this.read()
    if (local) return local
    if (!this.isOnline() || this.state.status === 'offline' || this.state.status === 'error') {
      throw new Error('No se pudo descargar la rutina.')
    }
    const seed = createDefaultRoutineDocument()
    await this.put(seed)
    return seed
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
    const pending = await db.count('routineOutbox')
    db.close()
    if (purgeIfSynced && pending === 0) await purgeUserCacheIfIdle(this.dbName)
  }

  private async read(): Promise<UserRoutineDocument | null> {
    const row = await (await this.db).get('routine', ROUTINE_CACHE_KEY)
    return row?.doc ?? null
  }

  private async write(doc: UserRoutineDocument, outbox: RoutineOutboxEntry | null) {
    const tx = (await this.db).transaction(['routine', 'routineOutbox'], 'readwrite')
    const ops: Promise<unknown>[] = [tx.objectStore('routine').put({ id: ROUTINE_CACHE_KEY, doc })]
    if (outbox) ops.push(tx.objectStore('routineOutbox').put(outbox))
    await Promise.all([...ops, tx.done])
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
    const db = await this.db
    const lastSyncedAt = Date.now()
    await db.put('meta', lastSyncedAt, ROUTINE_SYNCED_AT_KEY)
    const pending = await db.count('routineOutbox')
    this.setState({ status: pending ? 'pending' : 'synced', pending, lastSyncedAt })
    if (pending) this.schedule(SYNC_DELAY_MS)
    return this.state
  }

  private async fail(err: unknown): Promise<SyncState> {
    const offline = !this.isOnline() || isNetworkError(err)
    if (!offline) console.error('Sincronización de la rutina fallida', err)
    const pending = await (await this.db).count('routineOutbox')
    const status: SyncStatus = offline ? 'offline' : 'error'
    this.setState({ status, pending })
    this.schedule(RETRY_DELAYS_MS[Math.min(this.failures, RETRY_DELAYS_MS.length - 1)])
    this.failures++
    return this.state
  }

  /** Uploads the queued routine unless the server copy is already newer. */
  private async push() {
    const db = await this.db
    const pending = await db.get('routineOutbox', ROUTINE_CACHE_KEY)
    const remote = await this.remote.get()
    if (!pending) {
      const local = await this.read()
      if (local && !remote) await this.remote.put(local)
      return
    }
    if (remote && remote.updatedAt > pending.doc.updatedAt) return
    await this.remote.put(pending.doc)
    await this.ack(pending.seq)
  }

  private async ack(seq: number) {
    const tx = (await this.db).transaction('routineOutbox', 'readwrite')
    const current = await tx.store.get(ROUTINE_CACHE_KEY)
    if (current?.seq === seq) await tx.store.delete(ROUTINE_CACHE_KEY)
    await tx.done
    this.setState({ pending: await (await this.db).count('routineOutbox') })
  }

  private async pull() {
    const remote = await this.remote.get()
    if (!remote) return
    const local = await this.read()
    const pending = await (await this.db).get('routineOutbox', ROUTINE_CACHE_KEY)

    if (pending && remote.updatedAt > pending.doc.updatedAt) {
      await this.replace(remote)
      this.emit(remote, { replacedPending: true })
      return
    }
    if (pending) return

    if (!local || remote.updatedAt > local.updatedAt) {
      const hadLocal = Boolean(local)
      if (!local || !sameDoc(local, remote)) await this.replace(remote)
      if (hadLocal && local && !sameDoc(local, remote)) this.emit(remote, { replacedPending: false })
      return
    }

    if (local.updatedAt > remote.updatedAt || !sameDoc(local, remote)) {
      await this.remote.put(local)
    }
  }

  private async replace(doc: UserRoutineDocument) {
    const tx = (await this.db).transaction(['routine', 'routineOutbox', 'meta'], 'readwrite')
    const lastSyncedAt = Date.now()
    await Promise.all([
      tx.objectStore('routine').put({ id: ROUTINE_CACHE_KEY, doc }),
      tx.objectStore('routineOutbox').delete(ROUTINE_CACHE_KEY),
      tx.objectStore('meta').put(lastSyncedAt, ROUTINE_SYNCED_AT_KEY),
      tx.done,
    ])
    this.setState({ lastSyncedAt, pending: 0 })
  }

  private emit(doc: UserRoutineDocument, info: RoutineRemoteChange) {
    if (this.disposed) return
    this.remoteListeners.forEach((listener) => listener(doc, info))
  }

  private async afterLocalWrite() {
    const pending = await (await this.db).count('routineOutbox')
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
    this.stateListeners.forEach((listener) => listener(this.state))
  }
}
