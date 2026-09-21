import { useState } from 'react'
import Modal from '../../components/Modal'
import {
  APPLICATION_STATUSES,
  type Application,
  type ApplicationDraft,
  type ApplicationStatus,
  type Resume,
} from '../../types'

interface ApplicationModalProps {
  /** Present when editing; absent when adding. */
  application?: Application
  resumes: Resume[]
  onSave: (draft: ApplicationDraft) => void
  onClose: () => void
}

const today = () => new Date().toISOString().slice(0, 10)

export default function ApplicationModal({
  application,
  resumes,
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
  const [resumeId, setResumeId] = useState(
    application?.resumeId ?? resumes[0]?.id ?? '',
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
    onSave({
      employer: employer.trim(),
      role: role.trim() || '—',
      status,
      ...(status === 'Custom' ? { customStatus: customStatus.trim() } : {}),
      resumeId,
      appliedAt,
    })
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
            <span>Resume used</span>
            <select value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
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
