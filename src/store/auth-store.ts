import { useSyncExternalStore } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

/**
 * - supabase: Google sign-in through Supabase Auth; data lives in Postgres behind RLS.
 * - local: development fallback when Supabase is not configured. Profiles are
 *   stored in this browser only and are NOT a security boundary.
 * - unconfigured: production build without credentials; nobody can get in.
 */
export type AuthMode = 'supabase' | 'local' | 'unconfigured'

export interface AuthUser {
  id: string
  email: string | null
  name: string
  avatarUrl: string | null
}

export interface LocalProfile {
  id: string
  name: string
  email: string | null
}

type Status = 'loading' | 'signed-out' | 'signed-in' | 'error'

export interface AuthState {
  mode: AuthMode
  status: Status
  user: AuthUser | null
  error: string | null
  busy: boolean
}

const allowLocal = import.meta.env.DEV || import.meta.env.VITE_ALLOW_LOCAL_AUTH === 'true'
const mode: AuthMode = isSupabaseConfigured ? 'supabase' : allowLocal ? 'local' : 'unconfigured'

const LOCAL_PROFILES_KEY = 'fittrack:local-profiles'
const LOCAL_SESSION_KEY = 'fittrack:local-session'
const LAST_USER_KEY = 'fittrack:last-user'

let state: AuthState = {
  mode,
  status: mode === 'unconfigured' ? 'error' : 'loading',
  user: null,
  error: mode === 'unconfigured' ? 'La autenticación no está configurada en esta instalación.' : null,
  busy: false,
}
const listeners = new Set<() => void>()

function setState(patch: Partial<AuthState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useAuthStore<T>(selector: (s: AuthState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state))
}

function userFromSession(session: Session | null): AuthUser | null {
  const u = session?.user
  if (!u) return null
  const meta = u.user_metadata ?? {}
  const name = [meta.full_name, meta.name, u.email?.split('@')[0]].find(
    (v): v is string => typeof v === 'string' && v.length > 0,
  )
  const avatar = [meta.avatar_url, meta.picture].find((v): v is string => typeof v === 'string' && v.length > 0)
  return { id: u.id, email: u.email ?? null, name: name ?? 'Usuario', avatarUrl: avatar ?? null }
}

function applySession(session: Session | null) {
  const user = userFromSession(session)
  rememberUser(user)
  // Token refreshes emit a new session for the same user; keep the object stable.
  if (user && state.user?.id === user.id && state.status === 'signed-in') return
  setState({ user, status: user ? 'signed-in' : 'signed-out', busy: false })
}

/**
 * Lets the app open without a connection: when the stored access token has
 * expired offline, Supabase cannot refresh it and reports no session, even
 * though the refresh token is still valid. The data shown is only this user's
 * offline copy; nothing reaches the server until the session is refreshed.
 */
function rememberUser(user: AuthUser | null) {
  if (user) localStorage.setItem(LAST_USER_KEY, JSON.stringify(user))
  else localStorage.removeItem(LAST_USER_KEY)
}

function rememberedUser(): AuthUser | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(LAST_USER_KEY) ?? 'null') as AuthUser | null
    return parsed && typeof parsed.id === 'string' ? parsed : null
  } catch {
    return null
  }
}

const isNetworkAuthError = (err: unknown) =>
  (err as { name?: unknown })?.name === 'AuthRetryableFetchError' ||
  err instanceof TypeError ||
  (typeof navigator !== 'undefined' && navigator.onLine === false)

function oauthErrorFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const description = params.get('error_description') ?? hash.get('error_description')
  if (!description && !params.get('error') && !hash.get('error')) return null
  window.history.replaceState(null, '', window.location.pathname)
  return description ?? 'Google no autorizó el inicio de sesión.'
}

function readProfiles(): LocalProfile[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LOCAL_PROFILES_KEY) ?? '[]')
    return Array.isArray(parsed) ? (parsed as LocalProfile[]) : []
  } catch {
    return []
  }
}

function localUser(profile: LocalProfile): AuthUser {
  return { id: profile.id, email: profile.email, name: profile.name, avatarUrl: null }
}

async function initSupabase() {
  const urlError = oauthErrorFromUrl()
  try {
    const supabase = await getSupabase()
    // The initial state comes from getSession below, which tells a network failure apart from a real sign-out.
    supabase.auth.onAuthStateChange((event, session) => event !== 'INITIAL_SESSION' && applySession(session))
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    applySession(data.session)
    if (urlError) setState({ error: urlError })
  } catch (err) {
    console.error(err)
    const offlineUser = isNetworkAuthError(err) ? rememberedUser() : null
    if (offlineUser) {
      setState({ status: 'signed-in', user: offlineUser, busy: false })
      return
    }
    setState({ status: 'signed-out', error: 'No se pudo conectar con el servicio de acceso. Revisa tu conexión.' })
  }
}

function initLocal() {
  const id = localStorage.getItem(LOCAL_SESSION_KEY)
  const profile = readProfiles().find((p) => p.id === id)
  setState({ status: profile ? 'signed-in' : 'signed-out', user: profile ? localUser(profile) : null })
}

let initPromise: Promise<void> | null = null

export const authActions = {
  init() {
    if (mode === 'unconfigured') return Promise.resolve()
    initPromise ??= mode === 'supabase' ? initSupabase() : Promise.resolve(initLocal())
    return initPromise
  },

  dismissError() {
    setState({ error: null })
  },

  async signInWithGoogle() {
    if (mode !== 'supabase') return
    setState({ busy: true, error: null })
    try {
      const supabase = await getSupabase()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).href,
          queryParams: { prompt: 'select_account' },
        },
      })
      if (error) throw error
    } catch (err) {
      console.error(err)
      setState({ busy: false, error: 'No se pudo iniciar sesión con Google. Inténtalo de nuevo.' })
    }
  },

  listLocalProfiles(): LocalProfile[] {
    return mode === 'local' ? readProfiles() : []
  },

  signInLocal(input: { id?: string; name?: string; email?: string }) {
    if (mode !== 'local') return
    const profiles = readProfiles()
    let profile = input.id ? profiles.find((p) => p.id === input.id) : undefined
    if (!profile) {
      const name = input.name?.trim()
      if (!name) return
      const email = input.email?.trim().toLowerCase() || null
      profile = (email && profiles.find((p) => p.email === email)) || {
        id: crypto.randomUUID(),
        name,
        email,
      }
      if (!profiles.includes(profile)) {
        localStorage.setItem(LOCAL_PROFILES_KEY, JSON.stringify([...profiles, profile]))
      }
    }
    localStorage.setItem(LOCAL_SESSION_KEY, profile.id)
    setState({ status: 'signed-in', user: localUser(profile), error: null })
  },

  async signOut() {
    setState({ busy: true })
    try {
      if (mode === 'supabase') {
        const supabase = await getSupabase()
        const { error } = await supabase.auth.signOut({ scope: 'local' })
        if (error) throw error
        rememberUser(null)
      } else {
        localStorage.removeItem(LOCAL_SESSION_KEY)
      }
      setState({ status: 'signed-out', user: null, busy: false })
    } catch (err) {
      console.error(err)
      setState({ busy: false, error: 'No se pudo cerrar la sesión. Inténtalo de nuevo.' })
    }
  },
}
