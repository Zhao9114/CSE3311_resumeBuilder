import type {
  Application,
  Resume,
  ResumeBlock,
  ResumeVersion,
  SectionType,
} from '../types'
import { BUILT_IN_SECTION_TYPES, DEFAULT_TEMPLATE, SECTION_LABELS } from '../types/index.js'

export const seedResume: Resume = {
  id: 'r1',
  title: 'General SWE — v2',
  templateId: DEFAULT_TEMPLATE,
  profile: {
    name: 'Jordan Avery Chen',
    title: 'Software Engineer',
    email: 'jordan.chen@email.com',
    phone: '(214) 555-0182',
    location: 'Arlington, TX',
    links: 'github.com/jachen · linkedin.com/in/jachen',
  },
  blocks: [
    {
      id: 'b1',
      type: 'summary',
      label: 'Summary',
      enabled: true,
      data: {
        text: 'Computer science student with internship experience building web applications end to end. Comfortable across the stack, from Postgres schemas to React interfaces, and happiest shipping features other people actually use.',
      },
    },
    {
      id: 'b2',
      type: 'experience',
      label: 'Experience',
      enabled: true,
      data: {
        items: [
          {
            role: 'Software Engineering Intern',
            org: 'Northbridge Labs',
            dates: 'Summer 2025',
            points: [
              'Built a job-application tracker feature used by 400+ beta users, cutting manual status updates by 60%.',
              'Wrote the REST endpoints and Postgres schema behind it, plus the React front end.',
              'Added integration tests that caught three regressions before release.',
            ],
          },
          {
            role: 'Web Developer (Part-time)',
            org: 'University IT Office',
            dates: '2024 – Present',
            points: [
              "Maintain the university's public site in a CMS with hand-written HTML, CSS, and JavaScript.",
              'Fixed 20+ accessibility issues to meet WCAG AA, improving audit scores across key pages.',
            ],
          },
        ],
      },
    },
    {
      id: 'b3',
      type: 'skills',
      label: 'Skills',
      enabled: true,
      data: {
        groups: [
          { name: 'Languages', items: 'TypeScript, Python, Java, SQL' },
          { name: 'Frameworks', items: 'React, FastAPI, Spring Boot' },
          { name: 'Tools', items: 'Git, Docker, Supabase, Postgres' },
        ],
      },
    },
    {
      id: 'b4',
      type: 'education',
      label: 'Education',
      enabled: true,
      data: {
        items: [
          {
            school: 'University of Texas at Arlington',
            degree: 'B.S. Computer Science',
            dates: 'Expected May 2027',
            detail:
              'Relevant coursework: Software Engineering, Databases, Computer Networks.',
          },
        ],
      },
    },
    {
      id: 'b5',
      type: 'projects',
      label: 'Projects',
      enabled: false,
      data: {
        items: [
          {
            name: 'Draftly',
            detail:
              'Block-based resume editor with drag-and-drop sections and application tracking. React, TypeScript, Supabase.',
          },
        ],
      },
    },
  ],
}

/** The demo user's one live resume. Tailored copies live as versions. */
export const seedResumes: Resume[] = [seedResume]

/**
 * Frozen demo versions, as if the user had saved one per tailoring pass.
 * Each is a full copy taken from the live resume `r1`.
 */
export const seedVersions: ResumeVersion[] = [
  { id: 'v1', resumeId: 'r1', label: 'General SWE — v2', createdAt: '2026-07-15T12:00:00.000Z', resume: { ...seedResume, title: 'General SWE — v2' } },
  { id: 'v2', resumeId: 'r1', label: 'Backend-focused', createdAt: '2026-08-10T12:00:00.000Z', resume: { ...seedResume, title: 'Backend-focused' } },
  { id: 'v3', resumeId: 'r1', label: 'Frontend-focused', createdAt: '2026-08-01T12:00:00.000Z', resume: { ...seedResume, title: 'Frontend-focused' } },
]

export const seedApplications: Application[] = [
  { id: 'a1', employer: 'Stripe', role: 'Backend Intern', status: 'Interview', versionId: 'v2', appliedAt: '2026-08-14' },
  { id: 'a2', employer: 'Figma', role: 'Frontend Intern', status: 'Applied', versionId: 'v3', appliedAt: '2026-08-20' },
  { id: 'a3', employer: 'Vercel', role: 'SWE Intern', status: 'Accepted', versionId: 'v1', appliedAt: '2026-07-30' },
  { id: 'a4', employer: 'Datadog', role: 'Software Engineer', status: 'Rejected', versionId: 'v1', appliedAt: '2026-07-18' },
  { id: 'a5', employer: 'Supabase', role: 'Developer Advocate', status: 'Waitlist', versionId: 'v3', appliedAt: '2026-08-02' },
  { id: 'a6', employer: 'Local Startup', role: 'Full-stack (contract)', status: 'Custom', customStatus: 'Take-home sent', versionId: 'v2', appliedAt: '2026-08-22' },
]

/**
 * The resume a brand-new signed-in user starts with: their own blank
 * profile and one placeholder block per built-in section — never the demo
 * person's content. The id is a placeholder; the database assigns the real one.
 */
export function starterResume(): Omit<Resume, 'id'> {
  return {
    title: 'My resume',
    templateId: DEFAULT_TEMPLATE,
    profile: { name: 'Your Name', title: '', email: '', phone: '', location: '', links: '' },
    blocks: BUILT_IN_SECTION_TYPES.map((type, i) => {
      const block = blankBlock(type, `b${i + 1}`)
      // Projects start hidden so a fresh resume previews as a sensible page.
      return type === 'projects' ? { ...block, enabled: false } : block
    }),
  }
}

/**
 * Starter content used when adding a fresh section from the chip row.
 * `title` names a custom section; built-ins ignore it and use their label.
 */
export function blankBlock(
  type: SectionType,
  id: string,
  title?: string,
): ResumeBlock {
  const label = SECTION_LABELS[type]
  switch (type) {
    case 'custom':
      return {
        id,
        type,
        label: title?.trim() || 'New section',
        enabled: true,
        data: { items: [{ name: '', meta: '', detail: '' }] },
      }
    case 'summary':
      return { id, type, label, enabled: true, data: { text: 'A short intro paragraph about who you are and what you build.' } }
    case 'experience':
      return { id, type, label, enabled: true, data: { items: [{ role: 'Role', org: 'Company', dates: 'Year', points: ['Achievement with a number.'] }] } }
    case 'skills':
      return { id, type, label, enabled: true, data: { groups: [{ name: 'Category', items: 'Skill, skill, skill' }] } }
    case 'education':
      return { id, type, label, enabled: true, data: { items: [{ school: 'School', degree: 'Degree', dates: 'Year', detail: '' }] } }
    case 'projects':
      return { id, type, label, enabled: true, data: { items: [{ name: 'Project', detail: 'What it does and the stack.' }] } }
  }
}
