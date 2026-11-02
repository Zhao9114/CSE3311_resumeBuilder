import { useMemo, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { GripVertical } from 'lucide-react'
import type { DragData } from '../dnd/dragData'
import type { ResumeBlock, SavedBlock } from '../../types'
import { SECTION_ICONS } from './sectionIcons'

interface BlockLibraryPanelProps {
  savedBlocks: SavedBlock[]
  loading: boolean
  onInsert: (block: Omit<ResumeBlock, 'id'>) => void
  onRemove: (id: string) => void
}

/**
 * The reusable block library: save a frontend Experience block and a backend
 * one, then pull whichever fits the job into the current resume.
 */
export default function BlockLibraryPanel({
  savedBlocks,
  loading,
  onInsert,
  onRemove,
}: BlockLibraryPanelProps) {
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const tags = useMemo(() => {
    const all = new Set<string>()
    for (const s of savedBlocks) for (const t of s.tags) all.add(t)
    return [...all].sort()
  }, [savedBlocks])

  const shown = activeTag
    ? savedBlocks.filter((s) => s.tags.includes(activeTag))
    : savedBlocks

  return (
    <section className="library" aria-labelledby="library-heading">
      <div className="library-head">
        <h2 className="pane-title" id="library-heading">
          Saved blocks
        </h2>
        <p className="pane-sub">
          Reuse a section across resumes. Inserting adds a copy.
        </p>
      </div>

      {tags.length > 0 && (
        <div className="library-tags" role="group" aria-label="Filter by tag">
          <button
            type="button"
            className="chip"
            aria-pressed={activeTag === null}
            onClick={() => setActiveTag(null)}
          >
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
        <div className="skeleton" style={{ height: 40 }} aria-label="Loading library" />
      ) : savedBlocks.length === 0 ? (
        <div className="empty">
          <h3>No saved blocks yet</h3>
          <p>
            Use “Save” on any section to keep a version you can drop into
            another resume.
          </p>
        </div>
      ) : shown.length === 0 ? (
        <div className="empty">
          <p>No saved blocks tagged “{activeTag}”.</p>
        </div>
      ) : (
        <ul className="library-list">
          {shown.map((saved) => (
            <LibraryItem key={saved.id} saved={saved} onInsert={onInsert} onRemove={onRemove} />
          ))}
        </ul>
      )}
    </section>
  )
}

interface LibraryItemProps {
  saved: SavedBlock
  onInsert: (block: Omit<ResumeBlock, 'id'>) => void
  onRemove: (id: string) => void
}

/**
 * A saved block. Insert appends a copy; dragging the card into the section
 * list drops the copy at that spot instead.
 */
function LibraryItem({ saved, onInsert, onRemove }: LibraryItemProps) {
  const data: DragData = { kind: 'saved-block', block: saved.block, name: saved.name }
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: `saved:${saved.id}`, data })
  const Icon = SECTION_ICONS[saved.block.type]
  const fromCard = (e: React.SyntheticEvent) => !(e.target as HTMLElement).closest('button')

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
        <div className="block-label">{saved.name}</div>
        <div className="block-meta">
          {saved.block.label}
          {saved.tags.length > 0 && ` · ${saved.tags.join(', ')}`}
        </div>
      </div>
      <div className="block-actions">
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
