import type {
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
              <label className="field">
                <span>Bullet points (one per line)</span>
                <textarea
                  value={item.points.join('\n')}
                  onChange={(e) =>
                    patch(i, { points: splitLines(e.target.value) })
                  }
                />
              </label>
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
  }
}

/** Textarea lines to bullet points, dropping blank lines. */
function splitLines(value: string): string[] {
  return value.split('\n').map((l) => l.trim()).filter(Boolean)
}
