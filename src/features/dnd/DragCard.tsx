import { EyeOff, GripVertical, Trash } from 'lucide-react'
import type { ResumeBlock } from '../../types'
import { blockMeta } from '../editor/BlockRow'
import { SECTION_ICONS } from '../editor/sectionIcons'
import type { DropZone } from './BuilderDnd'

interface DragCardProps {
  block: ResumeBlock
  /** Replaces the usual "2 roles" line, e.g. for something being added. */
  caption?: string
  /** Set while hovering a drop zone, so the card previews what will happen. */
  zone?: DropZone | null
}

/** The lifted card that follows the pointer during any drag in the builder. */
export default function DragCard({ block, caption, zone }: DragCardProps) {
  const Icon = SECTION_ICONS[block.type]
  return (
    <div
      className={`block is-overlay${caption ? ' is-incoming' : ''}${zone ? ` over-${zone}` : ''}`}
      data-type={block.type}
      aria-hidden="true"
    >
      <span className="block-grip">
        <GripVertical size={17} />
      </span>
      <span className="block-icon">
        <Icon size={17} />
      </span>
      <div className="block-info">
        <div className="block-label">{block.label}</div>
        <div className="block-meta">{caption ?? blockMeta(block)}</div>
      </div>
      {zone === 'remove' && <Trash size={17} className="overlay-zone-icon" />}
      {zone === 'hide' && <EyeOff size={17} className="overlay-zone-icon" />}
    </div>
  )
}
