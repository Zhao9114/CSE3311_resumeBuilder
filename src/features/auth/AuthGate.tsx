import { useMemo, type ReactNode } from 'react'
import { getSupabase } from '../../lib/supabase'
import {
  StoreProvider,
  SupabaseApplicationStore,
  SupabaseBlockLibraryStore,
  SupabaseResumeStore,
  SupabaseResumeVersionStore,
} from '../../store'
import { useAuth } from './AuthProvider'
import AuthScreen from './AuthScreen'

/**
 * Shows the sign-in screen until there is a session, then mounts the app on
 * Supabase-backed stores.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <main className="auth-screen" aria-busy="true">
        <div className="auth-card">
          <div className="skeleton" style={{ height: 28, width: '40%' }} />
          <div className="skeleton" />
        </div>
      </main>
    )
  }
  if (!user) return <AuthScreen />
  // Keyed by user: signing out and in as someone else builds fresh stores,
  // so no cached resume from the previous user can survive the switch.
  return (
    <SignedInStores key={user.id} userId={user.id}>
      {children}
    </SignedInStores>
  )
}

function SignedInStores({ userId, children }: { userId: string; children: ReactNode }) {
  const stores = useMemo(() => {
    void userId // one set of stores per user; see the key above
    const client = getSupabase()
    return {
      resumeStore: new SupabaseResumeStore(client),
      applicationStore: new SupabaseApplicationStore(client),
      blockLibraryStore: new SupabaseBlockLibraryStore(client),
      versionStore: new SupabaseResumeVersionStore(client),
    }
  }, [userId])

  return <StoreProvider {...stores}>{children}</StoreProvider>
}
