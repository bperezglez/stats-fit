import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CalendarCheck, Dumbbell, Layers, Timer, Trophy } from 'lucide-react'
import { exerciseStats, fmt, fmtCompact, logSetCount, logVolume, percentDelta } from '@/lib/metrics'
import { shiftWeek, weekNumber, weekRangeLabel } from '@/lib/week'
import { cn } from '@/lib/utils'
import { useRoutineStore } from '@/store/routine-store'
import { logId, useWorkoutStore } from '@/store/workout-store'
import type { DayId, DayTemplate, ExerciseTemplate, WorkoutLog } from '@/types'

const WEEKS = 12
const axisTick = { fill: '#8b8d98', fontSize: 11 }

function cardioMinutes(
  log: WorkoutLog | undefined,
  exerciseById: Record<string, ExerciseTemplate & { day: DayId }>,
) {
  if (!log) return 0
  return Object.entries(log.exercises).reduce((acc, [exId, sets]) => {
    const ex = exerciseById[exId]
    return ex?.kind === 'cardio' ? acc + exerciseStats(sets, 'cardio').totalDuration : acc
  }, 0)
}

function weekSummary(
  logs: Record<string, WorkoutLog>,
  weekKey: string,
  days: DayTemplate[],
  exerciseById: Record<string, ExerciseTemplate & { day: DayId }>,
) {
  let volume = 0
  let sets = 0
  let cardio = 0
  let sessions = 0
  const byDay = {} as Record<DayId, number>
  for (const d of days) {
    const log = logs[logId(weekKey, d.id)]
    const v = logVolume(log)
    byDay[d.id] = v
    volume += v
    sets += logSetCount(log)
    cardio += cardioMinutes(log, exerciseById)
    if (log && logSetCount(log) > 0) sessions++
  }
  return { weekKey, label: `S${weekNumber(weekKey)}`, volume, sets, cardio, sessions, ...byDay }
}

