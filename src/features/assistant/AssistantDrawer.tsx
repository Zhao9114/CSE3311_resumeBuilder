import { useEffect, useRef, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { GripVertical, Send, Sparkles, X } from 'lucide-react'
import { INTENT_LABELS } from '../../ai/intent'
import { MAX_ASSISTANT_MESSAGE } from '../../ai/limits'
import { blockToText } from '../../ai/resumeText'
import { AiError } from '../../services/aiClient'
import { assistantService, type AssistantMessage, type Proposal } from '../../services/assistant'
import { useResume } from '../../store'
import type { DragData } from '../dnd/dragData'
import type { ResumeBlock } from '../../types'

interface AssistantDrawerProps {
  open: boolean
  onClose: () => void
}

let seq = 0
const nextId = () => `m${++seq}`

const SUGGESTIONS = [
  'Write a summary for a backend internship',
  'Rewrite my bullets to lead with action verbs',
  'Add Python, Docker and PostgreSQL to my skills',
]

const OFFLINE_REPLY =
  'The assistant is offline on this deployment, so no request was sent. ' +
  'Everything else in the builder still works.'

/** The proposed section as plain text, without its heading line. */
function previewText(proposal: Proposal): string {
  return blockToText(proposal.block).split('\n').slice(1).join('\n')
}

/**
 * Chat with the resume assistant. Every message goes through the intent
 * parser on the server, and anything the model writes comes back as a
 * proposal card: nothing reaches the resume until the user presses Insert or
 * Replace.
 */
export default function AssistantDrawer({ open, onClose }: AssistantDrawerProps) {
  const { resume, insertBlock, updateBlock } = useResume()
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  /** "messageId:index" for each proposal the user has already applied. */
  const [applied, setApplied] = useState<Set<string>>(new Set())
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [messages, thinking])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || thinking || !resume || trimmed.length > MAX_ASSISTANT_MESSAGE) return
    const history = messages.filter((m) => !m.error)
    setMessages((m) => [...m, { id: nextId(), role: 'user', text: trimmed }])
    setDraft('')
    setThinking(true)
    try {
      const reply = await assistantService.send({ message: trimmed, resume, history })
      setMessages((m) => [...m, { id: nextId(), role: 'assistant', ...reply }])
    } catch (err) {
      const offline = err instanceof AiError && err.code === 'offline'
      const message = offline ? OFFLINE_REPLY : err instanceof Error ? err.message : 'Something went wrong.'
      setMessages((m) => [...m, { id: nextId(), role: 'assistant', text: message, error: true }])
    } finally {
      setThinking(false)
    }
  }

  function apply(messageId: string, index: number, proposal: Proposal) {
    const target = proposal.replaces && resume?.blocks.find((b) => b.id === proposal.replaces)
    if (target) {
      // Keep the live block's id and visibility; take the proposed content.
      void updateBlock({ ...proposal.block, id: target.id, enabled: target.enabled } as ResumeBlock)
    } else {
      // The block was removed since the reply came in, or this is a new section.
      void insertBlock(proposal.block)
    }
    markApplied(`${messageId}:${index}`)
  }

  function markApplied(key: string) {
    setApplied((prev) => new Set(prev).add(key))
  }

  if (!open) return null

  const overLimit = draft.trim().length > MAX_ASSISTANT_MESSAGE

  return (
    <aside className="assistant no-print" role="complementary" aria-label="Resume assistant">
      <div className="assistant-head">
        <h2>
          <Sparkles size={18} aria-hidden="true" />
          Assistant
        </h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close assistant">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="assistant-log" ref={logRef} role="log" aria-live="polite">
        {messages.length === 0 && (
          <div className="assistant-empty">
            <p>
              Ask for a section, or start from one of these. Suggestions appear as cards — nothing
              changes on your resume until you accept one.
            </p>
            <div className="assistant-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div className={`turn turn-${m.role}`} key={m.id}>
            {m.role === 'assistant' && m.intent && (
              <span
                className="intent-chip"
                title={
                  m.intentSource === 'model'
                    ? 'The intent parser asked the model to classify this request.'
                    : 'The intent parser matched this request with its rules — no model call needed.'
                }
              >
                {INTENT_LABELS[m.intent]}
                {m.intentSource === 'model' && ' · AI-routed'}
              </span>
            )}
            <div className={`bubble bubble-${m.role}${m.error ? ' is-error' : ''}`}>
              <span className="visually-hidden">
                {m.role === 'user' ? 'You said: ' : 'Assistant said: '}
              </span>
              {m.text}
            </div>

            {m.proposals?.map((p, i) => {
              const key = `${m.id}:${i}`
              return (
                <ProposalCard
                  key={key}
                  dragId={`proposal:${key}`}
                  proposal={p}
                  replacing={p.replaces ? resume?.blocks.find((b) => b.id === p.replaces) : undefined}
                  done={applied.has(key)}
                  onApply={() => apply(m.id, i, p)}
                  onDropped={() => markApplied(key)}
                />
              )
            })}
          </div>
        ))}

        {thinking && (
          <div className="bubble bubble-assistant is-thinking" aria-label="Thinking">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        )}
      </div>

      <form
        className="assistant-form"
        onSubmit={(e) => {
          e.preventDefault()
          void send(draft)
        }}
      >
        <label className="visually-hidden" htmlFor="assistant-input">
          Message the assistant
        </label>
        <textarea
          id="assistant-input"
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask for a summary, bullets, skills…"
          rows={2}
          aria-invalid={overLimit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send(draft)
            }
          }}
        />
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={thinking || !resume || overLimit || draft.trim() === ''}
          aria-label="Send"
        >
          <Send size={14} aria-hidden="true" />
        </button>
      </form>
      {overLimit && (
        <p className="field-hint is-error">
          Keep messages under {MAX_ASSISTANT_MESSAGE.toLocaleString()} characters.
        </p>
      )}
    </aside>
  )
}

