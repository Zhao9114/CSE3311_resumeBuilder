import { useState } from 'react'
import Modal from '../../components/Modal'
import type { ResumeBlock, SavedBlockDraft } from '../../types'

interface SaveBlockModalProps {
  block: ResumeBlock
  onSave: (draft: SavedBlockDraft) => void
  onClose: () => void
}

export default function SaveBlockModal({
  block,
  onSave,
  onClose,
}: SaveBlockModalProps) {
  const [name, setName] = useState(`${block.label} — `)
  const [tags, setTags] = useState('')
  const [touched, setTouched] = useState(false)

  const nameError = touched && !name.trim() ? 'Give the saved block a name' : ''

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!name.trim()) return
    // The id is resume-scoped; a saved copy gets a fresh one on insert.
    const { id: _id, ...rest } = block
    onSave({
      name: name.trim(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      block: rest,
    })
  }

  return (
    <Modal
      title="Save block to library"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="save-block-form" className="btn btn-primary">
            Save block
          </button>
        </>
      }
    >
      <form id="save-block-form" onSubmit={handleSubmit} noValidate>
        <label className="field">
          <span>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Experience — Backend"
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? 'save-name-error' : undefined}
          />
          {nameError && (
            <span className="field-error" id="save-name-error" role="alert">
              {nameError}
            </span>
          )}
        </label>
        <label className="field">
          <span>Tags (comma separated)</span>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g. backend, go"
          />
        </label>
        <p className="pane-sub">
          Saves a copy of “{block.label}” as it is now. Later edits to the
          resume will not change the saved version.
        </p>
      </form>
    </Modal>
  )
}
