import { useApplications } from '../../store'

export default function TrackerView() {
  const { applications, loading } = useApplications()

  return (
    <main className="tracker">
      <div className="pane-head">
        <div>
          <h1 className="pane-title">Applications</h1>
          <p className="pane-sub">
            {loading ? 'Loading…' : `${applications.length} applications tracked`}
          </p>
        </div>
      </div>
      <ul>
        {applications.map((a) => (
          <li key={a.id}>
            {a.employer} — {a.role}
          </li>
        ))}
      </ul>
    </main>
  )
}
