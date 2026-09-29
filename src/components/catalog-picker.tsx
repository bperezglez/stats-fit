import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { CatalogThumbnail } from '@/components/catalog-media'
import { GymVisualAttribution } from '@/components/gym-visual-attribution'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { loadCatalog } from '@/data/catalog'
import { BODY_PART_LABELS, BODY_PART_ORDER } from '@/lib/catalog/body-parts'
import { EQUIPMENT_LABELS } from '@/lib/catalog/equipment'
import { filterCatalogExercises } from '@/lib/catalog/search'
import { exerciseFromCatalog } from '@/lib/routine'
import type { CatalogBodyPart, CatalogDocument, CatalogExercise } from '@/lib/catalog/catalog-types'
import { routineActions, useRoutineStore } from '@/store/routine-store'
import type { DayId, ExerciseKind } from '@/types'

const KIND_LABELS: Record<ExerciseKind, string> = {
  strength: 'Fuerza',
  timed: 'Tiempo',
  cardio: 'Cardio',
}

interface CatalogPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dayId: DayId
  dayLabel: string
}

export function CatalogPicker({ open, onOpenChange, dayId, dayLabel }: CatalogPickerProps) {
  const exerciseById = useRoutineStore((s) => s.exerciseById)
  const [catalog, setCatalog] = useState<CatalogDocument | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [bodyPart, setBodyPart] = useState<CatalogBodyPart | 'all'>('all')
  const [equipment, setEquipment] = useState<string>('all')

  useEffect(() => {
    if (!open || catalog) return
    setLoading(true)
    setError(null)
    void loadCatalog()
      .then(setCatalog)
      .catch((err) => {
        console.error(err)
        setError('No se pudo cargar el catálogo de ejercicios.')
      })
      .finally(() => setLoading(false))
  }, [open, catalog])

  const equipmentOptions = useMemo(() => {
    if (!catalog) return []
    return [...new Set(catalog.exercises.map((item) => item.equipment))].sort()
  }, [catalog])

  const results = useMemo(() => {
    if (!catalog) return []
    return filterCatalogExercises(catalog.exercises, { query, bodyPart, equipment }).slice(0, 80)
  }, [catalog, query, bodyPart, equipment])

  const addExercise = (item: CatalogExercise) => {
    const template = exerciseFromCatalog(item)
    if (exerciseById[template.id]) {
      toast.error('Este ejercicio ya está en tu rutina', { description: item.nameEs })
      return
    }
    try {
      routineActions.addExercise(dayId, template)
      toast.success(`${item.nameEs} añadido a ${dayLabel}`)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo añadir el ejercicio')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setQuery('')
          setBodyPart('all')
          setEquipment('all')
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="flex max-h-[min(90dvh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-4 py-4">
          <DialogTitle>Catálogo de ejercicios</DialogTitle>
          <DialogDescription>Añadir a {dayLabel}.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 border-b border-border px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre, músculo, equipamiento…"
              className="pl-9"
              autoFocus
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="catalog-body-part">Zona</Label>
              <select
                id="catalog-body-part"
                value={bodyPart}
                onChange={(event) => setBodyPart(event.target.value as CatalogBodyPart | 'all')}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="all">Todas</option>
                {BODY_PART_ORDER.map((part) => (
                  <option key={part} value={part}>
                    {BODY_PART_LABELS[part]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="catalog-equipment">Equipamiento</Label>
              <select
                id="catalog-equipment"
                value={equipment}
                onChange={(event) => setEquipment(event.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="all">Todos</option>
                {equipmentOptions.map((slug) => (
                  <option key={slug} value={slug}>
                    {EQUIPMENT_LABELS[slug] ?? slug}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando catálogo…
            </div>
          )}

          {!loading && error && (
            <p className="px-2 py-8 text-center text-sm text-destructive">{error}</p>
          )}

          {!loading && !error && catalog && results.length === 0 && (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">Ningún ejercicio coincide con la búsqueda.</p>
          )}

          {!loading && !error && results.length > 0 && (
            <ul className="space-y-1">
              {results.map((item) => {
                const inRoutine = Boolean(exerciseById[exerciseFromCatalog(item).id])
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={inRoutine}
                      onClick={() => addExercise(item)}
                      className="flex w-full items-start gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CatalogThumbnail thumb={item.thumb} alt={item.nameEs} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{item.nameEs}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {item.bodyPartLabel} · {item.equipmentLabel} · {item.target}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <Badge variant="secondary">{KIND_LABELS[item.kind]}</Badge>
                          {inRoutine && <Badge variant="outline">En tu rutina</Badge>}
                        </div>
                      </div>
                      {!inRoutine && <Plus className="mt-0.5 size-4 shrink-0 text-primary" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {!loading && !error && catalog && results.length === 80 && (
            <p className="px-2 py-2 text-center text-xs text-muted-foreground">Mostrando los primeros 80 resultados. Afina la búsqueda.</p>
          )}
        </div>

        <div className="border-t border-border px-4 py-3">
          <GymVisualAttribution />
        </div>
      </DialogContent>
    </Dialog>
  )
}
