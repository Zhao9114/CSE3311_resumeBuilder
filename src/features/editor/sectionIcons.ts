import { Briefcase, FileText, FolderGit2, GraduationCap, Puzzle, Wrench, type LucideIcon } from 'lucide-react'
import type { SectionType } from '../../types'

/** One icon per section kind, paired with the --sec-* colours in tokens.css. */
export const SECTION_ICONS: Record<SectionType, LucideIcon> = {
  summary: FileText,
  experience: Briefcase,
  skills: Wrench,
  education: GraduationCap,
  projects: FolderGit2,
  custom: Puzzle,
}
