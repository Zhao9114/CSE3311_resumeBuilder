import { useState } from 'react'
import { useSyncStatus, type SyncStatus } from '../store'
import { useOptionalAuth } from '../features/auth/AuthProvider'

export type ViewKey = 'builder' | 'tracker'

interface TopBarProps {
  view: ViewKey
  onViewChange: (view: ViewKey) => void
  onExport: () => void
  onToggleAssistant: () => void
  assistantOpen: boolean
}

const SYNC_LABELS: Record<SyncStatus, string> = {
  idle: 'All changes saved',
  saved: 'All changes saved',
  saving: 'Saving…',
  error: "Couldn't save — retrying",
}

const TABS: { key: ViewKey; label: string }[] = [
  { key: 'builder', label: 'Resume builder' },
  { key: 'tracker', label: 'Job tracker' },
]

export default function TopBar({
  view,
  onViewChange,
  onExport,
  onToggleAssistant,
  assistantOpen,
}: TopBarProps) {
  const auth = useOptionalAuth()
  const { status, flush } = useSyncStatus()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    if (!auth) return
    setSigningOut(true)
    try {
      // Get any pending resume edits into the database before the session
      // (and with it, permission to write) goes away.
      await flush()
      await auth.signOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          D
        </span>
        <span className="brand-name">Draftly</span>
      </div>

      <nav className="tabs" aria-label="Main views">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`tab${view === tab.key ? ' is-active' : ''}`}
            aria-current={view === tab.key ? 'page' : undefined}
            onClick={() => onViewChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="topbar-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onToggleAssistant}
          aria-pressed={assistantOpen}
        >
          Assistant
        </button>
        <button type="button" className="btn btn-ghost" onClick={onExport}>
          Export PDF
        </button>
        {auth?.user ? (
          <>
            {status && (
              <span
                className={`sync-pill sync-${status}`}
                role="status"
                aria-live="polite"
              >
                {SYNC_LABELS[status]}
              </span>
            )}
            <span className="account-email" title={auth.user.email}>
              {auth.user.email}
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </>
        ) : (
          <span className="demo-pill">Demo data</span>
        )}
      </div>
    </header>
  )
}
