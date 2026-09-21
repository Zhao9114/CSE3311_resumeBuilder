import { useState } from 'react'
import type { Profile } from '../../types'

interface ProfileEditorProps {
  profile: Profile
  onChange: (patch: Partial<Profile>) => void
}

const FIELDS: { key: keyof Profile; label: string }[] = [
  { key: 'name', label: 'Full name' },
  { key: 'title', label: 'Headline' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'location', label: 'Location' },
  { key: 'links', label: 'Links' },
]

/** Collapsible header editor for the name and contact line. */
export default function ProfileEditor({ profile, onChange }: ProfileEditorProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="profile-editor">
      <button
        type="button"
        className="profile-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="profile-panel"
      >
        <span>
          <span className="block-label">{profile.name || 'Your name'}</span>
          <span className="block-meta">Name and contact details</span>
        </span>
        <span className="row-btn" aria-hidden="true">
          {open ? 'Done' : 'Edit'}
        </span>
      </button>

      {open && (
        <div className="block-panel" id="profile-panel">
          <div className="field-row">
            {FIELDS.map((field) => (
              <label className="field" key={field.key}>
                <span>{field.label}</span>
                <input
                  value={profile[field.key]}
                  onChange={(e) => onChange({ [field.key]: e.target.value })}
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
