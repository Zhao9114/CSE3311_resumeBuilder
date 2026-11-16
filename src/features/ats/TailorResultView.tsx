import { ArrowRight, Database, FileText } from 'lucide-react'
import { SECTION_LABELS, type BuiltInSectionType } from '../../types'
import type { TailorPick, TailorResult } from '../../services/tailor'

interface TailorResultViewProps {
  result: TailorResult
  onApply: () => void
  onSave: () => void
  onDiscard: () => void
}

const SECTIONS: BuiltInSectionType[] = ['experience', 'projects', 'skills', 'education']

/**
 * What tailoring chose and why: each pick with where it came from and the
 * posting keywords it covers, what was left out, and the score change. The
 * user decides whether to apply it.
 */
export default function TailorResultView({ result, onApply, onSave, onDiscard }: TailorResultViewProps) {
  const { picks, left, scoreBefore, scoreAfter, summarySource, notice } = result
  const delta = scoreAfter - scoreBefore
  const fromBank = picks.filter((p) => p.source === 'bank').length

  return (
    <div className="tailor-result">
      <div className="tailor-score" aria-label={`Score ${scoreBefore} before, ${scoreAfter} after`}>
        <span className="tailor-score-num">{scoreBefore}</span>
        <ArrowRight size={16} aria-hidden="true" />
        <span className={`tailor-score-num${delta > 0 ? ' is-up' : ''}`}>{scoreAfter}</span>
        <span className="tailor-score-note">
          {delta > 0 ? `+${delta} points` : delta === 0 ? 'same score' : `${delta} points`}
          {fromBank > 0 && ` · ${fromBank} ${fromBank === 1 ? 'entry' : 'entries'} from your bank`}
        </span>
      </div>

      {SECTIONS.map((section) => {
        const inSection = picks.filter((p) => p.section === section)
        if (inSection.length === 0) return null
        return (
          <div key={section} className="tailor-section">
            <h5>{SECTION_LABELS[section]}</h5>
            <ul className="tailor-picks">
              {inSection.map((p) => (
                <PickRow key={`${p.section}:${p.name}`} pick={p} />
              ))}
            </ul>
          </div>
        )
      })}

      {left.length > 0 && (
        <p className="field-hint">
          Left out for this job: {left.map((l) => l.name).join('; ')}. They stay in your bank.
        </p>
      )}

      <p className="field-hint">
        {summarySource === 'model'
          ? 'Summary rewritten by AI from only the entries above.'
          : (notice ?? 'Summary kept as it was.')}
      </p>

      <div className="tailor-actions">
        <button type="button" className="btn btn-primary" onClick={onApply}>
          Apply to resume
        </button>
        <button type="button" className="btn btn-ghost" onClick={onSave}>
          Save as version only
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDiscard}>
          Discard
        </button>
      </div>
      <p className="field-hint">
        Applying first saves your current resume as a version, and can be undone.
      </p>
    </div>
  )
}

function PickRow({ pick }: { pick: TailorPick }) {
  const Icon = pick.source === 'bank' ? Database : FileText
  return (
    <li className="tailor-pick">
      <span className={`tailor-source is-${pick.source}`} title={pick.source === 'bank' ? 'From your block bank' : 'Already on your resume'}>
        <Icon size={12} aria-hidden="true" />
        {pick.source === 'bank' ? 'Bank' : 'Resume'}
      </span>
      <span className="tailor-name">{pick.name}</span>
      {pick.matched.length > 0 && (
        <span className="tag-row tailor-matched">
          {pick.matched.map((k) => (
            <span className="tag tag-yes" key={k}>
              {k}
            </span>
          ))}
        </span>
      )}
    </li>
  )
}
