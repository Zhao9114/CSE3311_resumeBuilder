import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useReducedMotion } from '../../components/useReducedMotion'
import type { ResumeBlock } from '../../types'
import BlockRow from './BlockRow'

interface SortableBlockProps {
  block: ResumeBlock
  expanded: boolean
  onToggleExpand: () => void
  onToggleEnabled: (enabled: boolean) => void
  onChange: (block: ResumeBlock) => void
  onRemove: () => void
}

export default function SortableBlock({
  block,
  expanded,
  onToggleExpand,
  onToggleEnabled,
  onChange,
  onRemove,
}: SortableBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: block.id })
  const reducedMotion = useReducedMotion()

  // dnd-kit sets `transition` inline, so CSS cannot override it — drop it here.
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: reducedMotion ? undefined : transition,
  }

  const classes = [isDragging ? 'is-dragging' : '', isOver ? 'is-over' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <li ref={setNodeRef} style={style}>
      <BlockRow
        block={block}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
        onToggleEnabled={onToggleEnabled}
        onChange={onChange}
        onRemove={onRemove}
        className={classes}
        handle={
          <button
            type="button"
            className="block-grip"
            ref={setActivatorNodeRef}
            aria-label={`Reorder ${block.label}. Press space or enter, then use the arrow keys.`}
            {...attributes}
            {...listeners}
          >
            <span aria-hidden="true">⠿</span>
          </button>
        }
      />
    </li>
  )
}
