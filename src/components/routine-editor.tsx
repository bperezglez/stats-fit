import { useState } from 'react'
import {
  ArchiveRestore,
  BookOpen,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { CatalogPicker } from '@/components/catalog-picker'
import { CatalogPreviewButton, CatalogThumbnail } from '@/components/catalog-media'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  activeExercises,
  archivedExercises,
  createManualExercise,
  enabledDays,
  exerciseHasLoggedSets,
  isDayEnabled,
} from '@/lib/routine'
import { cn } from '@/lib/utils'
import { routineActions, useRoutineStore } from '@/store/routine-store'
import { useWorkoutStore } from '@/store/workout-store'
import type { DayId, DayTemplate, ExerciseKind, ExerciseTemplate } from '@/types'

const KIND_LABELS: Record<ExerciseKind, string> = {
  strength: 'Fuerza',
  timed: 'Tiempo',
  cardio: 'Cardio',
}

export default function RoutineEditor() {
  const days = useRoutineStore((s) => s.days)
  const active = enabledDays(days)
  const inactive = days.filter((day) => !isDayEnabled(day))
  const [expandedDay, setExpandedDay] = useState<DayId | null>('lunes')
  const [catalogDay, setCatalogDay] = useState<{ id: DayId; label: string } | null>(null)
  const [editTarget, setEditTarget] = useState<{ dayId: DayId; exercise: ExerciseTemplate } | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetPhrase, setResetPhrase] = useState('')

  const resetReady = resetPhrase.trim().toUpperCase() === 'RESTAURAR'
  const toggleDay = (dayId: DayId) => setExpandedDay((current) => (current === dayId ? null : dayId))

  return (
    <section className="space-y-4 pb-4">
      <Card>
        <CardHeader>
          <CardTitle>Mi rutina</CardTitle>
          <CardDescription>
            Cambia el nombre de cada día, el orden de los ejercicios y oculta los días que no entrenes. Si un
            ejercicio tiene series registradas, al eliminarlo se archiva y el historial se conserva.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-3">
        {active.map((day) => (
          <DayRoutineCard
            key={day.id}
            day={day}
            expanded={expandedDay === day.id}
            onToggle={() => toggleDay(day.id)}
            onEdit={(exercise) => setEditTarget({ dayId: day.id, exercise })}
            onOpenCatalog={() => setCatalogDay({ id: day.id, label: day.label })}
          />
        ))}
      </div>

      {inactive.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Días inactivos</h2>
            <p className="text-sm text-muted-foreground">No aparecen al registrar la sesión. Puedes volver a activarlos.</p>
          </div>
          {inactive.map((day) => (
            <DayRoutineCard
              key={day.id}
              day={day}
              expanded={expandedDay === day.id}
              onToggle={() => toggleDay(day.id)}
              onEdit={(exercise) => setEditTarget({ dayId: day.id, exercise })}
              onOpenCatalog={() => setCatalogDay({ id: day.id, label: day.label })}
            />
          ))}
        </div>
      )}

      <Card className="border-destructive/30">
        <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Restaurar rutina por defecto</p>
            <p className="text-sm text-muted-foreground">
              Vuelve a la rutina inicial del gimnasio. No borra tus registros de entrenamiento.
            </p>
          </div>
          <Button variant="outline" className="shrink-0 border-destructive/40 text-destructive" onClick={() => setConfirmReset(true)}>
            <RotateCcw />
            Restaurar
          </Button>
        </CardContent>
      </Card>

      <ExerciseEditDialog
        target={editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
      />

      {catalogDay && (
        <CatalogPicker
          open
          onOpenChange={(open) => !open && setCatalogDay(null)}
          dayId={catalogDay.id}
          dayLabel={catalogDay.label}
        />
      )}

      <Dialog
        open={confirmReset}
        onOpenChange={(open) => {
          setConfirmReset(open)
          if (!open) setResetPhrase('')
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Restaurar la rutina por defecto?</DialogTitle>
            <DialogDescription>
              Se reemplazará tu rutina personalizada por la plantilla original. Tus logs de entrenamiento no se borran,
              pero algunos ejercicios del historial pueden quedar huérfanos si ya no están en la rutina.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reset-phrase">Escribe RESTAURAR para confirmar</Label>
            <Input
              id="reset-phrase"
              value={resetPhrase}
              onChange={(event) => setResetPhrase(event.target.value)}
              placeholder="RESTAURAR"
              autoComplete="off"
            />
            {!resetReady && resetPhrase.length > 0 && (
              <p className="text-xs text-muted-foreground">Debe coincidir exactamente con RESTAURAR.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReset(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!resetReady}
              onClick={() => {
                routineActions.restoreDefault()
                setResetPhrase('')
                setConfirmReset(false)
                toast.success('Rutina restaurada')
              }}
            >
              Restaurar rutina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function DayRoutineCard({
  day,
  expanded,
  onToggle,
  onEdit,
  onOpenCatalog,
}: {
  day: DayTemplate
  expanded: boolean
  onToggle: () => void
  onEdit: (exercise: ExerciseTemplate) => void
  onOpenCatalog: () => void
}) {
  const logs = useWorkoutStore((s) => s.logs)
  const active = activeExercises(day)
  const archived = archivedExercises(day)
  const enabled = isDayEnabled(day)
  const [editingMeta, setEditingMeta] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ExerciseTemplate | null>(null)
  const deleteHasHistory = pendingDelete
    ? exerciseHasLoggedSets(Object.values(logs), pendingDelete.id)
    : false

  const toggleEnabled = () => {
    try {
      routineActions.setDayEnabled(day.id, !enabled)
      toast.success(enabled ? `${day.label} oculto de la sesión` : `${day.label} visible en la sesión`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cambiar el día')
    }
  }

  const shiftExercise = (exerciseId: string, direction: -1 | 1) => {
    const visible = day.exercises
      .map((exercise, index) => ({ exercise, index }))
      .filter(({ exercise }) => !exercise.archived)
    const position = visible.findIndex(({ exercise }) => exercise.id === exerciseId)
    const target = visible[position + direction]
    if (position < 0 || !target) return
    routineActions.reorderExercises(day.id, visible[position].index, target.index)
  }

  return (
    <Card
      className={cn('overflow-hidden', !enabled && 'opacity-80')}
      style={expanded ? { backgroundImage: `radial-gradient(120% 140% at 100% 0%, ${day.accent}18 0%, transparent 55%)` } : undefined}
    >
      <div className="flex items-start gap-2 px-4 py-4">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onToggle} aria-expanded={expanded}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{day.label}</span>
            <Badge variant="secondary">{active.length} activos</Badge>
            {archived.length > 0 && <Badge variant="outline">{archived.length} archivados</Badge>}
            {!enabled && <Badge variant="outline">Inactivo</Badge>}
          </div>
          <p className="mt-1 text-lg font-semibold">{day.title}</p>
          <p className="text-sm text-muted-foreground">{day.focus || 'Sin enfoque'}</p>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {!enabled && (
            <Button variant="outline" size="sm" onClick={toggleEnabled}>
              Activar
            </Button>
          )}
          <Button variant="ghost" size="icon" aria-label={expanded ? 'Contraer día' : 'Expandir día'} onClick={onToggle}>
            <ChevronDown className={cn('transition-transform', expanded && 'rotate-180')} />
          </Button>
        </div>
      </div>

      {expanded && (
        <CardContent className="space-y-4 border-t border-border/60 pt-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditingMeta(true)}>
              <Pencil />
              Editar día
            </Button>
            {enabled && (
              <Button variant="outline" size="sm" onClick={toggleEnabled}>
                Desactivar
              </Button>
            )}
          </div>

          <ExerciseList
            title="Ejercicios activos"
            emptyLabel="No hay ejercicios activos este día."
            day={day}
            exercises={active}
            onEdit={onEdit}
            onMove={shiftExercise}
            onDelete={setPendingDelete}
          />

          {archived.length > 0 && (
            <ExerciseList
              title="Archivados"
              emptyLabel=""
              day={day}
              exercises={archived}
              archived
              onEdit={onEdit}
              onRestore={(exercise) => {
                routineActions.restoreExercise(day.id, exercise.id)
                toast.success(`${exercise.name} restaurado`)
              }}
            />
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                try {
                  const exercise = createManualExercise()
                  routineActions.addExercise(day.id, exercise)
                  onEdit(exercise)
                  toast.success('Ejercicio manual añadido')
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'No se pudo añadir el ejercicio')
                }
              }}
            >
              <Plus />
              Añadir manual
            </Button>
            <Button variant="outline" onClick={onOpenCatalog}>
              <BookOpen />
              Desde catálogo
            </Button>
          </div>
        </CardContent>
      )}

      <DayMetaDialog day={day} open={editingMeta} onOpenChange={setEditingMeta} />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={deleteHasHistory ? 'Archivar ejercicio' : 'Eliminar ejercicio'}
        description={
          pendingDelete
            ? deleteHasHistory
              ? `«${pendingDelete.name}» tiene series registradas. No se borrará: se archivará y dejará de salir en la sesión, pero el historial se conserva.`
              : `«${pendingDelete.name}» no tiene series registradas. Se eliminará de la rutina.`
            : ''
        }
        confirmLabel={deleteHasHistory ? 'Archivar' : 'Eliminar'}
        destructive={!deleteHasHistory}
        onConfirm={() => {
          if (!pendingDelete) return
          try {
            const action = routineActions.removeExercise(day.id, pendingDelete.id)
            if (action === 'archived') {
              toast('Ejercicio archivado', {
                description: 'Tiene series registradas, así que se conserva en el historial.',
              })
            } else {
              toast.success('Ejercicio eliminado de la rutina')
            }
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'No se pudo eliminar el ejercicio')
          }
        }}
      />
    </Card>
  )
}

function DayMetaDialog({
  day,
  open,
  onOpenChange,
}: {
  day: DayTemplate
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <DayMetaForm key={day.id} day={day} onClose={() => onOpenChange(false)} />}
    </Dialog>
  )
}

function DayMetaForm({ day, onClose }: { day: DayTemplate; onClose: () => void }) {
  const [label, setLabel] = useState(day.label)
  const [short, setShort] = useState(day.short)
  const [title, setTitle] = useState(day.title)
  const [focus, setFocus] = useState(day.focus)

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Editar {day.label}</DialogTitle>
        <DialogDescription>
          El identificador interno ({day.id}) no cambia, para no romper los entrenamientos ya registrados.
        </DialogDescription>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          try {
            routineActions.updateDayMeta(day.id, { label, short, title, focus })
            toast.success('Día actualizado')
            onClose()
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'No se pudo guardar el día')
          }
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_5.5rem]">
          <div className="space-y-2">
            <Label htmlFor={`day-label-${day.id}`}>Nombre del día</Label>
            <Input id={`day-label-${day.id}`} value={label} onChange={(event) => setLabel(event.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`day-short-${day.id}`}>Abreviatura</Label>
            <Input
              id={`day-short-${day.id}`}
              value={short}
              maxLength={3}
              onChange={(event) => setShort(event.target.value)}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`day-title-${day.id}`}>Título de la sesión</Label>
          <Input id={`day-title-${day.id}`} value={title} onChange={(event) => setTitle(event.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`day-focus-${day.id}`}>Enfoque</Label>
          <Input id={`day-focus-${day.id}`} value={focus} onChange={(event) => setFocus(event.target.value)} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">Guardar</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

function ExerciseList({
  title,
  emptyLabel,
  day,
  exercises,
  archived,
  onEdit,
  onMove,
  onDelete,
  onRestore,
}: {
  title: string
  emptyLabel: string
  day: DayTemplate
  exercises: ExerciseTemplate[]
  archived?: boolean
  onEdit: (exercise: ExerciseTemplate) => void
  onMove?: (exerciseId: string, direction: -1 | 1) => void
  onDelete?: (exercise: ExerciseTemplate) => void
  onRestore?: (exercise: ExerciseTemplate) => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)

  if (exercises.length === 0) {
    return emptyLabel ? <p className="text-sm text-muted-foreground">{emptyLabel}</p> : null
  }

  const dropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) return
    const from = day.exercises.findIndex((exercise) => exercise.id === dragId)
    const to = day.exercises.findIndex((exercise) => exercise.id === targetId)
    if (from < 0 || to < 0) return
    routineActions.reorderExercises(day.id, from, to)
    setDragId(null)
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {onMove && (
        <p className="text-xs text-muted-foreground">Arrastra un ejercicio o usa las flechas para cambiar el orden.</p>
      )}
      <ul className="space-y-2">
        {exercises.map((exercise, visibleIndex) => (
          <li
            key={exercise.id}
            onDragOver={(event) => {
              if (!onMove) return
              event.preventDefault()
            }}
            onDrop={(event) => {
              if (!onMove) return
              event.preventDefault()
              dropOn(exercise.id)
            }}
            className={cn(
              'flex items-start gap-2 rounded-xl border border-border/70 bg-background/40 p-3 sm:gap-3',
              archived && 'opacity-80',
              dragId === exercise.id && 'opacity-60',
            )}
          >
            {onMove && (
              <div className="flex shrink-0 items-center self-center">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Subir ${exercise.name}`}
                  disabled={visibleIndex === 0}
                  onClick={() => onMove(exercise.id, -1)}
                >
                  <ChevronUp />
                </Button>
                <button
                  type="button"
                  draggable
                  aria-label={`Arrastrar ${exercise.name}`}
                  className="cursor-grab rounded-md p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/plain', exercise.id)
                    event.dataTransfer.effectAllowed = 'move'
                    setDragId(exercise.id)
                  }}
                  onDragEnd={() => setDragId(null)}
                >
                  <GripVertical className="size-4" />
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Bajar ${exercise.name}`}
                  disabled={visibleIndex === exercises.length - 1}
                  onClick={() => onMove(exercise.id, 1)}
                >
                  <ChevronDown />
                </Button>
              </div>
            )}
            <CatalogThumbnail thumb={exercise.catalogThumb} alt={exercise.name} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{exercise.name}</p>
                <Badge variant="secondary">{KIND_LABELS[exercise.kind]}</Badge>
                {exercise.catalogId && <Badge variant="outline">Catálogo</Badge>}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{exercise.target}</p>
              {exercise.cue && <p className="mt-1 text-xs text-muted-foreground">{exercise.cue}</p>}
            </div>
            <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
              <CatalogPreviewButton
                name={exercise.name}
                thumb={exercise.catalogThumb}
                gif={exercise.catalogGif}
              />
              <Button variant="ghost" size="icon-sm" aria-label={`Editar ${exercise.name}`} onClick={() => onEdit(exercise)}>
                <Pencil />
              </Button>
              {archived ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Restaurar ${exercise.name}`}
                  onClick={() => onRestore?.(exercise)}
                >
                  <ArchiveRestore />
                </Button>
              ) : (
                <Button variant="ghost" size="sm" aria-label={`Eliminar ${exercise.name}`} onClick={() => onDelete?.(exercise)}>
                  <Trash2 />
                  Eliminar
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ExerciseEditDialog({
  target,
  onOpenChange,
}: {
  target: { dayId: DayId; exercise: ExerciseTemplate } | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      {target && (
        <ExerciseEditForm
          key={`${target.dayId}:${target.exercise.id}`}
          dayId={target.dayId}
          exercise={target.exercise}
          onClose={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  )
}

function ExerciseEditForm({
  dayId,
  exercise,
  onClose,
}: {
  dayId: DayId
  exercise: ExerciseTemplate
  onClose: () => void
}) {
  const [name, setName] = useState(exercise.name)
  const [targetText, setTargetText] = useState(exercise.target)
  const [cue, setCue] = useState(exercise.cue ?? '')
  const [kind, setKind] = useState<ExerciseKind>(exercise.kind)
  const [durationUnit, setDurationUnit] = useState<'s' | 'min'>(exercise.durationUnit ?? 's')

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Editar ejercicio</DialogTitle>
        <DialogDescription>Cambios en nombre u objetivo no afectan al historial guardado.</DialogDescription>
      </DialogHeader>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          try {
            routineActions.updateExercise(dayId, exercise.id, {
              name,
              target: targetText,
              cue,
              kind,
              ...(kind === 'timed' ? { durationUnit } : {}),
            })
            toast.success('Ejercicio actualizado')
            onClose()
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'No se pudo guardar')
          }
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="exercise-name">Nombre</Label>
          <Input id="exercise-name" value={name} onChange={(event) => setName(event.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="exercise-target">Objetivo</Label>
          <Input
            id="exercise-target"
            value={targetText}
            onChange={(event) => setTargetText(event.target.value)}
            placeholder="4 × 10-12"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="exercise-cue">Pista (opcional)</Label>
          <Input id="exercise-cue" value={cue} onChange={(event) => setCue(event.target.value)} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="exercise-kind">Tipo</Label>
            <select
              id="exercise-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as ExerciseKind)}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="strength">Fuerza</option>
              <option value="timed">Tiempo</option>
              <option value="cardio">Cardio</option>
            </select>
          </div>

          {kind === 'timed' && (
            <div className="space-y-2">
              <Label htmlFor="exercise-duration-unit">Unidad</Label>
              <select
                id="exercise-duration-unit"
                value={durationUnit}
                onChange={(event) => setDurationUnit(event.target.value as 's' | 'min')}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="s">Segundos</option>
                <option value="min">Minutos</option>
              </select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">Guardar</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
