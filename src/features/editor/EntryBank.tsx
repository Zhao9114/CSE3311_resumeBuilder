import { createContext, useContext, type ReactNode } from 'react'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { entryAt, entryFingerprint, type BlockDraft } from '../../store/entries'
import type { ResumeBlock } from '../../types'

interface EntryBankValue {
  /** Fingerprints of everything already in the bank. */
  saved: Set<string>
  saveEntry: (entry: BlockDraft) => void
}

const EntryBankContext = createContext<EntryBankValue | null>(null)

/**
 * Lets any item inside a section editor save itself to the block bank
 * without threading a callback through the list, row and editor.
 */
export function EntryBankProvider({ value, children }: { value: EntryBankValue; children: ReactNode }) {
  return <EntryBankContext.Provider value={value}>{children}</EntryBankContext.Provider>
}

/** "Save to bank" for one role, project, education entry or skill group. */
export function SaveEntryButton({ block, index }: { block: ResumeBlock; index: number }) {
  const bank = useContext(EntryBankContext)
  if (!bank) return null
  const { id: _id, ...draft } = block
  const entry = entryAt(draft, index)
  if (!entry) return null
  const isSaved = bank.saved.has(entryFingerprint(entry))
  const Icon = isSaved ? BookmarkCheck : Bookmark
  return (
    <button
      type="button"
      className={`entry-save${isSaved ? ' is-saved' : ''}`}
      onClick={() => !isSaved && bank.saveEntry(entry)}
      aria-pressed={isSaved}
      title={isSaved ? 'In your block bank' : 'Save this entry to your block bank'}
    >
      <Icon size={14} aria-hidden="true" />
      {isSaved ? 'In bank' : 'Save to bank'}
    </button>
  )
}
