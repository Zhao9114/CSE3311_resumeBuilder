/** The five resume looks a user can switch between. */
export type TemplateId =
  | 'classic'
  | 'modern'
  | 'compact'
  | 'elegant'
  | 'sidebar'

export interface TemplateMeta {
  id: TemplateId
  name: string
  /** One line describing who the template suits. */
  description: string
  /**
   * Two-column templates render contact and short sections in a sidebar,
   * which changes both the markup and the print rules.
   */
  twoColumn: boolean
}

export const TEMPLATES: TemplateMeta[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Centered serif header with ruled section titles.',
    twoColumn: false,
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Left-aligned sans with accent section titles.',
    twoColumn: false,
  },
  {
    id: 'compact',
    name: 'Compact',
    description: 'Tight spacing to fit more on a single page.',
    twoColumn: false,
  },
  {
    id: 'elegant',
    name: 'Elegant',
    description: 'Serif small caps with generous margins.',
    twoColumn: false,
  },
  {
    id: 'sidebar',
    name: 'Sidebar',
    description: 'Two columns, with skills and contact in a sidebar.',
    twoColumn: true,
  },
]

export const DEFAULT_TEMPLATE: TemplateId = 'classic'

export function templateMeta(id: TemplateId): TemplateMeta {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]
}

/** Section types the Sidebar template moves into its left column. */
export const SIDEBAR_SECTION_TYPES = ['skills', 'education'] as const
