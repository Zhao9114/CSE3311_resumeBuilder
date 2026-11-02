import { useRef, useState, type ReactNode } from 'react'
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { useReducedMotion } from '../../components/useReducedMotion'

interface SortableListProps<T> {
  items: T[]
  onMove: (fromIndex: number, toIndex: number) => void
  /** Spoken and tooltip name of an entry, e.g. "Role 2: Web Developer". */
  describe: (item: T, index: number) => string
  /** Renders one entry; place `handle` where its grip should go. */
  renderItem: (item: T, index: number, handle: ReactNode) => ReactNode
  className?: string
}

let seq = 0

/**
 * Entries are stored as plain arrays with no ids, so give each one a stable
 * key for dnd-kit that travels with it when it moves. Added entries get new
 * keys; removed ones drop off the end (keys only need to be unique).
 */
function useStableKeys(length: number) {
  const keys = useRef<string[]>([])
  while (keys.current.length < length) keys.current.push(`item-${++seq}`)
  if (keys.current.length > length) keys.current = keys.current.slice(0, length)
  return keys
}

/**
 * A reorderable list inside a section's editor — roles, bullets, skill
 * groups, entries. It runs its own drag context, separate from the one that
 * moves whole sections, so a drag in here never picks up the section card.
 * Each entry gets a grip; the keyboard works as on the section list.
 */
export default function SortableList<T>({ items, onMove, describe, renderItem, className = '' }: SortableListProps<T>) {
  const keys = useStableKeys(items.length)
  const [dragging, setDragging] = useState(false)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const indexOf = (id: unknown) => keys.current.indexOf(String(id))
  const name = (id: unknown) => {
    const i = indexOf(id)
    return i === -1 ? 'Entry' : describe(items[i], i)
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${name(active.id)}. Use the arrow keys to move it, space to drop, escape to cancel.`,
    onDragOver: ({ active, over }) =>
      over ? `${name(active.id)} is over position ${indexOf(over.id) + 1} of ${items.length}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `${name(active.id)} was dropped at position ${indexOf(over.id) + 1} of ${items.length}.` : `${name(active.id)} was dropped.`,
    onDragCancel: ({ active }) => `Cancelled. ${name(active.id)} is back where it started.`,
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDragging(false)
    if (!over || active.id === over.id) return
    const from = indexOf(active.id)
    const to = indexOf(over.id)
    if (from === -1 || to === -1) return
    // Move the key with its entry, so React keeps the right DOM node.
    const [key] = keys.current.splice(from, 1)
    keys.current.splice(to, 0, key)
    onMove(from, to)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      accessibility={{ announcements }}
      onDragStart={() => setDragging(true)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragging(false)}
    >
      <SortableContext items={keys.current} strategy={verticalListSortingStrategy}>
        <div className={`sortable-list${dragging ? ' is-sorting' : ''} ${className}`}>
          {items.map((item, i) => (
            <SortableRow key={keys.current[i]} id={keys.current[i]} label={describe(item, i)}>
              {(handle) => renderItem(item, i, handle)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: (handle: ReactNode) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id })
  const reducedMotion = useReducedMotion()

  const handle = (
    <button
      type="button"
      className="item-grip"
      ref={setActivatorNodeRef}
      aria-label={`Reorder ${label}. Press space or enter, then use the arrow keys.`}
      title="Drag to reorder"
      {...attributes}
      {...listeners}
    >
      <GripVertical size={15} aria-hidden="true" />
    </button>
  )

  return (
    <div
      ref={setNodeRef}
      className={`sortable-row${isDragging ? ' is-dragging' : ''}`}
      style={{
        transform: CSS.Translate.toString(transform),
        transition: reducedMotion ? undefined : transition,
      }}
    >
      {children(handle)}
    </div>
  )
}
