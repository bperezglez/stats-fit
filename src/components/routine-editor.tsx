import { useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  BookOpen,
  ChevronDown,
  Pencil,
  Plus,
  RotateCcw,
} from 'lucide-react'
import { toast } from 'sonner'
import { CatalogPicker } from '@/components/catalog-picker'
import { CatalogPreviewButton, CatalogThumbnail } from '@/components/catalog-media'
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
} from '@/lib/routine'
import { cn } from '@/lib/utils'
import { routineActions, useRoutineStore } from '@/store/routine-store'
import type { DayId, DayTemplate, ExerciseKind, ExerciseTemplate } from '@/types'

const KIND_LABELS: Record<ExerciseKind, string> = {
  strength: 'Fuerza',
  timed: 'Tiempo',
  cardio: 'Cardio',
}

export default function RoutineEditor() {
  const days = useRoutineStore((s) => s.days)
  const [expandedDay, setExpandedDay] = useState<DayId | null>('lunes')
  const [catalogDay, setCatalogDay] = useState<{ id: DayId; label: string } | null>(null)
  const [editTarget, setEditTarget] = useState<{ dayId: DayId; exercise: ExerciseTemplate } | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetPhrase, setResetPhrase] = useState('')

  const resetReady = resetPhrase.trim().toUpperCase() === 'RESTAURAR'

  return (
    <section className="space-y-4 pb-4">
      <Card>
        <CardHeader>
          <CardTitle>Mi rutina</CardTitle>
          <CardDescription>
            Edita los ejercicios de lunes a viernes. Los ejercicios archivados desaparecen de la sesión diaria pero
            conservan tu historial.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-3">
        {days.map((day) => (
          <DayRoutineCard
            key={day.id}
            day={day}
            expanded={expandedDay === day.id}
            onToggle={() => setExpandedDay((current) => (current === day.id ? null : day.id))}
            onEdit={(exercise) => setEditTarget({ dayId: day.id, exercise })}
            onOpenCatalog={() => setCatalogDay({ id: day.id, label: day.label })}
          />
        ))}
      </div>

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
  const active = activeExercises(day)
  const archived = archivedExercises(day)

  return (
    <Card
      className="overflow-hidden"
      style={expanded ? { backgroundImage: `radial-gradient(120% 140% at 100% 0%, ${day.accent}18 0%, transparent 55%)` } : undefined}
    >
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{day.label}</span>
            <Badge variant="secondary">{active.length} activos</Badge>
            {archived.length > 0 && <Badge variant="outline">{archived.length} archivados</Badge>}
          </div>
          <p className="mt-1 text-lg font-semibold">{day.title}</p>
          <p className="text-sm text-muted-foreground">{day.focus}</p>
        </div>
        <ChevronDown className={cn('mt-1 size-5 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <CardContent className="space-y-4 border-t border-border/60 pt-4">
          <ExerciseList
            title="Ejercicios activos"
            emptyLabel="No hay ejercicios activos este día."
            exercises={active}
            onEdit={onEdit}
            onArchive={(exercise) => {
              routineActions.archiveExercise(day.id, exercise.id)
              toast('Ejercicio archivado', { description: 'Sigue en tu historial de progreso.' })
            }}
          />

          {archived.length > 0 && (
            <ExerciseList
              title="Archivados"
              emptyLabel=""
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
    </Card>
  )
}

function ExerciseList({
  title,
  emptyLabel,
  exercises,
  archived,
  onEdit,
  onArchive,
  onRestore,
}: {
  title: string
  emptyLabel: string
  exercises: ExerciseTemplate[]
  archived?: boolean
  onEdit: (exercise: ExerciseTemplate) => void
  onArchive?: (exercise: ExerciseTemplate) => void
  onRestore?: (exercise: ExerciseTemplate) => void
}) {
  if (exercises.length === 0) {
    return emptyLabel ? <p className="text-sm text-muted-foreground">{emptyLabel}</p> : null
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <ul className="space-y-2">
        {exercises.map((exercise) => (
          <li
            key={exercise.id}
            className={cn(
              'flex items-start gap-3 rounded-xl border border-border/70 bg-background/40 p-3',
              archived && 'opacity-80',
            )}
          >
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
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Archivar ${exercise.name}`}
                  onClick={() => onArchive?.(exercise)}
                >
                  <Archive />
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