interface ProposalCardProps {
  dragId: string
  proposal: Proposal
  /** The live block this would overwrite, if it still exists. */
  replacing: ResumeBlock | undefined
  done: boolean
  onApply: () => void
  onDropped: () => void
}

/**
 * One suggested section. A new section can be dragged straight into the
 * section list at any position; a replacement is applied with its button,
 * because it belongs where the section it replaces already is.
 */
function ProposalCard({ dragId, proposal, replacing, done, onApply, onDropped }: ProposalCardProps) {
  const draggable = !replacing && !done
  const data: DragData = { kind: 'proposal', block: proposal.block, onApplied: onDropped }
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: dragId, data, disabled: !draggable })
  const fromCard = (e: React.SyntheticEvent) => !(e.target as HTMLElement).closest('button')

  return (
    <div
      ref={setNodeRef}
      className={`proposal${draggable ? ' is-grabbable' : ''}${isDragging ? ' is-lifted' : ''}${done ? ' is-done' : ''}`}
      data-type={proposal.block.type}
      onMouseDown={(e) => draggable && fromCard(e) && listeners?.onMouseDown?.(e)}
      onTouchStart={(e) => draggable && fromCard(e) && listeners?.onTouchStart?.(e)}
    >
      <div className="proposal-head">
        <span className="block-label">
          {draggable && <GripVertical size={14} aria-hidden="true" className="proposal-grip" />}
          {proposal.block.label}
        </span>
        <span className="block-meta">
          {replacing ? `Replaces your ${replacing.label}` : draggable ? 'New section · drag into your list' : 'New section'}
        </span>
      </div>
      <pre className="proposal-preview">{previewText(proposal)}</pre>
      <button type="button" className="btn btn-primary btn-sm" disabled={done} onClick={onApply}>
        {done ? 'Applied' : replacing ? `Replace ${replacing.label}` : 'Insert'}
      </button>
    </div>
  )
}
