import type { SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const isSupabaseConfigured = Boolean(url && key)

let client: Promise<SupabaseClient> | null = null

/** Loaded on demand so the local development mode never downloads the SDK. */
export function getSupabase(): Promise<SupabaseClient> {
  if (!url || !key) return Promise.reject(new Error('Supabase no está configurado'))
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url, key, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }),
  )
  return client
}
