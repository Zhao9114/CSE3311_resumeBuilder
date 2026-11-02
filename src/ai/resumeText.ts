import type { Resume, ResumeBlock } from '../types'

/**
 * Plain-text rendering of a resume: what the model reads, and what the ATS
 * keyword matcher searches. Hidden sections are left out — they are not on
 * the page an employer would see.
 *
 * Shared by the browser and the serverless functions; type imports only.
 */
export function blockToText(block: ResumeBlock): string {
  const lines: string[] = [`## ${block.label}`]
  switch (block.type) {
    case 'summary':
      lines.push(block.data.text)
      break
    case 'experience':
      for (const item of block.data.items) {
        lines.push([item.role, item.org, item.dates].filter(Boolean).join(' | '))
        for (const point of item.points) lines.push(`- ${point}`)
      }
      break
    case 'skills':
      for (const group of block.data.groups) lines.push(`${group.name}: ${group.items}`)
      break
    case 'education':
      for (const item of block.data.items) {
        lines.push([item.school, item.degree, item.dates].filter(Boolean).join(' | '))
        if (item.detail) lines.push(item.detail)
      }
      break
    case 'projects':
      for (const item of block.data.items) lines.push(`${item.name}: ${item.detail}`)
      break
    case 'custom':
      for (const item of block.data.items) {
        lines.push([item.name, item.meta].filter(Boolean).join(' | '))
        if (item.detail) lines.push(item.detail)
      }
      break
  }
  return lines.join('\n')
}

export function resumeToText(resume: Resume): string {
  const { profile } = resume
  const head = [profile.name, profile.title].filter(Boolean).join(' — ')
  const sections = resume.blocks.filter((b) => b.enabled).map(blockToText)
  return [head, ...sections].filter(Boolean).join('\n\n')
}
