import { useState } from 'react'
import type { ResumeVersion } from '../../types'

interface VersionsPanelProps {
  versions: ResumeVersion[]
  loading: boolean
  onRestore: (version: ResumeVersion) => void
}

function formatSaved(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Saved versions of the resume, newest first. Versions are read-only:
 * restoring copies a version's content back into the live resume and
 * leaves the version itself untouched.
 */
export default function VersionsPanel({ versions, loading, onRestore }: VersionsPanelProps) {
  // Restoring overwrites the live resume, so it takes a second click.
  const [confirmId, setConfirmId] = useState<string | null>(null)

  return (
    <section className="library versions" aria-labelledby="versions-heading">
      <div className="library-head">
        <h2 className="pane-title" id="versions-heading">
          Versions
        </h2>
        <p className="pane-sub">
          Frozen copies of this resume. Link one to an application in the tracker.
        </p>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 40 }} aria-label="Loading versions" />
      ) : versions.length === 0 ? (
        <div className="empty">
          <h3>No versions yet</h3>
          <p>Use “Save version” once the resume is ready to send.</p>
        </div>
      ) : (
        <ul className="library-list">
          {versions.map((v) => (
            <li className="library-item" key={v.id}>
              <div className="library-info">
                <div className="block-label">{v.label}</div>
                <div className="block-meta">
                  Saved {formatSaved(v.createdAt)} ·{' '}
                  {v.resume.blocks.filter((b) => b.enabled).length} sections
                </div>
              </div>
              <div className="block-actions">
                {confirmId === v.id ? (
                  <>
                    <button
                      type="button"
                      className="row-btn is-danger"
                      onClick={() => {
                        setConfirmId(null)
                        onRestore(v)
                      }}
                    >
                      Replace current resume
                    </button>
                    <button type="button" className="row-btn" onClick={() => setConfirmId(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button type="button" className="row-btn" onClick={() => setConfirmId(v.id)}>
                    Restore
                    <span className="visually-hidden">{` ${v.label}`}</span>
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
