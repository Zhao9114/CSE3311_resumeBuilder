import { useMemo, useState } from 'react'
import type { ResumeBlock, SavedBlock } from '../../types'

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
            <li className="library-item" key={saved.id}>
              <div className="library-info">
                <div className="block-label">{saved.name}</div>
                <div className="block-meta">
                  {saved.block.label}
                  {saved.tags.length > 0 && ` · ${saved.tags.join(', ')}`}
                </div>
              </div>
              <div className="block-actions">
                <button
                  type="button"
                  className="row-btn"
                  onClick={() => onInsert(saved.block)}
                >
                  Insert
                  <span className="visually-hidden">{` ${saved.name}`}</span>
                </button>
                <button
                  type="button"
                  className="row-btn is-danger"
                  onClick={() => onRemove(saved.id)}
                >
                  Delete
                  <span className="visually-hidden">{` ${saved.name}`}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
