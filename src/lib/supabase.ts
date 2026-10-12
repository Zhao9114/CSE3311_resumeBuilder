import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

/**
 * True when both env vars are present. Without them the app runs in demo
 * mode on the in-memory stores, exactly as in iteration 1, so a fresh clone
 * works before anyone has Supabase credentials.
 */
export const isSupabaseConfigured = url !== '' && key !== ''

/**
 * Everything in a Vite bundle is public, so the only key that may ever be
 * here is the anon / publishable one — row-level security is what actually
 * protects the data. A service_role or secret key would bypass RLS for
 * anyone who opens dev tools, so refuse to start rather than ship it.
 */
export function assertPublicKey(candidate: string): void {
  if (candidate.startsWith('sb_secret_')) {
    throw new Error(
      'VITE_SUPABASE_ANON_KEY is a secret key. Use the publishable (anon) key instead.',
    )
  }
  const parts = candidate.split('.')
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
      if (payload?.role === 'service_role') {
        throw new Error(
          'VITE_SUPABASE_ANON_KEY is the service_role key. Use the anon key instead.',
        )
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('VITE_SUPABASE_ANON_KEY')) throw e
      // Not a decodable JWT — nothing to check.
    }
  }
}

let client: SupabaseClient | null = null

/** The shared client. Only call this when `isSupabaseConfigured` is true. */
export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
  }
  if (!client) {
    assertPublicKey(key)
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  }
  return client
}
