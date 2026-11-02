import { useCallback, useState } from 'react'
import { ToastProvider } from './components/Toast'
import TopBar, { type ViewKey } from './components/TopBar'
import { BuilderDndProvider } from './features/dnd/BuilderDnd'
import AssistantDrawer from './features/assistant/AssistantDrawer'
import BuilderView from './features/editor/BuilderView'
import TrackerView from './features/tracker/TrackerView'

export default function App() {
  const [view, setView] = useState<ViewKey>('builder')
  const [assistantOpen, setAssistantOpen] = useState(false)

  /**
   * Printing only ever makes sense from the builder, and the print stylesheet
   * assumes the resume paper is mounted — so switch first, then print on the
   * next frame once React has committed the builder view.
   */
  const handleExport = useCallback(() => {
    setView('builder')
    setAssistantOpen(false)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.print())
    })
  }, [])

  // One drag-and-drop context spans the builder and the assistant drawer,
  // so a suggestion can be dragged from the drawer straight into the list.
  return (
    <ToastProvider>
      <BuilderDndProvider>
        <TopBar
          view={view}
          onViewChange={setView}
          onExport={handleExport}
          onToggleAssistant={() => setAssistantOpen((v) => !v)}
          assistantOpen={assistantOpen}
        />
        <div className={assistantOpen ? 'with-assistant' : undefined}>
          {view === 'builder' ? <BuilderView /> : <TrackerView />}
        </div>
        <AssistantDrawer
          open={assistantOpen}
          onClose={() => setAssistantOpen(false)}
        />
      </BuilderDndProvider>
    </ToastProvider>
  )
}
