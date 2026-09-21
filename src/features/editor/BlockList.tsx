import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { useReducedMotion } from '../../components/useReducedMotion'
import type { ResumeBlock } from '../../types'
import BlockRow from './BlockRow'
import SortableBlock from './SortableBlock'

export interface BlockListProps {
  blocks: ResumeBlock[]
  expandedId: string | null
  onToggleExpand: (id: string) => void
  onToggleEnabled: (id: string, enabled: boolean) => void
  onChange: (block: ResumeBlock) => void
  onRemove: (id: string) => void
  onReorder: (fromIndex: number, toIndex: number) => void
}

export default function BlockList({
  blocks,
  expandedId,
  onToggleExpand,
  onToggleEnabled,
  onChange,
  onRemove,
  onReorder,
}: BlockListProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const reducedMotion = useReducedMotion()

  const sensors = useSensors(
    // A small distance threshold keeps the Edit/Remove buttons clickable.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const activeBlock = blocks.find((b) => b.id === activeId) ?? null

  /** Spoken feedback for keyboard users, in section names rather than ids. */
  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      const label = labelOf(blocks, active.id)
      const pos = indexOf(blocks, active.id) + 1
      return `Picked up ${label}. It is position ${pos} of ${blocks.length}. Use the arrow keys to move it, space to drop, escape to cancel.`
    },
    onDragOver: ({ active, over }) => {
      if (!over) return undefined
      return `${labelOf(blocks, active.id)} is now over position ${
        indexOf(blocks, over.id) + 1
      } of ${blocks.length}.`
    },
    onDragEnd: ({ active, over }) => {
      if (!over) return `${labelOf(blocks, active.id)} was dropped.`
      return `${labelOf(blocks, active.id)} was dropped at position ${
        indexOf(blocks, over.id) + 1
      } of ${blocks.length}.`
    },
    onDragCancel: ({ active }) =>
      `Reordering cancelled. ${labelOf(blocks, active.id)} returned to its original position.`,
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    const from = indexOf(blocks, active.id)
    const to = indexOf(blocks, over.id)
    if (from === -1 || to === -1) return
    onReorder(from, to)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      accessibility={{ announcements }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext
        items={blocks.map((b) => b.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="block-list">
          {blocks.map((block) => (
            <SortableBlock
              key={block.id}
              block={block}
              expanded={expandedId === block.id}
              onToggleExpand={() => onToggleExpand(block.id)}
              onToggleEnabled={(enabled) => onToggleEnabled(block.id, enabled)}
              onChange={onChange}
              onRemove={() => onRemove(block.id)}
            />
          ))}
        </ul>
      </SortableContext>

      <DragOverlay dropAnimation={reducedMotion ? null : undefined}>
        {activeBlock ? (
          <BlockRow
            block={activeBlock}
            expanded={false}
            onToggleExpand={noop}
            onToggleEnabled={noop}
            onChange={noop}
            onRemove={noop}
            className="is-overlay"
            handle={
              <span className="block-grip" aria-hidden="true">
                ⠿
              </span>
            }
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function indexOf(blocks: ResumeBlock[], id: string | number): number {
  return blocks.findIndex((b) => b.id === String(id))
}

function labelOf(blocks: ResumeBlock[], id: string | number): string {
  return blocks.find((b) => b.id === String(id))?.label ?? 'Section'
}

/** The drag overlay is a non-interactive copy. */
function noop() {}
