import type { Application } from './application'
import type { Resume } from './resume'

/**
 * A frozen, point-in-time copy of a resume — what was actually sent to an
 * employer. The live resume keeps changing; a version never does, which is
 * what lets the tracker say truthfully which resume went with which
 * application.
 */
export interface ResumeVersion {
  id: string
  /** The live resume this was taken from. Null if that resume was deleted. */
  resumeId: string | null
  /** What the user called it, e.g. "Stripe — Backend Intern". */
  label: string
  /** ISO timestamp. */
  createdAt: string
  /** The full resume as it stood when the snapshot was taken. */
  resume: Resume
}

/**
 * The text for the tracker's "Resume used" column. Resolves by version id
 * only — never by the live resume — so later edits can't change the answer.
 */
export function resumeUsedLabel(
  app: Pick<Application, 'versionId'>,
  versions: ResumeVersion[],
): string {
  if (!app.versionId) return '—'
  return versions.find((v) => v.id === app.versionId)?.label ?? 'Unknown version'
}
