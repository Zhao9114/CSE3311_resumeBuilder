import { useDroppable } from '@dnd-kit/core'
import { Eye, EyeOff, Trash } from 'lucide-react'
import { useResume } from '../../store'
import { useBuilderDnd } from './BuilderDnd'
import { HIDE_ZONE_ID, REMOVE_ZONE_ID } from './dragData'

/**
 * Two targets that slide up from the bottom of the editor while a section
 * card is being dragged: drop on one to hide (or show) the section, on the
 * other to remove it. Both can be undone from the toast.
 */
export default function DropZones() {
  const { active, overZone } = useBuilderDnd()
  const { resume } = useResume()
  const hide = useDroppable({ id: HIDE_ZONE_ID })
  const remove = useDroppable({ id: REMOVE_ZONE_ID })

  const dragging = active?.kind === 'block'
  const block = dragging ? resume?.blocks.find((b) => b.id === active.blockId) : undefined
  const showing = block?.enabled ?? true

  return (
    <div className={`drop-zones${dragging ? ' is-open' : ''}`} aria-hidden={!dragging}>
      <div ref={hide.setNodeRef} className={`drop-zone zone-hide${overZone === 'hide' ? ' is-over' : ''}`}>
        {showing ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        <span>{showing ? 'Hide from resume' : 'Show on resume'}</span>
      </div>
      <div ref={remove.setNodeRef} className={`drop-zone zone-remove${overZone === 'remove' ? ' is-over' : ''}`}>
        <Trash size={18} aria-hidden="true" />
        <span>Remove</span>
      </div>
    </div>
  )
}