export default function ProgressView({ weekKey }: { weekKey: string }) {
  const logs = useWorkoutStore((s) => s.logs)
  const days = useRoutineStore((s) => s.days)
  const dayById = useRoutineStore((s) => s.dayById)
  const exerciseById = useRoutineStore((s) => s.exerciseById)

  const weeks = useMemo(
    () =>
      Array.from({ length: WEEKS }, (_, i) =>
        weekSummary(logs, shiftWeek(weekKey, i - WEEKS + 1), days, exerciseById),
      ),
    [logs, weekKey, days, exerciseById],
  )
  const current = weeks.at(-1)!
  const previous = weeks.at(-2)!

  const records = useMemo(() => {
    const best = new Map<string, { weight: number; weekKey: string; reps: number }>()
    for (const log of Object.values(logs)) {
      if (log.weekKey > weekKey) continue
      for (const [exId, sets] of Object.entries(log.exercises)) {
        if (exerciseById[exId]?.kind !== 'strength') continue
        for (const s of sets) {
          if (!s.weight || !s.reps) continue
          const prev = best.get(exId)
          if (!prev || s.weight > prev.weight || (s.weight === prev.weight && s.reps > prev.reps)) {
            best.set(exId, { weight: s.weight, reps: s.reps, weekKey: log.weekKey })
          }
        }
      }
    }
    return [...best.entries()]
      .map(([exId, r]) => ({ exercise: exerciseById[exId], ...r }))
      .filter((r) => r.exercise)
      .sort((a, b) => b.weekKey.localeCompare(a.weekKey) || b.weight - a.weight)
  }, [logs, weekKey, exerciseById])

  const hasAnyData = Object.keys(logs).length > 0

  if (!hasAnyData) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Dumbbell className="size-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">Todavía no hay progreso que mostrar</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Registra tus series en la pestaña Sesión. Cada semana que completes aparecerá aquí con su volumen, cardio y
          récords.
        </p>
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={<Dumbbell className="size-4" />}
          label="Volumen semanal"
          value={`${fmtCompact(current.volume)} kg`}
          delta={percentDelta(current.volume, previous.volume)}
        />
        <KpiCard
          icon={<CalendarCheck className="size-4" />}
          label="Sesiones"
          value={`${current.sessions}/${days.length}`}
          hint={
            current.sessions === days.length
              ? 'Semana completa'
              : `${days.length - current.sessions} pendientes`
          }
        />
        <KpiCard
          icon={<Layers className="size-4" />}
          label="Series"
          value={String(current.sets)}
          delta={percentDelta(current.sets, previous.sets)}
        />
        <KpiCard
          icon={<Timer className="size-4" />}
          label="Cardio"
          value={`${fmt(current.cardio)} min`}
          delta={percentDelta(current.cardio, previous.cardio)}
        />
      </div>

      <ChartCard title="Volumen total por semana" subtitle="kg levantados (reps × peso), desglosado por día">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weeks} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} />
            <YAxis tickLine={false} axisLine={false} width={48} tick={axisTick} tickFormatter={(v: number) => fmtCompact(v)} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as (typeof weeks)[number] | undefined
                if (!active || !p) return null
                return (
                  <TooltipBox title={`Semana ${weekNumber(p.weekKey)}`} subtitle={weekRangeLabel(p.weekKey)}>
                    {days.map((d) => (
                      <div key={d.id} className="flex justify-between gap-4">
                        <span style={{ color: d.accent }}>{d.label}</span>
                        <span className="tabular-nums">{fmt(p[d.id] ?? 0)} kg</span>
                      </div>
                    ))}
                    <div className="mt-1 flex justify-between gap-4 border-t border-border pt-1 font-semibold">
                      <span>Total</span>
                      <span className="tabular-nums">{fmt(p.volume)} kg</span>
                    </div>
                  </TooltipBox>
                )
              }}
            />
            {days.map((d, i) => (
              <Bar
                key={d.id}
                dataKey={d.id}
                stackId="v"
                fill={d.accent}
                radius={i === days.length - 1 ? [4, 4, 0, 0] : 0}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Minutos de cardio" subtitle="Suma semanal de cinta, bici y HIIT">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeks} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} />
              <YAxis tickLine={false} axisLine={false} width={40} tick={axisTick} />
              <Tooltip
                cursor={{ stroke: 'rgba(255,255,255,0.15)' }}
                content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as (typeof weeks)[number] | undefined
                  if (!active || !p) return null
                  return (
                    <TooltipBox title={`Semana ${weekNumber(p.weekKey)}`} subtitle={weekRangeLabel(p.weekKey)}>
                      <span className="font-semibold text-sky-400">{fmt(p.cardio)} min</span>
                    </TooltipBox>
                  )
                }}
              />
              <Line
                type="monotone"
                dataKey="cardio"
                stroke="#38bdf8"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#38bdf8', strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Trophy className="size-4 text-amber-400" />
            <h3 className="font-semibold">Récords de peso</h3>
          </div>
          <p className="text-xs text-muted-foreground">Mejor serie por ejercicio hasta la semana {weekNumber(weekKey)}</p>
          {records.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Aún no hay series con peso registradas.</p>
          ) : (
            <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto pr-1">
              {records.map((r) => (
                <li key={r.exercise.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/40">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: dayById[r.exercise.day].accent }} />
                  <span className="min-w-0 flex-1 truncate text-sm">{r.exercise.name}</span>
                  <span className="text-sm font-bold tabular-nums">{fmt(r.weight)} kg</span>
                  <span className="w-14 text-right text-xs text-muted-foreground tabular-nums">
                    ×{r.reps} · S{weekNumber(r.weekKey)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}

function KpiCard({
  icon,
  label,
  value,
  delta,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  delta?: number | null
  hint?: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {delta != null ? (
        <div className={cn('text-xs font-semibold', delta >= 0 ? 'text-primary' : 'text-destructive')}>
          {delta >= 0 ? '+' : ''}
          {fmt(delta)}% vs semana anterior
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">{hint ?? 'Sin datos de la semana anterior'}</div>
      )}
    </div>
  )
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
      <div className="mt-3 h-56 w-full">{children}</div>
    </div>
  )
}

function TooltipBox({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-w-40 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-xl">
      <div className="font-semibold">{title}</div>
      <div className="mb-1 text-muted-foreground">{subtitle}</div>
      {children}
    </div>
  )
}
