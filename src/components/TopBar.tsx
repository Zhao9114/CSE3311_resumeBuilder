export type ViewKey = 'builder' | 'tracker'

interface TopBarProps {
  view: ViewKey
  onViewChange: (view: ViewKey) => void
  onExport: () => void
  onToggleAssistant: () => void
  assistantOpen: boolean
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
        <span className="demo-pill">Demo data</span>
      </div>
    </header>
  )
}
