/** The five section kinds a resume can be built from. */
export type SectionType =
  | 'summary'
  | 'experience'
  | 'skills'
  | 'education'
  | 'projects'

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

/** Maps each section type to the shape of its `data` payload. */
export interface SectionDataMap {
  summary: SummaryData
  experience: ExperienceData
  skills: SkillsData
  education: EducationData
  projects: ProjectsData
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
}

export const SECTION_TYPES = Object.keys(SECTION_LABELS) as SectionType[]
