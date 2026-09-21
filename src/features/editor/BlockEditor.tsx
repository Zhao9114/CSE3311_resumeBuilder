import { useState } from 'react'
import type {
  CustomEntry,
  EducationItem,
  ExperienceItem,
  ProjectItem,
  ResumeBlock,
  SkillGroup,
} from '../../types'

interface BlockEditorProps {
  block: ResumeBlock
  onChange: (block: ResumeBlock) => void
}

/**
 * Content form for one block. Each branch builds a complete replacement
 * block and hands it up; the parent persists it via ResumeStore.updateBlock.
 */
export default function BlockEditor({ block, onChange }: BlockEditorProps) {
  switch (block.type) {
    case 'summary':
      return (
        <label className="field">
          <span>Summary text</span>
          <textarea
            value={block.data.text}
            onChange={(e) =>
              onChange({ ...block, data: { text: e.target.value } })
            }
          />
        </label>
      )

    case 'experience': {
      const { items } = block.data
      const setItems = (next: ExperienceItem[]) =>
        onChange({ ...block, data: { items: next } })
      const patch = (i: number, p: Partial<ExperienceItem>) =>
        setItems(items.map((it, j) => (j === i ? { ...it, ...p } : it)))

      return (
        <>
          {items.map((item, i) => (
            <fieldset className="sub-item" key={i}>
              <legend className="visually-hidden">Role {i + 1}</legend>
              <label className="field">
                <span>Role</span>
                <input
                  value={item.role}
                  onChange={(e) => patch(i, { role: e.target.value })}
                />
              </label>
              <div className="field-row">
                <label className="field">
                  <span>Organization</span>
                  <input
                    value={item.org}
                    onChange={(e) => patch(i, { org: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Dates</span>
                  <input
                    value={item.dates}
                    onChange={(e) => patch(i, { dates: e.target.value })}
                  />
                </label>
              </div>
              <BulletsField
                points={item.points}
                onCommit={(points) => patch(i, { points })}
              />
              <button
                type="button"
                className="row-btn is-danger"
                onClick={() => setItems(items.filter((_, j) => j !== i))}
              >
                Remove role
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            className="chip"
            onClick={() =>
              setItems([
                ...items,
                { role: 'Role', org: 'Company', dates: 'Year', points: [] },
              ])
            }
          >
            + Add role
          </button>
        </>
      )
    }

    case 'skills': {
      const { groups } = block.data
      const setGroups = (next: SkillGroup[]) =>
        onChange({ ...block, data: { groups: next } })
      const patch = (i: number, p: Partial<SkillGroup>) =>
        setGroups(groups.map((g, j) => (j === i ? { ...g, ...p } : g)))

      return (
        <>
          {groups.map((group, i) => (
            <fieldset className="sub-item" key={i}>
              <legend className="visually-hidden">Skill group {i + 1}</legend>
              <div className="field-row">
                <label className="field">
                  <span>Category</span>
                  <input
                    value={group.name}
                    onChange={(e) => patch(i, { name: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Skills (comma separated)</span>
                  <input
                    value={group.items}
                    onChange={(e) => patch(i, { items: e.target.value })}
                  />
                </label>
              </div>
              <button
                type="button"
                className="row-btn is-danger"
                onClick={() => setGroups(groups.filter((_, j) => j !== i))}
              >
                Remove group
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            className="chip"
            onClick={() =>
              setGroups([...groups, { name: 'Category', items: '' }])
            }
          >
            + Add group
          </button>
        </>
      )
    }

    case 'education': {
      const { items } = block.data
      const setItems = (next: EducationItem[]) =>
        onChange({ ...block, data: { items: next } })
      const patch = (i: number, p: Partial<EducationItem>) =>
        setItems(items.map((it, j) => (j === i ? { ...it, ...p } : it)))

      return (
        <>
          {items.map((item, i) => (
            <fieldset className="sub-item" key={i}>
              <legend className="visually-hidden">Education {i + 1}</legend>
              <label className="field">
                <span>School</span>
                <input
                  value={item.school}
                  onChange={(e) => patch(i, { school: e.target.value })}
                />
              </label>
              <div className="field-row">
                <label className="field">
                  <span>Degree</span>
                  <input
                    value={item.degree}
                    onChange={(e) => patch(i, { degree: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Dates</span>
                  <input
                    value={item.dates}
                    onChange={(e) => patch(i, { dates: e.target.value })}
                  />
                </label>
              </div>
              <label className="field">
                <span>Detail</span>
                <input
                  value={item.detail}
                  onChange={(e) => patch(i, { detail: e.target.value })}
                />
              </label>
              <button
                type="button"
                className="row-btn is-danger"
                onClick={() => setItems(items.filter((_, j) => j !== i))}
              >
                Remove entry
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            className="chip"
            onClick={() =>
              setItems([
                ...items,
                { school: 'School', degree: 'Degree', dates: 'Year', detail: '' },
              ])
            }
          >
            + Add entry
          </button>
        </>
      )
    }

    case 'projects': {
      const { items } = block.data
      const setItems = (next: ProjectItem[]) =>
        onChange({ ...block, data: { items: next } })
      const patch = (i: number, p: Partial<ProjectItem>) =>
        setItems(items.map((it, j) => (j === i ? { ...it, ...p } : it)))

      return (
        <>
          {items.map((item, i) => (
            <fieldset className="sub-item" key={i}>
              <legend className="visually-hidden">Project {i + 1}</legend>
              <label className="field">
                <span>Project name</span>
                <input
                  value={item.name}
                  onChange={(e) => patch(i, { name: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Detail</span>
                <textarea
                  value={item.detail}
                  onChange={(e) => patch(i, { detail: e.target.value })}
                />
              </label>
              <button
                type="button"
                className="row-btn is-danger"
                onClick={() => setItems(items.filter((_, j) => j !== i))}
              >
                Remove project
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            className="chip"
            onClick={() =>
              setItems([...items, { name: 'Project', detail: '' }])
            }
          >
            + Add project
          </button>
        </>
      )
    }

    case 'custom': {
      const { items } = block.data
      const setItems = (next: CustomEntry[]) =>
        onChange({ ...block, data: { items: next } })
      const patch = (i: number, p: Partial<CustomEntry>) =>
        setItems(items.map((it, j) => (j === i ? { ...it, ...p } : it)))

      return (
        <>
          <label className="field">
            <span>Section title</span>
            <input
              value={block.label}
              onChange={(e) => onChange({ ...block, label: e.target.value })}
              placeholder="e.g. Certifications"
            />
          </label>

          {items.map((item, i) => (
            <fieldset className="sub-item" key={i}>
              <legend className="visually-hidden">Entry {i + 1}</legend>
              <div className="field-row">
                <label className="field">
                  <span>Name</span>
                  <input
                    value={item.name}
                    onChange={(e) => patch(i, { name: e.target.value })}
                    placeholder="e.g. AWS Solutions Architect"
                  />
                </label>
                <label className="field">
                  <span>Date or issuer</span>
                  <input
                    value={item.meta}
                    onChange={(e) => patch(i, { meta: e.target.value })}
                    placeholder="e.g. 2025"
                  />
                </label>
              </div>
              <label className="field">
                <span>Detail</span>
                <input
                  value={item.detail}
                  onChange={(e) => patch(i, { detail: e.target.value })}
                />
              </label>
              <button
                type="button"
                className="row-btn is-danger"
                onClick={() => setItems(items.filter((_, j) => j !== i))}
              >
                Remove entry
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            className="chip"
            onClick={() => setItems([...items, { name: '', meta: '', detail: '' }])}
          >
            + Add entry
          </button>
        </>
      )
    }
  }
}

/** Textarea lines to bullet points, dropping blank lines. */
function splitLines(value: string): string[] {
  return value.split('\n').map((l) => l.trim()).filter(Boolean)
}

interface BulletsFieldProps {
  points: string[]
  onCommit: (points: string[]) => void
}

/**
 * Bullet points, edited as free text.
 *
 * The stored value is a string[], so the naive version rendered
 * `points.join('\n')` and re-split on every keystroke. That fought the
 * typist: the trim removed a trailing space the instant it was typed, and
 * the blank-line filter swallowed the newline that starts the next bullet,
 * making Enter appear to do nothing.
 *
 * Instead the raw text is kept locally and the split result is still
 * committed on every change, so the live preview keeps up while the textarea
 * shows exactly what was typed.
 */
function BulletsField({ points, onCommit }: BulletsFieldProps) {
  const joined = points.join('\n')
  const [draft, setDraft] = useState<string | null>(null)

  // Fall back to the stored value when this field is not being edited, so
  // changes from elsewhere (inserting a saved block) still show up.
  const value = draft ?? joined

  return (
    <label className="field">
      <span>Bullet points (one per line)</span>
      <textarea
        value={value}
        onChange={(e) => {
          setDraft(e.target.value)
          onCommit(splitLines(e.target.value))
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  )
}
