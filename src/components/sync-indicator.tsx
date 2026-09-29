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
import type { SyncState, SyncStatus } from '@/lib/storage'
import { cn } from '@/lib/utils'
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

function detail({ status, pending }: SyncState) {
  const changes = pending === 1 ? '1 sesión' : `${pending} sesiones`
  if (status === 'offline') {
    return pending
      ? `${changes} guardadas en este dispositivo. Se subirán solas al recuperar la conexión.`
      : 'Puedes seguir registrando: todo se guarda en este dispositivo.'
  }
  if (status === 'error') return `${changes} esperando. Se reintentará automáticamente.`
  if (pending) return `${changes} por subir.`
  return null
}

export function SyncIndicator() {
  const sync = useWorkoutStore((s) => s.sync)
  if (!sync) return null

  const { icon: Icon, title, tone } = STATUS[sync.status]
  const extra = detail(sync)

  const syncNow = async () => {
    const result = await actions.syncNow()
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
        {sync.pending > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground tabular-nums">
            {sync.pending > 99 ? '99+' : sync.pending}
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
            <div className="font-normal">{lastSyncedLabel(sync.lastSyncedAt)}</div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={sync.status === 'syncing'} onClick={syncNow}>
          <RefreshCw />
          Sincronizar ahora
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
