import { logSetCount } from '@/lib/metrics'
import { currentWeekKey, todayDayId } from '@/lib/week'
import { cn } from '@/lib/utils'
import { useRoutineStore } from '@/store/routine-store'
import { logId, useWorkoutStore } from '@/store/workout-store'
import type { DayId } from '@/types'

interface Props {
  weekKey: string
  value: DayId
  onChange: (day: DayId) => void
}

export function DayTabs({ weekKey, value, onChange }: Props) {
  const logs = useWorkoutStore((s) => s.logs)
  const days = useRoutineStore((s) => s.days)
  const today = weekKey === currentWeekKey() ? todayDayId() : null

  return (
    <div role="tablist" aria-label="Día de la semana" className="grid grid-cols-5 gap-1.5">
      {days.map((d) => {
        const active = d.id === value
        const done = logSetCount(logs[logId(weekKey, d.id)]) > 0
        return (
          <button
            key={d.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(d.id)}
            className={cn(
              'relative flex flex-col items-center rounded-xl border px-1 py-2 transition-all',
              active ? 'border-transparent text-black' : 'border-border bg-card/60 text-foreground hover:bg-card',
            )}
            style={active ? { backgroundColor: d.accent } : undefined}
          >
            <span className="text-base font-bold leading-none sm:hidden">{d.short}</span>
            <span className="hidden text-sm font-semibold sm:inline">{d.label}</span>
            <span
              className={cn(
                'mt-1 max-w-full truncate text-[10px] leading-tight',
                active ? 'text-black/70' : 'text-muted-foreground',
              )}
            >
              {d.title}
            </span>
            {done && (
              <span
                className={cn('absolute right-1.5 top-1.5 size-1.5 rounded-full', active ? 'bg-black/70' : '')}
                style={active ? undefined : { backgroundColor: d.accent }}
                aria-label="Sesión registrada"
              />
            )}
            {today === d.id && (
              <span
                className={cn(
                  'absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-1.5 text-[9px] font-bold uppercase',
                  active ? 'bg-black text-white' : 'bg-primary text-primary-foreground',
                )}
              >
                Hoy
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
