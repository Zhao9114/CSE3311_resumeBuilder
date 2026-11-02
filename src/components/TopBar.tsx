import { useState } from 'react'
import {
  Briefcase,
  CloudAlert,
  CloudCheck,
  Download,
  FileText,
  LoaderCircle,
  LogOut,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { useSyncStatus, type SyncStatus } from '../store'
import { useOptionalAuth } from '../features/auth/AuthProvider'
import ThemeToggle from './ThemeToggle'

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

const SYNC_ICONS: Record<SyncStatus, LucideIcon> = {
  idle: CloudCheck,
  saved: CloudCheck,
  saving: LoaderCircle,
  error: CloudAlert,
}

const TABS: { key: ViewKey; label: string; icon: LucideIcon }[] = [
  { key: 'builder', label: 'Resume builder', icon: FileText },
  { key: 'tracker', label: 'Job tracker', icon: Briefcase },
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
            <tab.icon size={15} aria-hidden="true" />
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
          aria-label="Assistant"
        >
          <Sparkles size={16} aria-hidden="true" />
          <span className="btn-text">Assistant</span>
        </button>
        <button type="button" className="btn btn-ghost" onClick={onExport} aria-label="Export PDF">
          <Download size={16} aria-hidden="true" />
          <span className="btn-text">Export PDF</span>
        </button>
        <ThemeToggle />
        {auth?.user ? (
          <>
            {status && (
              <span
                className={`sync-pill sync-${status}`}
                role="status"
                aria-live="polite"
              >
                <SyncIcon status={status} />
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
              aria-label="Sign out"
            >
              <LogOut size={16} aria-hidden="true" />
              <span className="btn-text">{signingOut ? 'Signing out…' : 'Sign out'}</span>
            </button>
          </>
        ) : (
          <span className="demo-pill">Demo data</span>
        )}
      </div>
    </header>
  )
}

function SyncIcon({ status }: { status: SyncStatus }) {
  const Icon = SYNC_ICONS[status]
  return <Icon size={13} aria-hidden="true" className={status === 'saving' ? 'spin' : undefined} />
}
