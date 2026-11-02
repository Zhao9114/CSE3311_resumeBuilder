import type { ReactNode } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { Plus } from 'lucide-react'
import type { DragData } from '../dnd/dragData'
import type { SectionType } from '../../types'

interface PaletteChipProps {
  sectionType: SectionType
  disabled?: boolean
  title: string
  className?: string
  onClick: () => void
  children: ReactNode
}

/**
 * An "Add a section" chip. Clicking appends the section; dragging it into
 * the list drops it at that spot. Only the mouse and touch start a drag —
 * Enter and Space keep meaning "click", so keyboard users add by clicking.
 */
export default function PaletteChip({
  sectionType,
  disabled = false,
  title,
  className = '',
  onClick,
  children,
}: PaletteChipProps) {
  const data: DragData = { kind: 'new-section', sectionType }
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: `palette:${sectionType}`,
    data,
    disabled,
  })

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`chip palette-chip ${className}${isDragging ? ' is-lifted' : ''}`}
      disabled={disabled}
      title={title}
      onClick={onClick}
      onMouseDown={(e) => listeners?.onMouseDown?.(e)}
      onTouchStart={(e) => listeners?.onTouchStart?.(e)}
    >
      <Plus size={14} aria-hidden="true" />
      {children}
    </button>
  )
}
