import { useEffect, useMemo, useState } from 'react'
import { Eye, PencilLine, Save, ScanSearch } from 'lucide-react'
import { useToast } from '../../components/Toast'
import { useReducedMotion } from '../../components/useReducedMotion'
import { entryFingerprint, splitIntoEntries, useBlockLibrary, useResume, useVersions, type BlockDraft } from '../../store'
import { EntryBankProvider } from './EntryBank'
import {
  BUILT_IN_SECTION_TYPES,
  SECTION_LABELS,
  type ResumeBlock,
  type SectionType,
} from '../../types'
import AtsPanel from '../ats/AtsPanel'
import type { TailorResult } from '../../services/tailor'
import { useBuilderDnd } from '../dnd/BuilderDnd'
import DropZones from '../dnd/DropZones'
import PaletteChip from './PaletteChip'
import BlockLibraryPanel from './BlockLibraryPanel'
import BlockList from './BlockList'
import SaveBlockModal from './SaveBlockModal'
import SaveVersionModal from './SaveVersionModal'
import VersionsPanel from './VersionsPanel'
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
    updateProfile,
    setTemplate,
    insertBlock,
    replaceResume,
  } = useResume()
  const {
    versions,
    loading: versionsLoading,
    error: versionError,
    saveVersion,
  } = useVersions()
  const [savingVersion, setSavingVersion] = useState(false)
  const {
    savedBlocks,
    loading: libraryLoading,
    saveBlock,
    saveEntries,
    renameBlock,
    removeBlock: removeSavedBlock,
  } = useBlockLibrary()
  const bankFingerprints = useMemo(
    () => new Set(savedBlocks.map((s) => entryFingerprint(s.block))),
    [savedBlocks],
  )
  const [savingBlock, setSavingBlock] = useState<ResumeBlock | null>(null)
  const [atsOpen, setAtsOpen] = useState(false)
  // On a phone the editor and the page don't fit side by side, so one is
  // shown at a time. Ignored on wider screens (see iteration4.css).
  const [mobilePane, setMobilePane] = useState<'edit' | 'preview'>('edit')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Set when a custom section is added, so its editor can be opened as soon
  // as the new block appears in the resume.
  const [pendingCustom, setPendingCustom] = useState<Set<string> | null>(null)
  const { previewBlocks, justMovedId, recordUndo, undo } = useBuilderDnd()
  const toast = useToast()
  const reducedMotion = useReducedMotion()

  // While dragging, the paper shows the order the drop would produce.
  const shown = resume && previewBlocks ? { ...resume, blocks: previewBlocks } : resume

  // Bring a section that just moved or arrived into view on the paper.
  useEffect(() => {
    if (!justMovedId) return
    document
      .querySelector(`.paper [data-block-id="${CSS.escape(justMovedId)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' })
  }, [justMovedId, reducedMotion])

  function handleRemove(id: string) {
    const block = resume?.blocks.find((b) => b.id === id)
    if (!block) return
    recordUndo(`removed ${block.label}`)
    void removeBlock(id)
    toast({ message: `Removed ${block.label}`, action: { label: 'Undo', run: undo } })
  }

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

  async function handleAddAllToBank() {
    if (!resume) return
    const entries = resume.blocks.flatMap((b) => {
      const { id: _id, ...draft } = b
      return splitIntoEntries(draft)
    })
    const added = await saveEntries(entries)
    toast({
      message: added
        ? `Added ${added} ${added === 1 ? 'entry' : 'entries'} to your block bank`
        : 'Everything on this resume is already in your bank',
    })
  }

  function handleSaveEntry(entry: BlockDraft) {
    void saveEntries([entry]).then((added) => {
      if (added) toast({ message: 'Saved to your block bank' })
    })
  }

  function handleInsertSaved(block: BlockDraft) {
    recordUndo(`inserted ${block.label}`)
    void insertBlock(block)
    toast({ message: `Added to ${block.label}`, action: { label: 'Undo', run: undo } })
  }

  async function handleApplyTailored(draft: TailorResult, postingTitle: string) {
    if (!resume) return
    const job = postingTitle || 'this job'
    // A frozen copy first, so the untailored resume is always one click away
    // in Versions even after the undo history is gone.
    await saveVersion(resume, `Before tailoring: ${job}`)
    recordUndo(`tailored for ${job}`)
    void replaceResume({ ...draft.resume, id: resume.id, title: resume.title })
    setAtsOpen(false)
    toast({ message: `Tailored for ${job}`, action: { label: 'Undo', run: undo } })
  }

  async function handleSaveTailored(draft: TailorResult, postingTitle: string) {
    if (!resume) return
    const label = `Tailored: ${postingTitle || 'job posting'}`
    const saved = await saveVersion({ ...draft.resume, id: resume.id, title: label }, label)
    if (saved) toast({ message: `Saved “${label}” to Versions` })
  }

  function handleAddCustom() {
    const existing = resume?.blocks.filter((b) => b.type === 'custom') ?? []
    setPendingCustom(new Set(existing.map((b) => b.id)))
    addBlock('custom')
  }

  return (
    <EntryBankProvider value={{ saved: bankFingerprints, saveEntry: handleSaveEntry }}>
    <main className="builder-view" data-pane={mobilePane}>
      <div className="mobile-switch no-print" role="group" aria-label="Show">
        <button type="button" aria-pressed={mobilePane === 'edit'} onClick={() => setMobilePane('edit')}>
          <PencilLine size={15} aria-hidden="true" /> Edit
        </button>
        <button
          type="button"
          aria-pressed={mobilePane === 'preview'}
          onClick={() => {
            setMobilePane('preview')
            window.scrollTo({ top: 0 })
          }}
        >
          <Eye size={15} aria-hidden="true" /> Preview
        </button>
      </div>
      <section className="editor-pane">
        <div className="pane-head">
          <div>
            <h1 className="pane-title">Sections</h1>
            <p className="pane-sub">
              Drag to reorder. Toggle to show or hide on the resume.
            </p>
          </div>
          <div className="pane-head-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!resume}
              onClick={() => setSavingVersion(true)}
            >
              <Save size={14} aria-hidden="true" />
              Save version
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setAtsOpen(true)}
            >
              <ScanSearch size={14} aria-hidden="true" />
              ATS check
            </button>
          </div>
        </div>

        {(error || versionError) && (
          <p className="error-banner">{error ?? versionError}</p>
        )}

        {resume && (
          <>
            <TemplatePicker value={resume.templateId} onChange={setTemplate} />
            <ProfileEditor profile={resume.profile} onChange={updateProfile} />
          </>
        )}

        {loading || !resume ? (
          <div aria-busy="true" aria-label="Loading sections">
            <div className="skeleton" style={{ height: 48 }} />
            <div className="skeleton" style={{ height: 48 }} />
            <div className="skeleton" style={{ height: 48 }} />
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
            onRemove={handleRemove}
            onSave={setSavingBlock}
          />
        )}

        <div className="add-block">
          <span>Add a section</span>
          <span className="add-block-hint">Click to add at the end, or drag into place.</span>
          <div className="add-block-buttons">
            {BUILT_IN_SECTION_TYPES.map((type) => {
              const exists = present.has(type)
              return (
                <PaletteChip
                  key={type}
                  sectionType={type}
                  disabled={exists}
                  title={exists ? 'Already added' : `Add ${SECTION_LABELS[type]}`}
                  onClick={() => addBlock(type)}
                >
                  {SECTION_LABELS[type]}
                </PaletteChip>
              )
            })}
            {/* Custom sections are never capped, so this chip never disables.
                Adding one opens its editor so the title can be typed at once. */}
            <PaletteChip
              sectionType="custom"
              className="chip-custom"
              title="Add a section with your own title"
              onClick={handleAddCustom}
            >
              Custom section
            </PaletteChip>
          </div>
        </div>
        <BlockLibraryPanel
          savedBlocks={savedBlocks}
          loading={libraryLoading}
          onInsert={handleInsertSaved}
          onRemove={removeSavedBlock}
          onRename={renameBlock}
          onAddAll={() => void handleAddAllToBank()}
        />
        <VersionsPanel
          versions={versions}
          loading={versionsLoading}
          onRestore={(v) => {
            // Keep the live resume's own identity and name; take only the
            // version's content.
            if (!resume) return
            recordUndo(`restored ${v.label}`)
            void replaceResume({ ...v.resume, id: resume.id, title: resume.title })
            toast({ message: `Restored ${v.label}`, action: { label: 'Undo', run: undo } })
          }}
        />
        <DropZones />
      </section>

      <section className="preview-pane">
        {shown ? (
          <ResumePaper resume={shown} highlightId={justMovedId} />
        ) : (
          <div className="paper" aria-busy="true">
            <div className="skeleton" style={{ height: 34, width: '55%' }} />
            <div className="skeleton" style={{ width: '35%' }} />
          </div>
        )}
      </section>
      {savingBlock && (
        <SaveBlockModal
          block={savingBlock}
          onSave={(draft) => {
            saveBlock(draft)
            setSavingBlock(null)
          }}
          onClose={() => setSavingBlock(null)}
        />
      )}

      {savingVersion && resume && (
        <SaveVersionModal
          defaultLabel={`${resume.title} — ${new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}`}
          onSave={(label) => {
            saveVersion(resume, label)
            setSavingVersion(false)
          }}
          onClose={() => setSavingVersion(false)}
        />
      )}

      {atsOpen && (
        <AtsPanel
          onClose={() => setAtsOpen(false)}
          bank={savedBlocks}
          onApplyTailored={(draft, title) => void handleApplyTailored(draft, title)}
          onSaveTailored={(draft, title) => void handleSaveTailored(draft, title)}
        />
      )}
    </main>
    </EntryBankProvider>
  )
}
