import { useResume } from '../../store'

export default function BuilderView() {
  const { resume, loading } = useResume()

  return (
    <main className="builder-view">
      <section className="editor-pane">
        <div className="pane-head">
          <div>
            <h1 className="pane-title">Sections</h1>
            <p className="pane-sub">
              Drag to reorder. Toggle to show or hide on the resume.
            </p>
          </div>
        </div>
        {loading ? (
          <p className="pane-sub">Loading…</p>
        ) : (
          <ul className="block-list">
            {resume?.blocks.map((b) => (
              <li key={b.id} className="block">
                <div className="block-info">
                  <div className="block-label">{b.label}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="preview-pane">
        <div className="paper">
          <h1 className="r-name">{resume?.profile.name}</h1>
        </div>
      </section>
    </main>
  )
}
