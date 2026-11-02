import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'

export interface ToastOptions {
  message: string
  /** One action button, e.g. Undo. */
  action?: { label: string; run: () => void }
}

interface ToastState extends ToastOptions {
  id: number
}

const ToastContext = createContext<((toast: ToastOptions) => void) | null>(null)

const VISIBLE_MS = 5000

/**
 * One toast at a time at the bottom of the screen; a new one replaces the
 * old. Announced politely to screen readers. Hovering or focusing it holds
 * it open so the action can be reached.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const [held, setHeld] = useState(false)
  const seq = useRef(0)

  const show = useCallback((options: ToastOptions) => {
    seq.current += 1
    setToast({ ...options, id: seq.current })
  }, [])

  useEffect(() => {
    if (!toast || held) return
    const timer = window.setTimeout(() => setToast(null), VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [toast, held])

  const value = useMemo(() => show, [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region no-print" role="status" aria-live="polite">
        {toast && (
          <div
            className="toast"
            key={toast.id}
            onMouseEnter={() => setHeld(true)}
            onMouseLeave={() => setHeld(false)}
            onFocus={() => setHeld(true)}
            onBlur={() => setHeld(false)}
          >
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  toast.action?.run()
                  setToast(null)
                  setHeld(false)
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              className="toast-close"
              aria-label="Dismiss"
              onClick={() => {
                setToast(null)
                setHeld(false)
              }}
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): (toast: ToastOptions) => void {
  const show = useContext(ToastContext)
  if (!show) throw new Error('useToast must be used inside a ToastProvider')
  return show
}
