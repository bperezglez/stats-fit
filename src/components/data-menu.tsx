import { useRef, useState } from 'react'
import { CalendarRange, Download, EllipsisVertical, Trash2, Upload } from 'lucide-react'
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
import { ConfirmDialog } from '@/components/confirm-dialog'
import { weekNumber } from '@/lib/week'
import { cn } from '@/lib/utils'
import { actions, useWorkoutStore } from '@/store/workout-store'

export function DataMenu({ weekKey }: { weekKey: string }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<unknown>(null)
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge')
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmCopyWeek, setConfirmCopyWeek] = useState(false)
  const backend = useWorkoutStore((s) => s.backend)
  const logCount = useWorkoutStore((s) => Object.keys(s.logs).length)
  const weekHasData = useWorkoutStore((s) => Object.values(s.logs).some((l) => l.weekKey === weekKey))

  const exportJson = () => {
    const payload = actions.exportPayload()
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fittrack-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exportadas ${payload.logs.length} sesiones`)
  }

  const onFile = async (file: File) => {
    try {
      setPendingImport(JSON.parse(await file.text()))
      setImportMode('merge')
    } catch {
      toast.error('El archivo no es un JSON válido.')
    }
  }

  const runImport = async () => {
    try {
      const n = await actions.importPayload(pendingImport, importMode)
      toast.success(`Importadas ${n} sesiones`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo importar el archivo.')
    }
  }

  const copyWeek = () => {
    const res = actions.copyPreviousWeek(weekKey)
    if (!res) toast.error('No hay ninguna semana anterior con datos.')
    else toast.success(`Copiados ${res.days} días de la semana ${weekNumber(res.fromWeek)}`)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-lg" aria-label="Opciones de datos" />}>
          <EllipsisVertical />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Semana {weekNumber(weekKey)}</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => (weekHasData ? setConfirmCopyWeek(true) : copyWeek())}>
              <CalendarRange />
              Copiar semana anterior completa
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              Datos · {logCount} sesiones en {backend ?? '…'}
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={exportJson}>
              <Download />
              Exportar JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => fileRef.current?.click()}>
              <Upload />
              Importar JSON
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setConfirmClear(true)}>
              <Trash2 />
              Borrar todos los datos
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />

      <ConfirmDialog
        open={pendingImport != null}
        onOpenChange={(o) => !o && setPendingImport(null)}
        title="Importar copia de seguridad"
        description="Elige cómo combinar el archivo con los datos de tu cuenta."
        confirmLabel="Importar"
        destructive={importMode === 'replace'}
        onConfirm={runImport}
      >
        <div className="grid gap-2">
          {(
            [
              ['merge', 'Combinar', 'Añade las sesiones del archivo. Si coinciden semana y día, gana el archivo.'],
              ['replace', 'Reemplazar todo', 'Borra los datos actuales y deja solo los del archivo.'],
            ] as const
          ).map(([mode, title, desc]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setImportMode(mode)}
              className={cn(
                'rounded-xl border p-3 text-left transition-colors',
                importMode === mode ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/40',
              )}
            >
              <div className="text-sm font-semibold">{title}</div>
              <div className="text-xs text-muted-foreground">{desc}</div>
            </button>
          ))}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmCopyWeek}
        onOpenChange={setConfirmCopyWeek}
        title="¿Copiar la semana anterior completa?"
        description="Los días que ya tengan series en esta semana se sobrescribirán con los de la última semana registrada."
        confirmLabel="Copiar semana"
        onConfirm={copyWeek}
      />

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="¿Borrar todos los datos?"
        description="Se eliminará todo el historial de tu cuenta. Exporta un JSON antes si quieres conservarlo."
        confirmLabel="Borrar todo"
        destructive
        onConfirm={async () => {
          await actions.clearAll()
          toast('Historial borrado')
        }}
      />
    </>
  )
}
