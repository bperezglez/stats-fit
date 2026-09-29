import { lazy, Suspense, useEffect, useState } from 'react'
import { AlertTriangle, ChartColumn, ClipboardList, ListChecks, RotateCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AppHeader } from '@/components/app-header'
import { AuthGate } from '@/components/auth-gate'
import { DaySession } from '@/components/day-session'
import { DayTabs } from '@/components/day-tabs'
import { enabledDays } from '@/lib/routine'
import { currentWeekKey, todayDayId } from '@/lib/week'
import { useAuthStore, type AuthUser } from '@/store/auth-store'
import { flushRoutineWrites, routineActions, useRoutineStore } from '@/store/routine-store'
import { actions, flushPendingWrites, useWorkoutStore } from '@/store/workout-store'
import type { DayId } from '@/types'

const ProgressView = lazy(() => import('@/components/progress-view'))
const RoutineEditor = lazy(() => import('@/components/routine-editor'))

type View = 'session' | 'progress' | 'routine'

export default function App() {
  return (
    <>
      <AuthGate>{(user) => <Workspace key={user.id} user={user} />}</AuthGate>
      <Toaster position="bottom-center" />
    </>
  )
}

function Workspace({ user }: { user: AuthUser }) {
  const authMode = useAuthStore((s) => s.mode)
  const workoutStatus = useWorkoutStore((s) => s.status)
  const routineStatus = useRoutineStore((s) => s.status)
  const workoutError = useWorkoutStore((s) => s.error)
  const routineError = useRoutineStore((s) => s.error)
  const dayById = useRoutineStore((s) => s.dayById)
  const routineNotice = useRoutineStore((s) => s.notice)
  const enabled = enabledDays(useRoutineStore((s) => s.days))
  const status = workoutStatus === 'loading' || routineStatus === 'loading' ? 'loading' : workoutStatus
  const error = workoutError ?? routineError
  const [weekKey, setWeekKey] = useState(currentWeekKey)
  const [day, setDay] = useState<DayId>(() => todayDayId() ?? 'lunes')
  const [view, setView] = useState<View>('session')
  const selectedDay = enabled.find((d) => d.id === day) ?? enabled[0]

  useEffect(() => {
    void routineActions.init(user.id)
    void actions.init(user.id)
  }, [user.id])

  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden') {
        flushPendingWrites()
        void flushRoutineWrites()
      }
    }
    document.addEventListener('visibilitychange', flush)
    window.addEventListener('pagehide', () => {
      flushPendingWrites()
      void flushRoutineWrites()
    })
    return () => {
      document.removeEventListener('visibilitychange', flush)
      window.removeEventListener('pagehide', flushPendingWrites)
    }
  }, [])

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl space-y-3 px-3 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] sm:px-6">
          <AppHeader user={user} weekKey={weekKey} onWeekChange={setWeekKey} />
          <div className="flex items-center gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as View)} className="w-full">
              <TabsList className="h-9! w-full">
                <TabsTrigger value="session">
                  <ClipboardList />
                  Sesión
                </TabsTrigger>
                <TabsTrigger value="progress">
                  <ChartColumn />
                  Progreso
                </TabsTrigger>
                <TabsTrigger value="routine">
                  <ListChecks />
                  Mi rutina
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          {view === 'session' && selectedDay && <DayTabs weekKey={weekKey} value={selectedDay.id} onChange={setDay} />}
          {view === 'session' && !selectedDay && status === 'ready' && (
            <p className="text-sm text-muted-foreground">No hay días activos. Actívalos en Mi rutina.</p>
          )}
        </div>
      </header>

      <main className="pb-safe mx-auto max-w-5xl px-3 pt-4 sm:px-6">
        {routineNotice && status === 'ready' && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
            <AlertTriangle className="size-4 shrink-0 text-primary" />
            <span className="flex-1">{routineNotice}</span>
            <button type="button" aria-label="Cerrar aviso" onClick={() => routineActions.dismissNotice()}>
              <X className="size-4" />
            </button>
          </div>
        )}

        {error && status === 'ready' && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="size-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              aria-label="Cerrar aviso"
              onClick={() => {
                actions.dismissError()
                routineActions.dismissError()
              }}
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {status === 'loading' && <LoadingSkeleton />}

        {status === 'error' && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-center">
            <AlertTriangle className="mx-auto size-8 text-destructive" />
            <h2 className="mt-2 font-semibold">No se pudo cargar tus datos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {error}{' '}
              {authMode === 'supabase'
                ? 'Comprueba tu conexión e inténtalo de nuevo.'
                : 'Comprueba que el navegador no esté en modo privado estricto.'}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                void actions.retry()
                void routineActions.retry()
              }}
            >
              <RotateCw />
              Reintentar
            </Button>
          </div>
        )}

        {status === 'ready' && view === 'session' && selectedDay && (
          <DaySession key={`${weekKey}-${selectedDay.id}`} day={dayById[selectedDay.id]} weekKey={weekKey} />
        )}

        {status === 'ready' && view === 'progress' && (
          <Suspense fallback={<LoadingSkeleton />}>
            <ProgressView weekKey={weekKey} />
          </Suspense>
        )}

        {status === 'ready' && view === 'routine' && (
          <Suspense fallback={<LoadingSkeleton />}>
            <RoutineEditor />
          </Suspense>
        )}

        <footer className="py-8 text-center text-xs text-muted-foreground">
          {authMode === 'supabase'
            ? 'Tus datos se guardan en tu cuenta y solo tú puedes verlos.'
            : 'Modo local: cada perfil guarda sus datos por separado en este dispositivo.'}{' '}
          Exporta un JSON desde el menú ⋮ para tener copia.
        </footer>
      </main>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Cargando">
      <div className="h-40 animate-pulse rounded-2xl bg-card" />
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-2xl bg-card" />
        ))}
      </div>
    </div>
  )
}
