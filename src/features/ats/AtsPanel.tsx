import { useState } from 'react'
import Modal from '../../components/Modal'
import type { AtsResult } from '../../services/ats'

interface AtsPanelProps {
  onClose: () => void
}

/**
 * UI placeholder for the ATS checker.
 *
 * TODO(iteration-2): replace PLACEHOLDER_RESULT with a real
 * atsService.analyze(resume, jobDescription) call. The contract in
 * src/services/ats.ts already matches this shape, so only this component
 * and the service implementation change — nothing else.
 */
const PLACEHOLDER_RESULT: AtsResult = {
  score: 78,
  matched: ['React', 'TypeScript', 'REST', 'Postgres', 'testing', 'accessibility'],
  missing: ['CI/CD', 'Kubernetes', 'GraphQL'],
  tips: [
    'Add a metric to the CMS bullet — accessibility scores or page count moved.',
    'The job description mentions CI/CD; if you have touched GitHub Actions, name it.',
    'Lead each experience bullet with an action verb in past tense for consistency.',
  ],
}

export default function AtsPanel({ onClose }: AtsPanelProps) {
  const [jobDescription, setJobDescription] = useState('')
  const [result, setResult] = useState<AtsResult | null>(null)
  const [running, setRunning] = useState(false)

  function handleRun(e: React.FormEvent) {
    e.preventDefault()
    setRunning(true)
    // A short delay so the loading state is visible; no network call is made.
    window.setTimeout(() => {
      setResult(PLACEHOLDER_RESULT)
      setRunning(false)
    }, 550)
  }

  return (
    <Modal
      title="ATS check"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button
            type="submit"
            form="ats-form"
            className="btn btn-primary"
            disabled={running}
          >
            {running ? 'Analysing…' : 'Run check'}
          </button>
        </>
      }
    >
      <p className="placeholder-note">
        Placeholder. This screen shows fixed sample output and makes no network
        request — the real analysis arrives in iteration 2.
      </p>

      <form id="ats-form" onSubmit={handleRun}>
        <label className="field">
          <span>Job description</span>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the posting here…"
          />
        </label>
      </form>

      {running && (
        <div aria-busy="true" aria-label="Analysing">
          <div className="skeleton" style={{ height: 60 }} />
          <div className="skeleton" />
          <div className="skeleton" style={{ width: '70%' }} />
        </div>
      )}

      {result && !running && (
        <div className="ats-result">
          <div className="ats-score">
            <div
              className="ats-ring"
              style={{ ['--pct' as string]: result.score }}
              role="img"
              aria-label={`Sample match score ${result.score} out of 100`}
            >
              <span>{result.score}</span>
            </div>
            <div className="ats-score-text">
              <h3>Strong match</h3>
              <p>Sample output — not a real analysis of your resume.</p>
            </div>
          </div>

          <div className="ats-group">
            <h4>Keywords found</h4>
            <div className="tag-row">
              {result.matched.map((k) => (
                <span className="tag tag-yes" key={k}>
                  {k}
                </span>
              ))}
            </div>
          </div>

          <div className="ats-group">
            <h4>Missing from the posting</h4>
            <div className="tag-row">
              {result.missing.map((k) => (
                <span className="tag tag-no" key={k}>
                  {k}
                </span>
              ))}
            </div>
          </div>

          <div className="ats-group">
            <h4>Suggestions</h4>
            <ul className="ats-tips">
              {result.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Modal>
  )
}
