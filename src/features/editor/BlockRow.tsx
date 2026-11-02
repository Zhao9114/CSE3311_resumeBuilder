import { Bookmark, Check, Pencil, Trash } from 'lucide-react'
import type { ResumeBlock } from '../../types'
import BlockEditor from './BlockEditor'
import { SECTION_ICONS } from './sectionIcons'

/** One-line description of what a block currently holds. */
export function blockMeta(block: ResumeBlock): string {
  switch (block.type) {
    case 'summary':
      return 'Short intro paragraph'
    case 'experience': {
      const n = block.data.items.length
      return `${n} role${n === 1 ? '' : 's'}`
    }
    case 'skills': {
      const n = block.data.groups.length
      return `${n} group${n === 1 ? '' : 's'}`
    }
    case 'education': {
      const n = block.data.items.length
      return `${n} ${n === 1 ? 'entry' : 'entries'}`
    }
    case 'projects': {
      const n = block.data.items.length
      return `${n} project${n === 1 ? '' : 's'}`
    }
    case 'custom': {
      const n = block.data.items.length
      return `Custom · ${n} ${n === 1 ? 'entry' : 'entries'}`
    }
  }
}

export interface BlockRowProps {
  block: ResumeBlock
  expanded: boolean
  onToggleExpand: () => void
  onToggleEnabled: (enabled: boolean) => void
  onChange: (block: ResumeBlock) => void
  onRemove: () => void
  onSave?: () => void
  /** Drag handle, supplied by the sortable wrapper in sprint 3. */
  handle?: React.ReactNode
  /** Lets the whole card start a drag, not only the handle. */
  cardHandlers?: React.HTMLAttributes<HTMLDivElement>
  className?: string
}

export default function BlockRow({
  block,
  expanded,
  onToggleExpand,
  onToggleEnabled,
  onChange,
  onRemove,
  onSave,
  handle,
  cardHandlers,
  className = '',
}: BlockRowProps) {
  const panelId = `block-panel-${block.id}`
  const Icon = SECTION_ICONS[block.type]

  return (
    <div>
      <div
        className={`block ${className}`}
        data-type={block.type}
        aria-disabled={!block.enabled}
        {...cardHandlers}
      >
        {handle}
        <span className="block-icon" aria-hidden="true">
          <Icon size={17} />
        </span>
        <div className="block-info">
          <div className="block-label">{block.label}</div>
          <div className="block-meta">{blockMeta(block)}</div>
        </div>
        <div className="block-actions">
          <button
            type="button"
            className="row-btn"
            onClick={onToggleExpand}
            aria-expanded={expanded}
            aria-controls={panelId}
          >
            {expanded ? <Check size={15} aria-hidden="true" /> : <Pencil size={14} aria-hidden="true" />}
            {expanded ? 'Done' : 'Edit'}
          </button>
          {onSave && (
            <button
              type="button"
              className="row-btn is-icon"
              onClick={onSave}
              aria-label={`Save ${block.label} to the block library`}
              title="Save to block library"
            >
              <Bookmark size={15} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            className="row-btn is-icon is-danger"
            onClick={onRemove}
            aria-label={`Remove ${block.label} section`}
            title="Remove section"
          >
            <Trash size={15} aria-hidden="true" />
          </button>
          <label className="switch">
            <input
              type="checkbox"
              checked={block.enabled}
              onChange={(e) => onToggleEnabled(e.target.checked)}
              aria-label={`Show ${block.label} on the resume`}
            />
            <span className="track" />
          </label>
        </div>
      </div>

      {expanded && (
        <div className="block-panel" id={panelId}>
          <BlockEditor block={block} onChange={onChange} />
        </div>
      )}
    </div>
  )
}
