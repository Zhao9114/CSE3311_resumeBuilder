/** Built-in pipeline statuses. `custom` is the escape hatch. */
export const APPLICATION_STATUSES = [
  'Applied',
  'Interview',
  'Waitlist',
  'Hold',
  'Accepted',
  'Rejected',
  'Declined',
] as const

export type BuiltInStatus = (typeof APPLICATION_STATUSES)[number]

/**
 * A status is either one of the built-ins or a user-typed custom label.
 * `customStatus` carries the label when `status` is 'Custom'.
 */
export type ApplicationStatus = BuiltInStatus | 'Custom'

export interface Application {
  id: string
  employer: string
  role: string
  status: ApplicationStatus
  /** Set only when `status` is 'Custom'. */
  customStatus?: string
  resumeId: string
  /** ISO date, yyyy-mm-dd. */
  appliedAt: string
}

/** Draft shape used by the add/edit form, before an id is assigned. */
export type ApplicationDraft = Omit<Application, 'id'>

/** Statuses that count as still live in the pipeline. */
const IN_PROGRESS: ApplicationStatus[] = [
  'Applied',
  'Interview',
  'Waitlist',
  'Hold',
  'Custom',
]

export function isInProgress(app: Application): boolean {
  return IN_PROGRESS.includes(app.status)
}

/** The label to show on screen for an application's status. */
export function statusLabel(app: Application): string {
  return app.status === 'Custom' ? app.customStatus || 'Custom' : app.status
}

/** CSS modifier suffix for the status pill. */
export function statusClass(app: Application): string {
  return app.status === 'Custom' ? 'custom' : app.status.toLowerCase()
}
