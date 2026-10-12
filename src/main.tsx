import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { StoreProvider } from './store'
import { isSupabaseConfigured } from './lib/supabase'
import { AuthProvider } from './features/auth/AuthProvider'
import AuthGate from './features/auth/AuthGate'
import './index.css'
import './styles/templates.css'
import './styles/sprint8.css'
import './styles/iteration2.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root not found')

// With Supabase configured, everything sits behind a login and saves to the
// user's account. Without it, the app runs on in-memory demo data — handy
// for a fresh clone and for anyone without credentials.
createRoot(container).render(
  <StrictMode>
    {isSupabaseConfigured ? (
      <AuthProvider>
        <AuthGate>
          <App />
        </AuthGate>
      </AuthProvider>
    ) : (
      <StoreProvider>
        <App />
      </StoreProvider>
    )}
  </StrictMode>,
)
