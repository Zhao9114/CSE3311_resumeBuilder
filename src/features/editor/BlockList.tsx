import type { ResumeBlock } from '../../types'
import BlockRow from './BlockRow'

export interface BlockListProps {
  blocks: ResumeBlock[]
  expandedId: string | null
  onToggleExpand: (id: string) => void
  onToggleEnabled: (id: string, enabled: boolean) => void
  onChange: (block: ResumeBlock) => void
  onRemove: (id: string) => void
  onReorder: (fromIndex: number, toIndex: number) => void
}

// TODO(sprint-3): wrap in dnd-kit DndContext + SortableContext for
// mouse and keyboard reordering. `onReorder` is already the store seam.
export default function BlockList({
  blocks,
  expandedId,
  onToggleExpand,
  onToggleEnabled,
  onChange,
  onRemove,
}: BlockListProps) {
  return (
    <ul className="block-list">
      {blocks.map((block) => (
        <li key={block.id}>
          <BlockRow
            block={block}
            expanded={expandedId === block.id}
            onToggleExpand={() => onToggleExpand(block.id)}
            onToggleEnabled={(enabled) => onToggleEnabled(block.id, enabled)}
            onChange={onChange}
            onRemove={() => onRemove(block.id)}
          />
        </li>
      ))}
    </ul>
  )
}
