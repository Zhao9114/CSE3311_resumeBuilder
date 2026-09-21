import { useMemo, useState } from 'react'
import { useApplications, useResume } from '../../store'
import {
  isInProgress,
  statusClass,
  statusLabel,
  type Application,
  type ApplicationDraft,
} from '../../types'
import ApplicationModal from './ApplicationModal'

/** "Aug 14" style short date, from a yyyy-mm-dd string. */
function formatApplied(iso: string): string {
  const date = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

type ModalState =
  | { mode: 'closed' }
  | { mode: 'add' }
  | { mode: 'edit'; application: Application }

export default function TrackerView() {
  const {
    applications,
    loading,
    error,
    addApplication,
    updateApplication,
    removeApplication,
  } = useApplications()
  const { resumes } = useResume()
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' })

  const stats = useMemo(
    () => [
      { label: 'Total', value: applications.length },
      { label: 'In progress', value: applications.filter(isInProgress).length },
      {
        label: 'Interviews',
        value: applications.filter((a) => a.status === 'Interview').length,
      },
      {
        label: 'Offers',
        value: applications.filter((a) => a.status === 'Accepted').length,
      },
    ],
    [applications],
  )

  const resumeTitle = (id: string) =>
    resumes.find((r) => r.id === id)?.title ?? '—'

  function handleSave(draft: ApplicationDraft) {
    if (modal.mode === 'edit') updateApplication(modal.application.id, draft)
    else addApplication(draft)
    setModal({ mode: 'closed' })
  }

  return (
    <main className="tracker">
      <div className="pane-head">
        <div>
          <h1 className="pane-title">Applications</h1>
          <p className="pane-sub">
            {loading
              ? 'Loading…'
              : `${applications.length} application${
                  applications.length === 1 ? '' : 's'
                } tracked`}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setModal({ mode: 'add' })}
        >
          Add application
        </button>
      </div>

      {error && <p className="error-banner">{error}</p>}

      <div className="stat-row">
        {stats.map((s) => (
          <div className="stat" key={s.label}>
            <div className="stat-num">{loading ? '—' : s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="table-wrap" style={{ padding: 16 }} aria-busy="true">
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      ) : applications.length === 0 ? (
        <div className="empty">
          <h3>No applications yet</h3>
          <p>Track where you have applied and how each one is going.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModal({ mode: 'add' })}
          >
            Add your first application
          </button>
        </div>
      ) : (
        // tabIndex makes the scroll area reachable by keyboard when the
        // table overflows on narrow screens.
        <div
          className="table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Applications table"
        >
          <table className="apps">
            <caption className="visually-hidden">
              Tracked job applications
            </caption>
            <thead>
              <tr>
                <th scope="col">Employer</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Resume used</th>
                <th scope="col">Applied</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id}>
                  <td className="app-employer">{app.employer}</td>
                  <td>{app.role}</td>
                  <td>
                    <span className={`status status-${statusClass(app)}`}>
                      {statusLabel(app)}
                    </span>
                  </td>
                  <td className="app-resume">{resumeTitle(app.resumeId)}</td>
                  <td className="app-date">{formatApplied(app.appliedAt)}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="row-btn"
                        onClick={() => setModal({ mode: 'edit', application: app })}
                      >
                        Edit
                        <span className="visually-hidden">
                          {` ${app.employer} ${app.role}`}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="row-btn is-danger"
                        onClick={() => removeApplication(app.id)}
                      >
                        Delete
                        <span className="visually-hidden">
                          {` ${app.employer} ${app.role}`}
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal.mode !== 'closed' && (
        <ApplicationModal
          application={modal.mode === 'edit' ? modal.application : undefined}
          resumes={resumes}
          onSave={handleSave}
          onClose={() => setModal({ mode: 'closed' })}
        />
      )}
    </main>
  )
}
