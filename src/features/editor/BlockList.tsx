import { Fragment } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, type SortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { useBuilderDnd } from '../dnd/BuilderDnd'
import { isIncoming, LIST_DROP_ID } from '../dnd/dragData'
import type { ResumeBlock } from '../../types'
import SortableBlock from './SortableBlock'

export interface BlockListProps {
  blocks: ResumeBlock[]
  expandedId: string | null
  onToggleExpand: (id: string) => void
  onToggleEnabled: (id: string, enabled: boolean) => void
  onChange: (block: ResumeBlock) => void
  onRemove: (id: string) => void
  onSave: (block: ResumeBlock) => void
}

/**
 * Something dragged in from outside isn't one of the list's items, so the
 * cards don't slide around it; a real gap opens instead (the landing slot
 * below), which pushes them apart in normal layout.
 */
const holdStill: SortingStrategy = () => null

/**
 * The editor's section cards. Drag one by its grip or anywhere on the card
 * to reorder; drop a chip, a saved block or an assistant suggestion between
 * two cards to add a section there. The drop logic lives in BuilderDnd.
 */
export default function BlockList({
  blocks,
  expandedId,
  onToggleExpand,
  onToggleEnabled,
  onChange,
  onRemove,
  onSave,
}: BlockListProps) {
  const { active, incomingIndex, justMovedId } = useBuilderDnd()
  const incoming = isIncoming(active)
  const { setNodeRef, isOver } = useDroppable({ id: LIST_DROP_ID })

  const slot = (
    <li className="drop-slot" aria-hidden="true">
      <Plus size={16} />
      Drop to add here
    </li>
  )

  return (
    <SortableContext
      items={blocks.map((b) => b.id)}
      strategy={incoming ? holdStill : verticalListSortingStrategy}
    >
      <ul
        ref={setNodeRef}
        className={`block-list${incoming ? ' is-receiving' : ''}${incoming && isOver ? ' is-target' : ''}`}
      >
        {blocks.map((block, i) => (
          <Fragment key={block.id}>
            {incoming && incomingIndex === i && slot}
            <SortableBlock
              block={block}
              expanded={expandedId === block.id}
              justMoved={justMovedId === block.id}
              onToggleExpand={() => onToggleExpand(block.id)}
              onToggleEnabled={(enabled) => onToggleEnabled(block.id, enabled)}
              onChange={onChange}
              onRemove={() => onRemove(block.id)}
              onSave={() => onSave(block)}
            />
          </Fragment>
        ))}
        {incoming && incomingIndex === blocks.length && slot}
        {blocks.length === 0 && !incoming && (
          <li className="empty">
            <h3>No sections yet</h3>
            <p>Click a section below, or drag one here.</p>
          </li>
        )}
      </ul>
    </SortableContext>
  )
}
