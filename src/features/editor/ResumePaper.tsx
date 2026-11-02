import { Fragment } from 'react'
import { GripVertical } from 'lucide-react'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useReducedMotion } from '../../components/useReducedMotion'
import { paperId, type DragData, type PaperColumn } from '../dnd/dragData'
import {
  SIDEBAR_SECTION_TYPES,
  templateMeta,
  type Resume,
  type ResumeBlock,
} from '../../types'

/** Renders one block's body. Narrowed on `type`, so `data` is typed per case. */
function SectionBody({ block }: { block: ResumeBlock }) {
  switch (block.type) {
    case 'summary':
      return <p className="r-summary">{block.data.text}</p>

    case 'experience':
      return (
        <>
          {block.data.items.map((item, i) => (
            <div className="r-item" key={i}>
              <div className="r-item-head">
                <div>
                  <span className="r-role">{item.role}</span>
                  {item.org && <>, <span className="r-org">{item.org}</span></>}
                </div>
                {item.dates && <span className="r-dates">{item.dates}</span>}
              </div>
              {item.points.length > 0 && (
                <ul className="r-points">
                  {item.points.map((point, j) => (
                    <li key={j}>{point}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </>
      )

    case 'skills':
      return (
        <div className="r-skills">
          {block.data.groups.map((group, i) => (
            <div className="r-skill-row" key={i}>
              <span className="r-skill-name">{group.name}</span>
              <span className="r-skill-items">{group.items}</span>
            </div>
          ))}
        </div>
      )

    case 'education':
      return (
        <>
          {block.data.items.map((item, i) => (
            <div className="r-item" key={i}>
              <div className="r-item-head">
                <div>
                  <span className="r-role">{item.school}</span>
                </div>
                {item.dates && <span className="r-dates">{item.dates}</span>}
              </div>
              <p className="r-detail">
                {item.degree}
                {item.detail ? ` — ${item.detail}` : ''}
              </p>
            </div>
          ))}
        </>
      )

    case 'projects':
      return (
        <>
          {block.data.items.map((item, i) => (
            <div className="r-item" key={i}>
              <div className="r-item-head">
                <span className="r-role">{item.name}</span>
              </div>
              <p className="r-detail">{item.detail}</p>
            </div>
          ))}
        </>
      )

    case 'custom':
      return (
        <>
          {block.data.items.map((item, i) => (
            <div className="r-item" key={i}>
              <div className="r-item-head">
                <span className="r-role">{item.name}</span>
                {item.meta && <span className="r-dates">{item.meta}</span>}
              </div>
              {item.detail && <p className="r-detail">{item.detail}</p>}
            </div>
          ))}
        </>
      )
  }
}

interface ResumePaperProps {
  resume: Resume
  /** A section to flash briefly, e.g. one that was just dragged into place. */
  highlightId?: string | null
}

interface SectionProps {
  block: ResumeBlock
  column: PaperColumn
  highlight: boolean
}

/**
 * One section of the page. Hovering it shows a grip in the margin, so the
 * section can be dragged up or down right on the paper; it stays within its
 * column on the two-column template. The grip never prints.
 */
function Section({ block, column, highlight }: SectionProps) {
  const data: DragData = { kind: 'paper', blockId: block.id, column }
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: paperId(block.id), data })
  const reducedMotion = useReducedMotion()

  return (
    <section
      ref={setNodeRef}
      className={`r-section${isDragging ? ' is-lifted' : ''}${highlight ? ' is-flash' : ''}`}
      data-block-id={block.id}
      style={{
        transform: CSS.Translate.toString(transform),
        transition: reducedMotion ? undefined : transition,
      }}
    >
      <button
        type="button"
        className="r-grip no-print"
        ref={setActivatorNodeRef}
        aria-label={`Move ${block.label} on the page. Press space or enter, then use the arrow keys.`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} aria-hidden="true" />
      </button>
      <h2 className="r-section-title">{block.label}</h2>
      <SectionBody block={block} />
    </section>
  )
}

function Column({
  blocks,
  column,
  highlightId,
}: {
  blocks: ResumeBlock[]
  column: PaperColumn
  highlightId?: string | null
}) {
  return (
    <SortableContext items={blocks.map((b) => paperId(b.id))} strategy={verticalListSortingStrategy}>
      {blocks.map((block) => (
        <Section block={block} column={column} highlight={highlightId === block.id} key={block.id} />
      ))}
    </SortableContext>
  )
}

/**
 * The printable resume. Renders enabled blocks in array order, styled by the
 * resume's template. The Sidebar template splits the same blocks across two
 * columns; every other template renders one column.
 */
export default function ResumePaper({ resume, highlightId }: ResumePaperProps) {
  const { profile, blocks, templateId } = resume
  const meta = templateMeta(templateId)
  const visible = blocks.filter((b) => b.enabled)
  const contact = [profile.email, profile.phone, profile.location, profile.links]
    .filter(Boolean)

  const header = (
    <header className="r-header">
      <h1 className="r-name">{profile.name}</h1>
      {profile.title && <div className="r-title">{profile.title}</div>}
      {!meta.twoColumn && contact.length > 0 && (
        <p className="r-contact">
          {/* The separator sits outside the no-wrap span, so a narrow page
              can break the line between parts instead of overflowing. */}
          {contact.map((part, i) => (
            <Fragment key={i}>
              <span>{part}</span>
              {i < contact.length - 1 ? ' · ' : ''}
            </Fragment>
          ))}
        </p>
      )}
    </header>
  )

  const empty = (
    <p className="r-summary">
      No sections are visible yet. Add one, or switch a section back on.
    </p>
  )

  if (!meta.twoColumn) {
    return (
      <div className={`paper tpl-${templateId}`}>
        {header}
        {visible.length === 0
          ? empty
          : <Column blocks={visible} column="single" highlightId={highlightId} />}
      </div>
    )
  }

  // Sidebar: short reference sections go left, the narrative stays right.
  const asideTypes = new Set<string>(SIDEBAR_SECTION_TYPES)
  const aside = visible.filter((b) => asideTypes.has(b.type))
  const main = visible.filter((b) => !asideTypes.has(b.type))

  return (
    <div className={`paper tpl-${templateId}`}>
      {header}
      <div className="r-columns">
        <aside className="r-aside">
          {contact.length > 0 && (
            <section className="r-section">
              <h2 className="r-section-title">Contact</h2>
              <ul className="r-contact-list">
                {contact.map((part, i) => (
                  <li key={i}>{part}</li>
                ))}
              </ul>
            </section>
          )}
          <Column blocks={aside} column="aside" highlightId={highlightId} />
        </aside>
        <div className="r-main">
          {visible.length === 0
            ? empty
            : <Column blocks={main} column="main" highlightId={highlightId} />}
        </div>
      </div>
    </div>
  )
}
