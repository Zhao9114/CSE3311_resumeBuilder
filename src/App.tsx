import { useCallback, useState } from 'react'
import TopBar, { type ViewKey } from './components/TopBar'
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

  return (
    <>
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
    </>
  )
}
