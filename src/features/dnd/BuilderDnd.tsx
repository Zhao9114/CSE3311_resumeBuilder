import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DroppableContainer,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { getEventCoordinates } from '@dnd-kit/utilities'
import { useToast } from '../../components/Toast'
import { useReducedMotion } from '../../components/useReducedMotion'
import { blankBlock } from '../../data/seed'
import { useResume } from '../../store'
import { SECTION_LABELS, type Resume, type ResumeBlock } from '../../types'
import DragCard from './DragCard'
import {
  HIDE_ZONE_ID,
  isIncoming,
  LIST_DROP_ID,
  REMOVE_ZONE_ID,
  type DragData,
  type IncomingDrag,
} from './dragData'

export type DropZone = 'hide' | 'remove'

interface BuilderDndValue {
  /** What is being dragged right now, if anything. */
  active: DragData | null
  /** Blocks as they would be if the drag ended here; the paper renders these. */
  previewBlocks: ResumeBlock[] | null
  /** Where an item dragged in from outside the list would land. */
  incomingIndex: number | null
  overZone: DropZone | null
  /** A block that just moved or arrived, so the card and the paper can flash it. */
  justMovedId: string | null
  canUndo: boolean
  undo: () => void
  /** Remember the resume as it is now, before a change the user may want back. */
  recordUndo: (label: string) => void
}

const BuilderDndContext = createContext<BuilderDndValue | null>(null)

export function useBuilderDnd(): BuilderDndValue {
  const ctx = useContext(BuilderDndContext)
  if (!ctx) throw new Error('useBuilderDnd must be used inside BuilderDndProvider')
  return ctx
}

const MAX_UNDO = 20
const FLASH_MS = 1600

function dataOf(source: { data: { current?: unknown } } | null | undefined): DragData | null {
  return (source?.data.current as DragData | undefined) ?? null
}

/** The block an incoming drag would create, for the live preview and the drop. */
function incomingBlock(data: IncomingDrag): ResumeBlock {
  switch (data.kind) {
    case 'new-section':
      return blankBlock(data.sectionType, 'incoming')
    case 'saved-block':
    case 'proposal':
      return { ...structuredClone(data.block), id: 'incoming' } as ResumeBlock
  }
}

function incomingLabel(data: IncomingDrag): string {
  switch (data.kind) {
    case 'new-section': {
      const label = SECTION_LABELS[data.sectionType]
      return `new ${/section$/i.test(label) ? label.toLowerCase() : `${label} section`}`
    }
    case 'saved-block':
      return `saved block ${data.name}`
    case 'proposal':
      return `suggested ${data.block.label}`
  }
}

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
}

/**
 * The one drag-and-drop context for the builder. It spans the editor list,
 * the "Add a section" palette, the block library, the assistant drawer and
 * the resume paper, so anything can be dragged into the list, and it owns
 * what every drop means:
 *
 *  - a card dropped on another card reorders the resume;
 *  - a card dropped on the Hide or Remove zone hides or removes it;
 *  - a chip, saved block or assistant proposal dropped into the list adds a
 *    section at that spot;
 *  - a section dragged on the paper reorders within its column.
 *
 * While a drag is in progress the paper shows the result live
 * (`previewBlocks`); nothing is written until the drop. Every drop can be
 * undone from the toast or with Ctrl/Cmd+Z.
 */
