import type { ResumeBlock } from '../../types'
import BlockEditor from './BlockEditor'

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
  /** Drag handle, supplied by the sortable wrapper in sprint 3. */
  handle?: React.ReactNode
  className?: string
}

export default function BlockRow({
  block,
  expanded,
  onToggleExpand,
  onToggleEnabled,
  onChange,
  onRemove,
  handle,
  className = '',
}: BlockRowProps) {
  const panelId = `block-panel-${block.id}`

  return (
    <div>
      <div className={`block ${className}`} aria-disabled={!block.enabled}>
        {handle}
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
            {expanded ? 'Done' : 'Edit'}
          </button>
          <button
            type="button"
            className="row-btn is-danger"
            onClick={onRemove}
            aria-label={`Remove ${block.label} section`}
          >
            Remove
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
