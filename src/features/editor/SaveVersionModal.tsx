import { useState } from 'react'
import Modal from '../../components/Modal'

interface SaveVersionModalProps {
  defaultLabel: string
  onSave: (label: string) => void
  onClose: () => void
}

/** Names a new resume version before it is frozen. */
export default function SaveVersionModal({ defaultLabel, onSave, onClose }: SaveVersionModalProps) {
  const [label, setLabel] = useState(defaultLabel)
  const [touched, setTouched] = useState(false)
  const labelError = touched && !label.trim() ? 'Give the version a name' : ''

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!label.trim()) return
    onSave(label.trim())
  }

  return (
    <Modal
      title="Save a version"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="version-form" className="btn btn-primary">
            Save version
          </button>
        </>
      }
    >
      <form id="version-form" onSubmit={handleSubmit} noValidate>
        <p className="pane-sub" style={{ marginTop: 0 }}>
          Freezes the resume exactly as it looks now. Later edits won’t change
          this version, so you can link it to the applications you send it with.
        </p>
        <label className="field">
          <span>Version name</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Backend-focused"
            aria-invalid={Boolean(labelError)}
            aria-describedby={labelError ? 'version-label-error' : undefined}
          />
          {labelError && (
            <span className="field-error" id="version-label-error" role="alert">
              {labelError}
            </span>
          )}
        </label>
      </form>
    </Modal>
  )
}
