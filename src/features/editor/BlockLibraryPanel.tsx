import { useMemo, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { Check, GripVertical, Layers, Pencil, X } from 'lucide-react'
import type { DragData } from '../dnd/dragData'
import { SECTION_LABELS, type ResumeBlock, type SavedBlock, type SectionType } from '../../types'
import { SECTION_ICONS } from './sectionIcons'

interface BlockLibraryPanelProps {
  savedBlocks: SavedBlock[]
  loading: boolean
  onInsert: (block: Omit<ResumeBlock, 'id'>) => void
  onRemove: (id: string) => void
  onRename: (id: string, name: string) => void
  /** Saves every entry of the live resume that is not in the bank yet. */
  onAddAll: () => void
}

const ORDER: SectionType[] = ['summary', 'experience', 'projects', 'education', 'skills', 'custom']

/**
 * The block bank: every role, project, education entry and skill group the
 * user has, saved once. Inserting copies an entry into the resume (joining
 * its section if it already exists); the ATS check's "Build tailored resume"
 * picks from here automatically.
 */
export default function BlockLibraryPanel({
  savedBlocks,
  loading,
  onInsert,
  onRemove,
  onRename,
  onAddAll,
}: BlockLibraryPanelProps) {
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const tags = useMemo(() => {
    const all = new Set<string>()
    for (const s of savedBlocks) for (const t of s.tags) all.add(t)
    for (const type of ORDER) all.delete(type) // section names are already the group headings
    return [...all].sort()
  }, [savedBlocks])

  const shown = activeTag ? savedBlocks.filter((s) => s.tags.includes(activeTag)) : savedBlocks
  const groups = ORDER.map((type) => ({ type, items: shown.filter((s) => s.block.type === type) })).filter(
    (g) => g.items.length > 0,
  )

  return (
    <section className="library" aria-labelledby="library-heading">
      <div className="library-head">
        <h2 className="pane-title" id="library-heading">
          Block bank
        </h2>
        <p className="pane-sub">
          Save each role, project and skill group once. Insert or drag one in, or let
          “Build tailored resume” in the ATS check pick the best ones for a job.
        </p>
        <button type="button" className="btn btn-ghost library-add-all" onClick={onAddAll}>
          <Layers size={15} aria-hidden="true" />
          Add all entries from this resume
        </button>
      </div>

      {tags.length > 0 && (
        <div className="library-tags" role="group" aria-label="Filter by tag">
          <button type="button" className="chip" aria-pressed={activeTag === null} onClick={() => setActiveTag(null)}>
            All
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="chip"
              aria-pressed={activeTag === tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="skeleton" style={{ height: 40 }} aria-label="Loading block bank" />
      ) : savedBlocks.length === 0 ? (
        <div className="empty">
          <h3>Your bank is empty</h3>
          <p>Press “Add all entries” above, or “Save to bank” on any role or project.</p>
        </div>
      ) : shown.length === 0 ? (
        <div className="empty">
          <p>No entries tagged “{activeTag}”.</p>
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.type} className="library-group">
            <h3 className="library-group-title">
              {SECTION_LABELS[g.type]} <span className="library-count">{g.items.length}</span>
            </h3>
            <ul className="library-list">
              {g.items.map((saved) => (
                <LibraryItem
                  key={saved.id}
                  saved={saved}
                  onInsert={onInsert}
                  onRemove={onRemove}
                  onRename={onRename}
                />
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  )
}

interface LibraryItemProps {
  saved: SavedBlock
  onInsert: (block: Omit<ResumeBlock, 'id'>) => void
  onRemove: (id: string) => void
  onRename: (id: string, name: string) => void
}

/** What the entry holds, in one line, so similar names can be told apart. */
function preview(input: Omit<ResumeBlock, 'id'>): string {
  const block = input as ResumeBlock
  switch (block.type) {
    case 'summary':
      return block.data.text
    case 'experience': {
      const i = block.data.items
      return i.length === 1 ? [i[0].dates, i[0].points[0]].filter(Boolean).join(' · ') : `${i.length} roles`
    }
    case 'skills':
      return block.data.groups.length === 1 ? block.data.groups[0].items : `${block.data.groups.length} groups`
    case 'education': {
      const i = block.data.items
      return i.length === 1 ? i[0].dates : `${i.length} entries`
    }
    case 'projects': {
      const i = block.data.items
      return i.length === 1 ? i[0].detail : `${i.length} projects`
    }
    case 'custom':
      return block.label
  }
}

/**
 * A saved entry. Insert adds it to the resume; dragging the card into the
 * section list drops it at that spot instead.
 */
function LibraryItem({ saved, onInsert, onRemove, onRename }: LibraryItemProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(saved.name)
  const data: DragData = { kind: 'saved-block', block: saved.block, name: saved.name }
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: `saved:${saved.id}`, data, disabled: editing })
  const Icon = SECTION_ICONS[saved.block.type]
  const fromCard = (e: React.SyntheticEvent) => !(e.target as HTMLElement).closest('button, input')

  const commit = () => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== saved.name) onRename(saved.id, trimmed)
    else setName(saved.name)
    setEditing(false)
  }

  return (
    <li
      ref={setNodeRef}
      className={`library-item is-grabbable${isDragging ? ' is-lifted' : ''}`}
      data-type={saved.block.type}
      onMouseDown={(e) => fromCard(e) && listeners?.onMouseDown?.(e)}
      onTouchStart={(e) => fromCard(e) && listeners?.onTouchStart?.(e)}
      title="Drag into your sections, or press Insert"
    >
      <GripVertical size={16} className="library-grip" aria-hidden="true" />
      <span className="block-icon" aria-hidden="true">
        <Icon size={16} />
      </span>
      <div className="library-info">
        {editing ? (
          <form
            className="library-rename"
            onSubmit={(e) => {
              e.preventDefault()
              commit()
            }}
          >
            <input
              value={name}
              autoFocus
              aria-label="Entry name"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setName(saved.name)
                  setEditing(false)
                }
              }}
            />
            <button type="submit" className="icon-btn" aria-label="Save name">
              <Check size={14} />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Cancel rename"
              onClick={() => {
                setName(saved.name)
                setEditing(false)
              }}
            >
              <X size={14} />
            </button>
          </form>
        ) : (
          <div className="block-label">{saved.name}</div>
        )}
        <div className="block-meta library-preview">{preview(saved.block)}</div>
      </div>
      <div className="block-actions">
        {!editing && (
          <button type="button" className="icon-btn" aria-label={`Rename ${saved.name}`} onClick={() => setEditing(true)}>
            <Pencil size={14} />
          </button>
        )}
        <button type="button" className="row-btn" onClick={() => onInsert(saved.block)}>
          Insert
          <span className="visually-hidden">{` ${saved.name}`}</span>
        </button>
        <button type="button" className="row-btn is-danger" onClick={() => onRemove(saved.id)}>
          Delete
          <span className="visually-hidden">{` ${saved.name}`}</span>
        </button>
      </div>
    </li>
  )
}
