import { useState } from 'react'
import { useAuth } from './AuthProvider'

type Mode = 'signIn' | 'signUp'

const MIN_PASSWORD = 8

/** Signed-out state: sign in, or create an account. */
export default function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const isSignUp = mode === 'signUp'

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    const trimmed = email.trim()
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setError('Enter a valid email address.')
      return
    }
    if (isSignUp && password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters for your password.`)
      return
    }
    setBusy(true)
    try {
      if (isSignUp) {
        const { needsConfirmation } = await signUp(trimmed, password)
        if (needsConfirmation) {
          setNotice(`Check ${trimmed} for a confirmation link, then sign in.`)
          setMode('signIn')
          setPassword('')
        }
      } else {
        await signIn(trimmed, password)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-card">
        <div className="brand auth-brand">
          <span className="brand-mark" aria-hidden="true">
            D
          </span>
          <span className="brand-name">Draftly</span>
        </div>
        <h1 className="pane-title">{isSignUp ? 'Create your account' : 'Sign in'}</h1>
        <p className="pane-sub">
          {isSignUp
            ? 'Your resumes, versions, and applications are saved to your account and visible only to you.'
            : 'Pick up where you left off.'}
        </p>

        {notice && (
          <p className="auth-notice" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={isSignUp ? MIN_PASSWORD : undefined}
            />
          </label>
          <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
            {busy ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="auth-switch">
          {isSignUp ? 'Already have an account?' : 'New to Draftly?'}{' '}
          <button
            type="button"
            className="link-btn"
            onClick={() => switchMode(isSignUp ? 'signIn' : 'signUp')}
          >
            {isSignUp ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      </div>
    </main>
  )
}
