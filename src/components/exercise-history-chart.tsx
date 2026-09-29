import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TrendingUp } from 'lucide-react'
import type { HistoryPoint } from '@/lib/history'
import { fmt } from '@/lib/metrics'
import { weekNumber, weekRangeLabel } from '@/lib/week'
import { cn } from '@/lib/utils'
import type { ExerciseTemplate } from '@/types'

interface Metric {
  key: keyof HistoryPoint
  label: string
  unit: string
}

function metricsFor(exercise: ExerciseTemplate): Metric[] {
  if (exercise.kind === 'strength') {
    return [
      { key: 'volume', label: 'Volumen', unit: 'kg' },
      { key: 'maxWeight', label: 'Peso máx.', unit: 'kg' },
      { key: 'totalReps', label: 'Reps', unit: 'reps' },
    ]
  }
  const unit = exercise.kind === 'cardio' ? 'min' : (exercise.durationUnit ?? 's')
  const metrics: Metric[] = [{ key: 'totalDuration', label: 'Tiempo total', unit }]
  if (exercise.kind === 'cardio') metrics.push({ key: 'totalDistance', label: 'Distancia', unit: 'km' })
  else metrics.push({ key: 'maxDuration', label: 'Mejor serie', unit })
  return metrics
}

interface Props {
  exercise: ExerciseTemplate
  history: HistoryPoint[]
  currentWeek: string
  accent: string
}

export default function ExerciseHistoryChart({ exercise, history, currentWeek, accent }: Props) {
  const metrics = metricsFor(exercise)
  const [metricKey, setMetricKey] = useState(metrics[0].key)
  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0]
  const data = history.slice(-12).map((p) => ({
    ...p,
    label: `S${weekNumber(p.weekKey)}`,
    value: p[metric.key] as number,
  }))
  const gradientId = `grad-${exercise.id}`

  const first = data[0]?.value ?? 0
  const last = data.at(-1)?.value ?? 0
  const best = Math.max(0, ...data.map((d) => d.value))
  const change = data.length > 1 && first > 0 ? ((last - first) / first) * 100 : null

  return (
    <div className="space-y-3 rounded-xl border border-border bg-background/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg bg-muted/60 p-0.5">
          {metrics.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetricKey(m.key)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                m.key === metric.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            Mejor: <strong className="text-foreground">{fmt(best)} {metric.unit}</strong>
          </span>
          {change != null && (
            <span className={cn('inline-flex items-center gap-1 font-semibold', change >= 0 ? 'text-primary' : 'text-destructive')}>
              <TrendingUp className={cn('size-3.5', change < 0 && 'rotate-180')} />
              {change >= 0 ? '+' : ''}
              {fmt(change)}% en {data.length} sem.
            </span>
          )}
        </div>
      </div>

      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Aún no hay registros de este ejercicio. Guarda tu primera serie para empezar la curva.
        </p>
      ) : (
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#8b8d98', fontSize: 11 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={44}
                tick={{ fill: '#8b8d98', fontSize: 11 }}
                tickFormatter={(v: number) => fmt(v)}
              />
              <Tooltip
                cursor={{ stroke: 'rgba(255,255,255,0.15)' }}
                content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as (typeof data)[number] | undefined
                  if (!active || !p) return null
                  return (
                    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-xl">
                      <div className="font-semibold">
                        Semana {weekNumber(p.weekKey)}
                        {p.weekKey === currentWeek && <span className="ml-1 text-primary">· actual</span>}
                      </div>
                      <div className="text-muted-foreground">{weekRangeLabel(p.weekKey)}</div>
                      <div className="mt-1 text-sm font-bold" style={{ color: accent }}>
                        {fmt(p.value)} {metric.unit}
                      </div>
                      <div className="text-muted-foreground">{p.sets} series</div>
                    </div>
                  )
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={accent}
                strokeWidth={2.5}
                fill={`url(#${gradientId})`}
                dot={{ r: 3, fill: accent, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      {data.length === 1 && (
        <p className="text-center text-xs text-muted-foreground">Registra otra semana para ver la tendencia.</p>
      )}
    </div>
  )
}
