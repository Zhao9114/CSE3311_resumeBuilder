import { useState } from 'react'
import Modal from '../../components/Modal'
import {
  APPLICATION_STATUSES,
  type Application,
  type ApplicationDraft,
  type ApplicationStatus,
  type ResumeVersion,
} from '../../types'

/** Select value meaning "freeze the current resume as a new version on save". */
export const SNAPSHOT_NOW = '__snapshot_now__'

interface ApplicationModalProps {
  /** Present when editing; absent when adding. */
  application?: Application
  versions: ResumeVersion[]
  /** False until the live resume has loaded, so there is nothing to snapshot. */
  canSnapshot: boolean
  /**
   * `snapshotNow` asks the caller to save a new version first and link the
   * application to it; `draft.versionId` is ignored in that case.
   */
  onSave: (draft: ApplicationDraft, snapshotNow: boolean) => void
  onClose: () => void
}

const today = () => {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

const savedOn = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export default function ApplicationModal({
  application,
  versions,
  canSnapshot,
  onSave,
  onClose,
}: ApplicationModalProps) {
  const editing = Boolean(application)
  const [employer, setEmployer] = useState(application?.employer ?? '')
  const [role, setRole] = useState(application?.role ?? '')
  const [status, setStatus] = useState<ApplicationStatus>(
    application?.status ?? 'Applied',
  )
  const [customStatus, setCustomStatus] = useState(application?.customStatus ?? '')
  // A new application defaults to snapshotting the resume as it is now —
  // the honest answer to "which resume did I send?" when applying today.
  const [versionChoice, setVersionChoice] = useState<string>(
    application ? application.versionId ?? '' : canSnapshot ? SNAPSHOT_NOW : versions[0]?.id ?? '',
  )
  const [appliedAt, setAppliedAt] = useState(application?.appliedAt ?? today())
  const [touched, setTouched] = useState(false)

  const employerError = touched && !employer.trim() ? 'Employer is required' : ''
  const customError =
    touched && status === 'Custom' && !customStatus.trim()
      ? 'Enter a status name'
      : ''
  const valid = employer.trim() !== '' && !(status === 'Custom' && !customStatus.trim())

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!valid) return
    const snapshotNow = versionChoice === SNAPSHOT_NOW
    onSave(
      {
        employer: employer.trim(),
        role: role.trim() || '—',
        status,
        ...(status === 'Custom' ? { customStatus: customStatus.trim() } : {}),
        versionId: snapshotNow || versionChoice === '' ? null : versionChoice,
        appliedAt,
      },
      snapshotNow,
    )
  }

  return (
    <Modal
      title={editing ? 'Edit application' : 'Add application'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="application-form" className="btn btn-primary">
            {editing ? 'Save changes' : 'Save application'}
          </button>
        </>
      }
    >
      <form id="application-form" onSubmit={handleSubmit} noValidate>
        <label className="field">
          <span>Employer</span>
          <input
            value={employer}
            onChange={(e) => setEmployer(e.target.value)}
            placeholder="e.g. Stripe"
            aria-invalid={Boolean(employerError)}
            aria-describedby={employerError ? 'employer-error' : undefined}
          />
          {employerError && (
            <span className="field-error" id="employer-error" role="alert">
              {employerError}
            </span>
          )}
        </label>

        <label className="field">
          <span>Role</span>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Backend Intern"
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span>Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
            >
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value="Custom">Custom…</option>
            </select>
          </label>

          {status === 'Custom' && (
            <label className="field">
              <span>Custom status</span>
              <input
                value={customStatus}
                onChange={(e) => setCustomStatus(e.target.value)}
                placeholder="e.g. Take-home sent"
                aria-invalid={Boolean(customError)}
                aria-describedby={customError ? 'custom-error' : undefined}
              />
              {customError && (
                <span className="field-error" id="custom-error" role="alert">
                  {customError}
                </span>
              )}
            </label>
          )}
        </div>

        <div className="field-row">
          <label className="field">
            <span>Resume version sent</span>
            <select value={versionChoice} onChange={(e) => setVersionChoice(e.target.value)}>
              {canSnapshot && (
                <option value={SNAPSHOT_NOW}>Snapshot current resume now</option>
              )}
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label} — saved {savedOn(v.createdAt)}
                </option>
              ))}
              <option value="">None recorded</option>
            </select>
          </label>

          <label className="field">
            <span>Applied</span>
            <input
              type="date"
              value={appliedAt}
              onChange={(e) => setAppliedAt(e.target.value)}
            />
          </label>
        </div>
      </form>
    </Modal>
  )
}
