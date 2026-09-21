import type { TemplateId } from './template'

/**
 * The five built-in section kinds, each of which a resume holds at most one
 * of. `custom` is separate: a resume may hold any number of custom sections,
 * each with a title the user writes.
 */
export type BuiltInSectionType =
  | 'summary'
  | 'experience'
  | 'skills'
  | 'education'
  | 'projects'

export type SectionType = BuiltInSectionType | 'custom'

export interface Profile {
  name: string
  title: string
  email: string
  phone: string
  location: string
  links: string
}

export interface SummaryData {
  text: string
}

export interface ExperienceItem {
  role: string
  org: string
  dates: string
  points: string[]
}
export interface ExperienceData {
  items: ExperienceItem[]
}

export interface SkillGroup {
  name: string
  items: string
}
export interface SkillsData {
  groups: SkillGroup[]
}

export interface EducationItem {
  school: string
  degree: string
  dates: string
  detail: string
}
export interface EducationData {
  items: EducationItem[]
}

export interface ProjectItem {
  name: string
  detail: string
}
export interface ProjectsData {
  items: ProjectItem[]
}

/**
 * A user-defined section: certifications, awards, publications, volunteering.
 * Entries are deliberately loose — a name, an optional right-aligned meta
 * (a date or issuer), and an optional detail line.
 */
export interface CustomEntry {
  name: string
  meta: string
  detail: string
}
export interface CustomData {
  items: CustomEntry[]
}

/** Maps each section type to the shape of its `data` payload. */
export interface SectionDataMap {
  summary: SummaryData
  experience: ExperienceData
  skills: SkillsData
  education: EducationData
  projects: ProjectsData
  custom: CustomData
}

/**
 * A single draggable block on the resume. Discriminated on `type` so
 * narrowing a block also narrows its `data` — no casts needed downstream.
 */
export type ResumeBlock = {
  [T in SectionType]: {
    id: string
    type: T
    label: string
    enabled: boolean
    data: SectionDataMap[T]
  }
}[SectionType]

export interface Resume {
  id: string
  title: string
  /** Which visual template renders this resume. */
  templateId: TemplateId
  profile: Profile
  /** Array order is render order; drag-and-drop reorders this. */
  blocks: ResumeBlock[]
}

export const SECTION_LABELS: Record<SectionType, string> = {
  summary: 'Summary',
  experience: 'Experience',
  skills: 'Skills',
  education: 'Education',
  projects: 'Projects',
  custom: 'Custom section',
}

/** The built-ins, in the order the "Add a section" chips present them. */
export const BUILT_IN_SECTION_TYPES: BuiltInSectionType[] = [
  'summary',
  'experience',
  'skills',
  'education',
  'projects',
]

export const SECTION_TYPES = Object.keys(SECTION_LABELS) as SectionType[]

/** True for the section kinds a resume may hold more than one of. */
export function isRepeatable(type: SectionType): boolean {
  return type === 'custom'
}
