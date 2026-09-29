import { useEffect, type ReactNode } from 'react'
import { Dumbbell, ShieldAlert } from 'lucide-react'
import { LoginScreen } from '@/components/login-screen'
import { authActions, useAuthStore, type AuthUser } from '@/store/auth-store'
import { routineActions } from '@/store/routine-store'
import { actions } from '@/store/workout-store'

/** Nothing below this component renders, or touches workout data, without a signed-in user. */
export function AuthGate({ children }: { children: (user: AuthUser) => ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const error = useAuthStore((s) => s.error)

  useEffect(() => {
    authActions.init()
  }, [])

  useEffect(() => {
    if (status === 'signed-out') {
      void actions.reset()
      routineActions.reset()
    }
  }, [status])

  if (status === 'signed-in' && user) return children(user)
  if (status === 'signed-out') return <LoginScreen />
  if (status === 'error') return <NotConfigured message={error} />
  return <Splash />
}

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center" aria-busy="true" aria-label="Comprobando tu sesión">
      <div className="flex size-14 animate-pulse items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <Dumbbell className="size-7" />
      </div>
    </div>
  )
}

function NotConfigured({ message }: { message: string | null }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-sm rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-center">
        <ShieldAlert className="mx-auto size-8 text-destructive" />
        <h1 className="mt-2 font-semibold">Acceso no disponible</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {message} Quien administre la app debe definir <code>VITE_SUPABASE_URL</code> y{' '}
          <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> al compilarla.
        </p>
      </div>
    </div>
  )
}
