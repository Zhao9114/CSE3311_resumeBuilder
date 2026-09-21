import type { Resume, ResumeBlock } from '../../types'

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
  }
}

interface ResumePaperProps {
  resume: Resume
}

/** The printable resume. Renders enabled blocks in array order. */
export default function ResumePaper({ resume }: ResumePaperProps) {
  const { profile, blocks } = resume
  const visible = blocks.filter((b) => b.enabled)
  const contact = [profile.email, profile.phone, profile.location, profile.links]
    .filter(Boolean)

  return (
    <div className="paper">
      <h1 className="r-name">{profile.name}</h1>
      {profile.title && <div className="r-title">{profile.title}</div>}
      {contact.length > 0 && (
        <p className="r-contact">
          {contact.map((part, i) => (
            <span key={i}>
              {part}
              {i < contact.length - 1 ? ' · ' : ''}
            </span>
          ))}
        </p>
      )}

      {visible.length === 0 ? (
        <p className="r-summary">
          No sections are visible yet. Add one, or switch a section back on.
        </p>
      ) : (
        visible.map((block) => (
          <section className="r-section" key={block.id}>
            <h2 className="r-section-title">{block.label}</h2>
            <SectionBody block={block} />
          </section>
        ))
      )}
    </div>
  )
}
