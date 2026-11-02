import { GripVertical } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useReducedMotion } from '../../components/useReducedMotion'
import type { DragData } from '../dnd/dragData'
import type { ResumeBlock } from '../../types'
import BlockRow from './BlockRow'

interface SortableBlockProps {
  block: ResumeBlock
  expanded: boolean
  justMoved: boolean
  onToggleExpand: () => void
  onToggleEnabled: (enabled: boolean) => void
  onChange: (block: ResumeBlock) => void
  onRemove: () => void
  onSave: () => void
}

/** Pressing on these starts their own action, never a drag. */
const INTERACTIVE = 'button, input, textarea, select, label, a, .block-panel'

export default function SortableBlock({
  block,
  expanded,
  justMoved,
  onToggleExpand,
  onToggleEnabled,
  onChange,
  onRemove,
  onSave,
}: SortableBlockProps) {
  const data: DragData = { kind: 'block', blockId: block.id }
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: block.id, data })
  const reducedMotion = useReducedMotion()

  // dnd-kit sets `transition` inline, so CSS cannot override it — drop it here.
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: reducedMotion ? undefined : transition,
  }

  const classes = [
    'is-grabbable',
    isDragging ? 'is-dragging' : '',
    isOver && !isDragging ? 'is-over' : '',
    justMoved ? 'just-moved' : '',
  ]
    .filter(Boolean)
    .join(' ')

  /**
   * The whole card can be picked up with a mouse or a finger, not just the
   * grip — except on its buttons and form fields. Keyboard dragging stays on
   * the grip, so Space inside a field types a space.
   */
  const cardHandlers = {
    onMouseDown: (e: React.MouseEvent) => {
      if (!(e.target as HTMLElement).closest(INTERACTIVE)) listeners?.onMouseDown?.(e)
    },
    onTouchStart: (e: React.TouchEvent) => {
      if (!(e.target as HTMLElement).closest(INTERACTIVE)) listeners?.onTouchStart?.(e)
    },
  }

  return (
    <li ref={setNodeRef} style={style}>
      <BlockRow
        block={block}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
        onToggleEnabled={onToggleEnabled}
        onChange={onChange}
        onRemove={onRemove}
        onSave={onSave}
        className={classes}
        cardHandlers={cardHandlers}
        handle={
          <button
            type="button"
            className="block-grip"
            ref={setActivatorNodeRef}
            aria-label={`Reorder ${block.label}. Press space or enter, then use the arrow keys.`}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={17} aria-hidden="true" />
          </button>
        }
      />
    </li>
  )
}
