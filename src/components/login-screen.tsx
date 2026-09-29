import { useState, type FormEvent } from 'react'
import { AlertTriangle, ChartLine, CloudCheck, Dumbbell, FlaskConical, Loader2, LockKeyhole, UserRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authActions, useAuthStore } from '@/store/auth-store'

export function LoginScreen() {
  const mode = useAuthStore((s) => s.mode)
  const error = useAuthStore((s) => s.error)

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[max(env(safe-area-inset-top),1.5rem)]">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Dumbbell className="size-7" />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight">Entra en FitTrack</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu rutina semanal, tus series y tus récords, guardados en tu propia cuenta.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-card p-5">
          {error && (
            <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <button type="button" aria-label="Cerrar aviso" onClick={authActions.dismissError}>
                <X className="size-4" />
              </button>
            </div>
          )}
          {mode === 'supabase' ? <GoogleSignIn /> : <LocalSignIn />}
        </div>

        <ul className="mt-6 grid gap-3 text-sm text-muted-foreground">
          <Feature icon={LockKeyhole}>Cada usuario solo ve y edita sus propias sesiones.</Feature>
          <Feature icon={CloudCheck}>Tu historial te sigue del móvil al ordenador.</Feature>
          <Feature icon={ChartLine}>Volumen, peso máximo y progreso semana a semana.</Feature>
        </ul>
      </div>
    </div>
  )
}

function Feature({ icon: Icon, children }: { icon: typeof LockKeyhole; children: string }) {
  return (
    <li className="flex items-center gap-3">
      <Icon className="size-4 shrink-0 text-primary" />
      {children}
    </li>
  )
}

function GoogleSignIn() {
  const busy = useAuthStore((s) => s.busy)
  return (
    <>
      <Button
        size="lg"
        variant="outline"
        className="h-12 w-full gap-3 text-base"
        disabled={busy}
        onClick={authActions.signInWithGoogle}
      >
        {busy ? <Loader2 className="size-5! animate-spin" /> : <GoogleLogo />}
        {busy ? 'Conectando con Google…' : 'Continuar con Google'}
      </Button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Solo usamos tu nombre, correo y foto para identificar tu cuenta.
      </p>
    </>
  )
}

function LocalSignIn() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [profiles] = useState(authActions.listLocalProfiles)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    authActions.signInLocal({ name, email })
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
        <FlaskConical className="mt-0.5 size-4 shrink-0" />
        <p>
          <strong className="font-semibold">Modo local de desarrollo.</strong> Google aún no está configurado: los perfiles
          viven solo en este navegador. Añade las claves de Supabase para activar el acceso con Google.
        </p>
      </div>

      {profiles.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Perfiles en este dispositivo</div>
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => authActions.signInLocal({ id: p.id })}
              className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
            >
              <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                <UserRound className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{p.name}</div>
                {p.email && <div className="truncate text-xs text-muted-foreground">{p.email}</div>}
              </div>
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        {profiles.length > 0 && (
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">O crea uno nuevo</div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="local-name">Nombre</Label>
          <Input id="local-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ana" autoComplete="name" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="local-email">Correo (opcional)</Label>
          <Input
            id="local-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ana@ejemplo.com"
            autoComplete="email"
          />
        </div>
        <Button type="submit" size="lg" className="h-11 w-full" disabled={!name.trim()}>
          Entrar
        </Button>
      </form>
    </div>
  )
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
