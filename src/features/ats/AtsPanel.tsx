import { useState } from 'react'
import Modal from '../../components/Modal'
import { MAX_JOB_DESCRIPTION, MIN_JOB_DESCRIPTION } from '../../ai/limits'
import { useResume } from '../../store'
import { AiError } from '../../services/aiClient'
import { atsService, SAMPLE_ATS_RESULT, type AtsResult } from '../../services/ats'

interface AtsPanelProps {
  onClose: () => void
}

/** Errors where sample output is more useful than a dead end. */
const FALL_BACK_TO_SAMPLE = new Set(['offline', 'budget_exhausted'])

function scoreTone(score: number): 'good' | 'fair' | 'weak' {
  if (score >= 75) return 'good'
  if (score >= 50) return 'fair'
  return 'weak'
}

/**
 * Scores the live resume against a pasted posting. The model lists what the
 * posting asks for; the match and the score are computed on the server in
 * plain code, so they are repeatable (see server/ai/atsScore.ts).
 */
export default function AtsPanel({ onClose }: AtsPanelProps) {
  const { resume } = useResume()
  const [jobDescription, setJobDescription] = useState('')
  const [result, setResult] = useState<AtsResult | null>(null)
  const [isSample, setIsSample] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  const length = jobDescription.trim().length
  const tooShort = length < MIN_JOB_DESCRIPTION
  const tooLong = length > MAX_JOB_DESCRIPTION

  async function handleRun(e: React.FormEvent) {
    e.preventDefault()
    if (!resume || tooShort || tooLong || running) return
    setRunning(true)
    setError(null)
    try {
      setResult(await atsService.analyze(resume, jobDescription))
      setIsSample(false)
    } catch (err) {
      const code = err instanceof AiError ? err.code : 'failed'
      if (FALL_BACK_TO_SAMPLE.has(code)) {
        setResult(SAMPLE_ATS_RESULT)
        setIsSample(true)
      } else {
        setResult(null)
      }
      setError(err instanceof Error ? err.message : 'The check failed.')
    } finally {
      setRunning(false)
    }
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
            disabled={running || tooShort || tooLong || !resume}
          >
            {running ? 'Analysing…' : 'Run check'}
          </button>
        </>
      }
    >
      <form id="ats-form" onSubmit={handleRun}>
        <label className="field">
          <span>Job description</span>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the full posting here…"
            rows={7}
            aria-describedby="ats-count"
          />
        </label>
        <p id="ats-count" className={`field-hint${tooLong ? ' is-error' : ''}`}>
          {tooShort
            ? `Paste at least ${MIN_JOB_DESCRIPTION} characters of the posting.`
            : `${length.toLocaleString()} / ${MAX_JOB_DESCRIPTION.toLocaleString()} characters`}
        </p>
      </form>

      {error && (
        <p className={isSample ? 'placeholder-note' : 'error-banner'} role="alert">
          {error}
          {isSample && ' Showing sample output instead — not an analysis of your resume.'}
        </p>
      )}

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
              className={`ats-ring tone-${scoreTone(result.score)}`}
              style={{ ['--pct' as string]: result.score }}
              role="img"
              aria-label={`Match score ${result.score} out of 100`}
            >
              <span>{result.score}</span>
            </div>
            <div className="ats-score-text">
              <h3>{result.verdict}</h3>
              <p>
                {isSample
                  ? 'Sample output — not a real analysis of your resume.'
                  : result.postingTitle
                    ? `Against “${result.postingTitle}”. ${result.matched.length} of ${
                        result.matched.length + result.missing.length
                      } keywords found.`
                    : `${result.matched.length} of ${
                        result.matched.length + result.missing.length
                      } keywords found.`}
              </p>
            </div>
          </div>

          {result.matched.length > 0 && (
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
          )}

          {result.requiredMissing.length > 0 && (
            <div className="ats-group">
              <h4>Missing — required</h4>
              <div className="tag-row">
                {result.requiredMissing.map((k) => (
                  <span className="tag tag-no" key={k}>
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.preferredMissing.length > 0 && (
            <div className="ats-group">
              <h4>Missing — nice to have</h4>
              <div className="tag-row">
                {result.preferredMissing.map((k) => (
                  <span className="tag tag-maybe" key={k}>
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.tips.length > 0 && (
            <div className="ats-group">
              <h4>Suggestions</h4>
              <ul className="ats-tips">
                {result.tips.map((t) => (
                  <li key={t.text}>
                    {t.section && <span className="tip-section">{t.section}</span>}
                    {t.text}
                  </li>
                ))}
              </ul>
              {!isSample && (
                <p className="field-hint">
                  Only add a missing keyword if you really have that experience.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
