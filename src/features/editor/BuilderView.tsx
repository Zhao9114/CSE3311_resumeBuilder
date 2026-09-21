import { useEffect, useState } from 'react'
import { useResume } from '../../store'
import {
  BUILT_IN_SECTION_TYPES,
  SECTION_LABELS,
  type SectionType,
} from '../../types'
import BlockList from './BlockList'
import ProfileEditor from './ProfileEditor'
import TemplatePicker from './TemplatePicker'
import ResumePaper from './ResumePaper'

export default function BuilderView() {
  const {
    resume,
    loading,
    error,
    addBlock,
    removeBlock,
    updateBlock,
    toggleBlock,
    reorderBlocks,
    updateProfile,
    setTemplate,
  } = useResume()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Set when a custom section is added, so its editor can be opened as soon
  // as the new block appears in the resume.
  const [pendingCustom, setPendingCustom] = useState<Set<string> | null>(null)

  const present = new Set<SectionType>(resume?.blocks.map((b) => b.type) ?? [])

  useEffect(() => {
    if (!pendingCustom || !resume) return
    const added = resume.blocks.find(
      (b) => b.type === 'custom' && !pendingCustom.has(b.id),
    )
    if (added) {
      setExpandedId(added.id)
      setPendingCustom(null)
    }
  }, [resume, pendingCustom])

  function handleAddCustom() {
    const existing = resume?.blocks.filter((b) => b.type === 'custom') ?? []
    setPendingCustom(new Set(existing.map((b) => b.id)))
    addBlock('custom')
  }

  return (
    <main className="builder-view">
      <section className="editor-pane">
        <div className="pane-head">
          <div>
            <h1 className="pane-title">Sections</h1>
            <p className="pane-sub">
              Drag to reorder. Toggle to show or hide on the resume.
            </p>
          </div>
        </div>

        {error && <p className="error-banner">{error}</p>}

        {resume && (
          <>
            <TemplatePicker value={resume.templateId} onChange={setTemplate} />
            <ProfileEditor profile={resume.profile} onChange={updateProfile} />
          </>
        )}

        {loading ? (
          <div aria-busy="true" aria-label="Loading sections">
            <div className="skeleton" style={{ height: 48 }} />
            <div className="skeleton" style={{ height: 48 }} />
            <div className="skeleton" style={{ height: 48 }} />
          </div>
        ) : !resume || resume.blocks.length === 0 ? (
          <div className="empty">
            <h3>No sections yet</h3>
            <p>Add your first section to start building the resume.</p>
          </div>
        ) : (
          <BlockList
            blocks={resume.blocks}
            expandedId={expandedId}
            onToggleExpand={(id) =>
              setExpandedId((cur) => (cur === id ? null : id))
            }
            onToggleEnabled={toggleBlock}
            onChange={updateBlock}
            onRemove={removeBlock}
            onReorder={reorderBlocks}
          />
        )}

        <div className="add-block">
          <span>Add a section</span>
          <div className="add-block-buttons">
            {BUILT_IN_SECTION_TYPES.map((type) => {
              const exists = present.has(type)
              return (
                <button
                  key={type}
                  type="button"
                  className="chip"
                  disabled={exists}
                  title={exists ? 'Already added' : `Add ${SECTION_LABELS[type]}`}
                  onClick={() => addBlock(type)}
                >
                  + {SECTION_LABELS[type]}
                </button>
              )
            })}
            {/* Custom sections are never capped, so this chip never disables.
                Adding one opens its editor so the title can be typed at once. */}
            <button
              type="button"
              className="chip chip-custom"
              title="Add a section with your own title"
              onClick={handleAddCustom}
            >
              + Custom section
            </button>
          </div>
        </div>
      </section>

      <section className="preview-pane">
        {resume ? (
          <ResumePaper resume={resume} />
        ) : (
          <div className="paper" aria-busy="true">
            <div className="skeleton" style={{ height: 34, width: '55%' }} />
            <div className="skeleton" style={{ width: '35%' }} />
          </div>
        )}
      </section>
    </main>
  )
}