export function BuilderDndProvider({ children }: { children: ReactNode }) {
  const { resume, reorderBlocks, toggleBlock, removeBlock, addBlock, insertBlock, replaceResume } =
    useResume()
  const toast = useToast()
  const reducedMotion = useReducedMotion()

  const [active, setActive] = useState<DragData | null>(null)
  const [previewBlocks, setPreviewBlocks] = useState<ResumeBlock[] | null>(null)
  const [incomingIndex, setIncomingIndex] = useState<number | null>(null)
  const [overZone, setOverZone] = useState<DropZone | null>(null)
  const [justMovedId, setJustMovedId] = useState<string | null>(null)
  const [skipDropAnimation, setSkipDropAnimation] = useState(false)

  // Handlers run outside render; read the latest resume through a ref.
  const resumeRef = useRef<Resume | undefined>(resume)
  resumeRef.current = resume
  const overZoneRef = useRef<DropZone | null>(null)
  overZoneRef.current = overZone

  // ── Undo ────────────────────────────────────────────────────────────────
  const undoStack = useRef<{ label: string; resume: Resume }[]>([])
  const [canUndo, setCanUndo] = useState(false)

  const recordUndo = useCallback((label: string) => {
    const current = resumeRef.current
    if (!current) return
    undoStack.current = [...undoStack.current, { label, resume: structuredClone(current) }].slice(-MAX_UNDO)
    setCanUndo(true)
  }, [])

  const undo = useCallback(() => {
    const entry = undoStack.current.pop()
    setCanUndo(undoStack.current.length > 0)
    if (!entry) return
    void replaceResume(entry.resume)
    toast({ message: `Undid: ${entry.label}` })
  }, [replaceResume, toast])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Inside a text field, Ctrl+Z is the field's own text undo.
      if (e.key.toLowerCase() !== 'z' || !(e.ctrlKey || e.metaKey) || e.shiftKey) return
      if (isEditable(e.target) || undoStack.current.length === 0) return
      e.preventDefault()
      undo()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [undo])

  /** Undo, offered as the toast's action. */
  const undoAction = useMemo(() => ({ label: 'Undo', run: undo }), [undo])

  // ── Flash the block that just moved or arrived ──────────────────────────
  const flashTimer = useRef<number>()
  const flash = useCallback((id: string) => {
    setJustMovedId(id)
    window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setJustMovedId(null), FLASH_MS)
  }, [])

  // An inserted block gets its id from the store, so wait for it to appear.
  const idsBeforeInsert = useRef<Set<string> | null>(null)
  useEffect(() => {
    const before = idsBeforeInsert.current
    if (!before || !resume) return
    const added = resume.blocks.find((b) => !before.has(b.id))
    if (added) {
      idsBeforeInsert.current = null
      flash(added.id)
    }
  }, [resume, flash])

  // ── Sensors and collision rules ─────────────────────────────────────────
  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so clicks still click.
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    // On touch, a short press starts the drag; a swipe still scrolls.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const data = dataOf(args.active)
    const only = (keep: (c: DroppableContainer) => boolean) => ({
      ...args,
      droppableContainers: args.droppableContainers.filter(keep),
    })
    const kindOf = (c: DroppableContainer) => dataOf(c)?.kind

    if (data?.kind === 'block') {
      // A zone wins only when the pointer is actually inside it.
      const zones = pointerWithin(only((c) => c.id === HIDE_ZONE_ID || c.id === REMOVE_ZONE_ID))
      if (zones.length) return zones
      return closestCenter(only((c) => kindOf(c) === 'block'))
    }
    if (data?.kind === 'paper') {
      // Sidebar sections stay in the sidebar, main ones in the main column.
      return closestCenter(
        only((c) => {
          const d = dataOf(c)
          return d?.kind === 'paper' && d.column === data.column
        }),
      )
    }
    if (isIncoming(data)) {
      // Only a drop inside the editor list adds anything.
      const inList = pointerWithin(only((c) => c.id === LIST_DROP_ID))

      if (!inList.length) return []
      const near = closestCenter(only((c) => kindOf(c) === 'block'))
      return near.length ? near : inList
    }
    return closestCenter(args)
  }, [])

  // ── Where would this land? ──────────────────────────────────────────────
  function incomingIndexFor(event: DragOverEvent | DragEndEvent): number | null {
    const blocks = resumeRef.current?.blocks
    const { over, active: dragged } = event
    if (!over || !blocks) return null
    if (over.id === LIST_DROP_ID) return blocks.length
    const index = blocks.findIndex((b) => b.id === over.id)
    if (index === -1) return null
    // Pointer above the card's middle goes before it; below goes after.
    // `over.rect` is where the card is on screen now, so compare it with
    // where the pointer is on screen now: its start plus how far the lifted
    // card has travelled. (`event.delta` also counts any auto-scroll, which
    // would put the pointer a scroll's worth off.) A keyboard drag has no
    // pointer, so it falls back to the lifted card's middle.
    const start = getEventCoordinates(event.activatorEvent)
    const { initial, translated } = dragged.rect.current
    const y =
      start && initial && translated
        ? start.y + (translated.top - initial.top)
        : translated
          ? translated.top + translated.height / 2
          : null
    const below = y !== null && y > over.rect.top + over.rect.height / 2
    return index + (below ? 1 : 0)
  }

  function zoneOf(id: unknown): DropZone | null {
    if (id === HIDE_ZONE_ID) return 'hide'
    if (id === REMOVE_ZONE_ID) return 'remove'
    return null
  }

  function reset() {
    setActive(null)
    setPreviewBlocks(null)
    setIncomingIndex(null)
    setOverZone(null)
  }

  // ── Events ──────────────────────────────────────────────────────────────
  function handleDragStart(event: DragStartEvent) {
    setSkipDropAnimation(false)
    setActive(dataOf(event.active))
  }

  function handleDragOver(event: DragOverEvent) {
    const data = dataOf(event.active)
    const blocks = resumeRef.current?.blocks
    if (!data || !blocks) return

    if (data.kind === 'block') {
      const zone = zoneOf(event.over?.id)
      setOverZone(zone)
      if (zone === 'hide') {
        setPreviewBlocks(blocks.map((b) => (b.id === data.blockId ? { ...b, enabled: !b.enabled } : b)))
      } else if (zone === 'remove') {
        setPreviewBlocks(blocks.filter((b) => b.id !== data.blockId))
      } else {
        const from = blocks.findIndex((b) => b.id === data.blockId)
        const to = blocks.findIndex((b) => b.id === event.over?.id)
        setPreviewBlocks(from !== -1 && to !== -1 ? arrayMove(blocks, from, to) : null)
      }
      return
    }

    if (isIncoming(data)) {
      const index = incomingIndexFor(event)
      setIncomingIndex(index)
      setPreviewBlocks(
        index === null ? null : [...blocks.slice(0, index), incomingBlock(data), ...blocks.slice(index)],
      )
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const data = dataOf(event.active)
    const current = resumeRef.current
    const index = isIncoming(data) ? incomingIndexFor(event) : null
    const zone = zoneOf(event.over?.id)
    setSkipDropAnimation(isIncoming(data) || zone !== null)
    reset()
    if (!data || !current || !event.over) return
    const blocks = current.blocks

    if (data.kind === 'block') {
      const block = blocks.find((b) => b.id === data.blockId)
      if (!block) return
      if (zone === 'hide') {
        const verb = block.enabled ? 'Hid' : 'Showed'
        recordUndo(`${verb.toLowerCase()} ${block.label}`)
        void toggleBlock(block.id, !block.enabled)
        toast({ message: `${verb} ${block.label}`, action: undoAction })
        return
      }
      if (zone === 'remove') {
        recordUndo(`removed ${block.label}`)
        void removeBlock(block.id)
        toast({ message: `Removed ${block.label}`, action: undoAction })
        return
      }
      const from = blocks.indexOf(block)
      const to = blocks.findIndex((b) => b.id === event.over?.id)
      if (to === -1 || to === from) return
      recordUndo(`moved ${block.label}`)
      void reorderBlocks(from, to)
      flash(block.id)
      toast({ message: `Moved ${block.label} to position ${to + 1}`, action: undoAction })
      return
    }

    if (data.kind === 'paper') {
      const over = dataOf(event.over)
      if (over?.kind !== 'paper' || over.column !== data.column) return
      const from = blocks.findIndex((b) => b.id === data.blockId)
      const to = blocks.findIndex((b) => b.id === over.blockId)
      if (from === -1 || to === -1 || from === to) return
      recordUndo(`moved ${blocks[from].label}`)
      void reorderBlocks(from, to)
      flash(blocks[from].id)
      toast({ message: `Moved ${blocks[from].label}`, action: undoAction })
      return
    }

    if (isIncoming(data) && index !== null) {
      idsBeforeInsert.current = new Set(blocks.map((b) => b.id))
      const label = data.kind === 'new-section' ? SECTION_LABELS[data.sectionType] : data.block.label
      recordUndo(`added ${label}`)
      if (data.kind === 'new-section') {
        void addBlock(data.sectionType, undefined, index)
      } else {
        // insertBlock always gives the copy a fresh id of its own.
        void insertBlock(data.block, index)
        if (data.kind === 'proposal') data.onApplied()
      }
      toast({ message: `Added ${label} at position ${index + 1}`, action: undoAction })
    }
  }

  // ── Screen-reader narration, in section names rather than ids ───────────
  const labelOf = useCallback((data: DragData | null): string => {
    if (!data) return 'Item'
    if (data.kind === 'block' || data.kind === 'paper') {
      return resumeRef.current?.blocks.find((b) => b.id === data.blockId)?.label ?? 'Section'
    }
    return incomingLabel(data)
  }, [])

  const announcements: Announcements = useMemo(() => {
    const position = (id: unknown) => {
      const blocks = resumeRef.current?.blocks ?? []
      const i = blocks.findIndex((b) => b.id === id || `paper:${b.id}` === id)
      return i === -1 ? null : `position ${i + 1} of ${blocks.length}`
    }
    return {
      onDragStart: ({ active: a }) => {
        const where = position(a.id)
        return `Picked up ${labelOf(dataOf(a))}.${where ? ` It is at ${where}.` : ''} Use the arrow keys to move it, space to drop, escape to cancel.`
      },
      onDragOver: ({ active: a, over }) => {
        if (!over) return `${labelOf(dataOf(a))} is not over a drop target.`
        const zone = zoneOf(over.id)
        if (zone) return `${labelOf(dataOf(a))} is over the ${zone} zone. Drop to ${zone} it.`
        const where = position(over.id)
        return where ? `${labelOf(dataOf(a))} is over ${where}.` : undefined
      },
      onDragEnd: ({ active: a, over }) => {
        if (!over) return `${labelOf(dataOf(a))} was dropped outside the list. Nothing changed.`
        const zone = zoneOf(over.id)
        if (zone === 'remove') return `${labelOf(dataOf(a))} was removed. Press Control Z to undo.`
        if (zone === 'hide') return `${labelOf(dataOf(a))} visibility was switched. Press Control Z to undo.`
        const where = position(over.id)
        return `${labelOf(dataOf(a))} was dropped${where ? ` at ${where}` : ''}.`
      },
      onDragCancel: ({ active: a }) => `Cancelled. ${labelOf(dataOf(a))} is back where it started.`,
    }
  }, [labelOf])

  const value = useMemo<BuilderDndValue>(
    () => ({ active, previewBlocks, incomingIndex, overZone, justMovedId, canUndo, undo, recordUndo }),
    [active, previewBlocks, incomingIndex, overZone, justMovedId, canUndo, undo, recordUndo],
  )

  const overlayBlock: ResumeBlock | null = !active
    ? null
    : active.kind === 'block' || active.kind === 'paper'
      ? (resume?.blocks.find((b) => b.id === active.blockId) ?? null)
      : incomingBlock(active)

  return (
    <BuilderDndContext.Provider value={value}>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        // Scroll only within a thin band at the very edge, and never while
        // hovering a drop zone — the zones sit at the bottom edge, and the
        // list scrolling away underneath them would move the target.
        autoScroll={{
          threshold: { x: 0, y: 0.08 },
          acceleration: 8,
          canScroll: () => overZoneRef.current === null,
        }}
        // Paper sections only move up and down within their column. Editor
        // cards move freely, since the Hide and Remove zones sit side by side.
        modifiers={active?.kind === 'paper' ? [restrictToVerticalAxis] : undefined}
        accessibility={{ announcements }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={reset}
      >
        {children}
        <DragOverlay dropAnimation={reducedMotion || skipDropAnimation ? null : undefined} zIndex={60}>
          {overlayBlock && active ? (
            <DragCard
              block={overlayBlock}
              caption={isIncoming(active) ? `Drop to add · ${incomingLabel(active)}` : undefined}
              zone={overZone}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </BuilderDndContext.Provider>
  )
}
