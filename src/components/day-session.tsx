import { useMemo, useState } from 'react'
import { CopyPlus, Dumbbell, Eraser, Layers, Timer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ExerciseCard } from '@/components/exercise-card'
import { exerciseHistory } from '@/lib/history'
import { exerciseStats, fmt, fmtCompact, logSetCount, logVolume, percentDelta } from '@/lib/metrics'
import { dateOfDay, weekNumber } from '@/lib/week'
import { cn } from '@/lib/utils'
import { activeExercises, dayIndexOf } from '@/lib/routine'
import { useRoutineStore } from '@/store/routine-store'
import { actions, findPreviousLog, logId, useWorkoutStore } from '@/store/workout-store'
import type { DayTemplate } from '@/types'

const dateFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

export function DaySession({ day, weekKey }: { day: DayTemplate; weekKey: string }) {
  const logs = useWorkoutStore((s) => s.logs)
  const log = logs[logId(weekKey, day.id)]
  const previousLog = useMemo(() => findPreviousLog(logs, weekKey, day.id), [logs, weekKey, day.id])
  const [confirm, setConfirm] = useState<'copy' | 'clear' | null>(null)

  const volume = logVolume(log)
  const prevVolume = logVolume(previousLog)
  const delta = percentDelta(volume, prevVolume)
  const sets = logSetCount(log)
  const routineDays = useRoutineStore((s) => s.days)
  const visibleExercises = activeExercises(day)
  const cardioMinutes = visibleExercises
    .filter((e) => e.kind === 'cardio')
    .reduce((acc, e) => acc + exerciseStats(log?.exercises[e.id], e.kind).totalDuration, 0)
  const dayIndex = dayIndexOf(routineDays, day.id)

  const copyPrevious = () => {
    const from = actions.copyPreviousDay(weekKey, day.id)
    if (from) toast.success(`Copiado ${day.label.toLowerCase()} de la semana ${weekNumber(from)}`)
  }

  return (
    <section className="space-y-4">
      <div
        className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-5"
        style={{ backgroundImage: `radial-gradient(120% 140% at 100% 0%, ${day.accent}22 0%, transparent 55%)` }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium capitalize text-muted-foreground">
              {dateFmt.format(dateOfDay(weekKey, dayIndex))}
            </p>
            <h2 className="mt-0.5 text-2xl font-bold tracking-tight">{day.title}</h2>
            <p className="text-sm" style={{ color: day.accent }}>
              {day.focus}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="lg"
              className="h-10"
              disabled={!previousLog}
              onClick={() => (log ? setConfirm('copy') : copyPrevious())}
              title={previousLog ? `Copiar desde la semana ${weekNumber(previousLog.weekKey)}` : 'No hay semanas anteriores'}
            >
              <CopyPlus />
              Copiar semana anterior
            </Button>
            {log && (
              <Button
                variant="outline"
                size="icon-lg"
                className="size-10"
                aria-label="Vaciar día"
                onClick={() => setConfirm('clear')}
              >
                <Eraser />
              </Button>
            )}
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-2">
          <Stat icon={<Dumbbell className="size-3.5" />} label="Volumen" value={`${fmtCompact(volume)} kg`}>
            {delta != null && (
              <span className={cn('text-[11px] font-semibold', delta >= 0 ? 'text-primary' : 'text-destructive')}>
                {delta >= 0 ? '+' : ''}
                {fmt(delta)}%
              </span>
            )}
          </Stat>
          <Stat icon={<Layers className="size-3.5" />} label="Series" value={String(sets)} />
          <Stat icon={<Timer className="size-3.5" />} label="Cardio" value={`${fmt(cardioMinutes)} min`} />
        </dl>
        {previousLog && (
          <p className="mt-3 text-xs text-muted-foreground">
            Referencia: semana {weekNumber(previousLog.weekKey)} · {fmtCompact(prevVolume)} kg · {logSetCount(previousLog)}{' '}
            series. Los valores en gris dentro de cada campo son los de esa sesión.
          </p>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {visibleExercises.map((ex, i) => (
          <ExerciseCard
            key={ex.id}
            index={i}
            exercise={ex}
            weekKey={weekKey}
            day={day.id}
            accent={day.accent}
            sets={log?.exercises[ex.id] ?? EMPTY}
            previous={
              previousLog?.exercises[ex.id]
                ? { weekKey: previousLog.weekKey, sets: previousLog.exercises[ex.id] }
                : undefined
            }
            history={exerciseHistory(logs, ex.id, ex.kind)}
          />
        ))}
      </div>

      <ConfirmDialog
        open={confirm === 'copy'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="¿Sobrescribir la sesión?"
        description={`Ya tienes series en este ${day.label.toLowerCase()}. Se reemplazarán por las de la semana ${
          previousLog ? weekNumber(previousLog.weekKey) : ''
        }.`}
        confirmLabel="Sobrescribir"
        onConfirm={copyPrevious}
      />
      <ConfirmDialog
        open={confirm === 'clear'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="¿Vaciar este día?"
        description="Se eliminarán todas las series registradas en esta sesión. No se puede deshacer."
        confirmLabel="Vaciar día"
        destructive
        onConfirm={() => {
          actions.clearDay(weekKey, day.id)
          toast('Sesión vaciada')
        }}
      />
    </section>
  )
}

const EMPTY: never[] = []

function Stat({
  icon,
  label,
  value,
  children,
}: {
  icon: React.ReactNode
  label: string
  value: string
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-xl bg-background/50 px-3 py-2.5">
      <dt className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 flex items-baseline gap-1.5">
        <span className="text-lg font-bold tabular-nums">{value}</span>
        {children}
      </dd>
    </div>
  )
}
