import { useEffect, useRef, useState } from 'react'
import type { AssistantMessage } from '../../services/assistant'

interface AssistantDrawerProps {
  open: boolean
  onClose: () => void
}

let seq = 0
const nextId = () => `m${++seq}`

/**
 * Scripted stand-in for the resume assistant. Replies are canned and no
 * network request is made.
 *
 * TODO(iteration-2): call assistantService.send() and render the blocks it
 * returns in `proposed`, with an Insert action per block.
 */
const SCRIPTED_REPLY =
  'Placeholder response. In iteration 2 this will call a model and offer ' +
  'generated blocks you can insert straight into the resume.'

const SUGGESTIONS = [
  'Write a summary for a backend internship',
  'Draft an experience block from this job description',
  'Rewrite my bullets to lead with action verbs',
]

export default function AssistantDrawer({ open, onClose }: AssistantDrawerProps) {
  const [messages, setMessages] = useState<AssistantMessage[]>([])
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

  function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || thinking) return
    setMessages((m) => [...m, { id: nextId(), role: 'user', text: trimmed }])
    setDraft('')
    setThinking(true)
    window.setTimeout(() => {
      setMessages((m) => [
        ...m,
        { id: nextId(), role: 'assistant', text: SCRIPTED_REPLY },
      ])
      setThinking(false)
    }, 600)
  }

  if (!open) return null

  return (
    <aside
      className="assistant no-print"
      role="complementary"
      aria-label="Resume assistant"
    >
      <div className="assistant-head">
        <h2>Assistant</h2>
        <button
          type="button"
          className="icon-btn"
          onClick={onClose}
          aria-label="Close assistant"
        >
          &times;
        </button>
      </div>

      <p className="placeholder-note">
        Placeholder. Replies are scripted and no request leaves your browser.
      </p>

      <div className="assistant-log" ref={logRef} role="log" aria-live="polite">
        {messages.length === 0 && (
          <div className="assistant-empty">
            <p>Ask for a section, or start from one of these:</p>
            <div className="assistant-suggestions">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="chip"
                  onClick={() => send(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div className={`bubble bubble-${m.role}`} key={m.id}>
            <span className="visually-hidden">
              {m.role === 'user' ? 'You said: ' : 'Assistant said: '}
            </span>
            {m.text}
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
          send(draft)
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
          placeholder="Ask for a block or a whole resume…"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send(draft)
            }
          }}
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={thinking}>
          Send
        </button>
      </form>
    </aside>
  )
}
