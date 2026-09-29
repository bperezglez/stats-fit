import { ChevronLeft, ChevronRight, Dumbbell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataMenu } from '@/components/data-menu'
import { SyncIndicator } from '@/components/sync-indicator'
import { UserMenu } from '@/components/user-menu'
import { currentWeekKey, shiftWeek, weekNumber, weekRangeLabel } from '@/lib/week'
import { cn } from '@/lib/utils'
import type { AuthUser } from '@/store/auth-store'

interface Props {
  user: AuthUser
  weekKey: string
  onWeekChange: (weekKey: string) => void
}

export function AppHeader({ user, weekKey, onWeekChange }: Props) {
  const thisWeek = currentWeekKey()
  const isCurrent = weekKey === thisWeek

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Dumbbell className="size-5" />
        </div>
        <span className="hidden text-lg font-bold tracking-tight sm:inline">FitTrack</span>
      </div>

      <div className="mx-auto flex items-center gap-1 rounded-xl border border-border bg-card/60 p-1">
        <Button variant="ghost" size="icon" aria-label="Semana anterior" onClick={() => onWeekChange(shiftWeek(weekKey, -1))}>
          <ChevronLeft />
        </Button>
        <button
          type="button"
          onClick={() => onWeekChange(thisWeek)}
          className="min-w-32 px-1 text-center leading-tight"
          title="Ir a la semana actual"
        >
          <div className="text-sm font-semibold">
            Semana {weekNumber(weekKey)}
            {!isCurrent && <span className="ml-1 text-[10px] font-medium text-primary">· ir a hoy</span>}
          </div>
          <div className="text-[11px] text-muted-foreground">{weekRangeLabel(weekKey)}</div>
        </button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Semana siguiente"
          onClick={() => onWeekChange(shiftWeek(weekKey, 1))}
          className={cn(weekKey >= thisWeek && 'opacity-40')}
        >
          <ChevronRight />
        </Button>
      </div>

      <div className="flex items-center">
        <SyncIndicator />
        <DataMenu weekKey={weekKey} />
        <UserMenu user={user} />
      </div>
    </div>
  )
}
