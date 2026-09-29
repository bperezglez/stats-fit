import { CloudAlert, CloudCheck, CloudOff, CloudUpload, RefreshCw, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { SyncStatus } from '@/lib/storage'
import { cn } from '@/lib/utils'
import { routineActions, useRoutineStore } from '@/store/routine-store'
import { actions, useWorkoutStore } from '@/store/workout-store'

const STATUS: Record<SyncStatus, { icon: LucideIcon; title: string; tone: string }> = {
  synced: { icon: CloudCheck, title: 'Todo guardado en tu cuenta', tone: 'text-muted-foreground' },
  syncing: { icon: CloudUpload, title: 'Sincronizando…', tone: 'text-primary animate-pulse' },
  pending: { icon: CloudUpload, title: 'Cambios pendientes de subir', tone: 'text-primary' },
  offline: { icon: CloudOff, title: 'Sin conexión', tone: 'text-foreground' },
  error: { icon: CloudAlert, title: 'No se pudo sincronizar', tone: 'text-destructive' },
}

const relative = new Intl.RelativeTimeFormat('es-ES', { numeric: 'auto' })

function lastSyncedLabel(at: number | null) {
  if (at === null) return 'Aún no se ha descargado tu historial en este dispositivo.'
  const minutes = Math.round((at - Date.now()) / 60_000)
  if (minutes > -1) return 'Última sincronización: hace un momento.'
  if (minutes > -60) return `Última sincronización: ${relative.format(minutes, 'minute')}.`
  const hours = Math.round(minutes / 60)
  if (hours > -24) return `Última sincronización: ${relative.format(hours, 'hour')}.`
  return `Última sincronización: ${relative.format(Math.round(hours / 24), 'day')}.`
}

const STATUS_RANK: Record<SyncStatus, number> = { synced: 0, pending: 1, syncing: 2, offline: 3, error: 4 }

function worseStatus(a: SyncStatus, b: SyncStatus): SyncStatus {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b
}

function detail(status: SyncStatus, sessions: number, routinePending: number) {
  const parts = [
    sessions === 1 ? '1 sesión' : sessions > 1 ? `${sessions} sesiones` : null,
    routinePending ? 'la rutina' : null,
  ].filter(Boolean)
  const changes = parts.join(' y ')
  if (status === 'offline') {
    return changes
      ? `${changes} guardadas en este dispositivo. Se subirán solas al recuperar la conexión.`
      : 'Puedes seguir registrando: todo se guarda en este dispositivo.'
  }
  if (status === 'error') return changes ? `${changes} esperando. Se reintentará automáticamente.` : 'Se reintentará automáticamente.'
  if (changes) return `${changes} por subir.`
  return null
}

export function SyncIndicator() {
  const sync = useWorkoutStore((s) => s.sync)
  const routineSync = useRoutineStore((s) => s.sync)
  const primary = sync ?? routineSync
  if (!primary) return null

  const status = sync && routineSync ? worseStatus(sync.status, routineSync.status) : primary.status
  const pending = (sync?.pending ?? 0) + (routineSync?.pending ?? 0)
  const lastSyncedAt = Math.max(sync?.lastSyncedAt ?? 0, routineSync?.lastSyncedAt ?? 0) || null
  const { icon: Icon, title, tone } = STATUS[status]
  const extra = detail(status, sync?.pending ?? 0, routineSync?.pending ?? 0)

  const syncNow = async () => {
    const [logs, routine] = await Promise.all([actions.syncNow(), routineActions.syncNow()])
    const result = logs && routine ? { status: worseStatus(logs.status, routine.status) } : (logs ?? routine)
    if (!result) return
    if (result.status === 'synced') toast.success('Todo sincronizado')
    else if (result.status === 'offline') toast('Sin conexión', { description: 'Tus cambios siguen guardados en este dispositivo.' })
    else if (result.status === 'error') toast.error('No se pudo sincronizar. Se reintentará automáticamente.')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="relative" aria-label={`${title}. Ver estado de sincronización`} />}
      >
        <Icon className={cn(tone)} />
        {pending > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground tabular-nums">
            {pending > 99 ? '99+' : pending}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="space-y-1">
            <div className={cn('flex items-center gap-1.5 text-sm font-semibold text-foreground')}>
              <Icon className={cn('size-4', tone)} />
              {title}
            </div>
            {extra && <div className="font-normal">{extra}</div>}
            <div className="font-normal">{lastSyncedLabel(lastSyncedAt)}</div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={status === 'syncing'} onClick={syncNow}>
          <RefreshCw />
          Sincronizar ahora
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
