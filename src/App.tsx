import { useCallback, useState } from 'react'
import TopBar, { type ViewKey } from './components/TopBar'
import BuilderView from './features/editor/BuilderView'
import TrackerView from './features/tracker/TrackerView'

export default function App() {
  const [view, setView] = useState<ViewKey>('builder')

  /**
   * Printing only ever makes sense from the builder, and the print stylesheet
   * assumes the resume paper is mounted — so switch first, then print on the
   * next frame once React has committed the builder view.
   */
  const handleExport = useCallback(() => {
    setView('builder')
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.print())
    })
  }, [])

  return (
    <>
      <TopBar view={view} onViewChange={setView} onExport={handleExport} />
      {view === 'builder' ? <BuilderView /> : <TrackerView />}
    </>
  )
}
