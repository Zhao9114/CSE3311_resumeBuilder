import { describe, expect, it } from 'vitest'
import { contactParts, displayUrl, splitLinks, toHref } from './links'

describe('toHref', () => {
  it.each([
    ['github.com/jachen', 'https://github.com/jachen'],
    ['https://jordan.dev', 'https://jordan.dev'],
    ['www.linkedin.com/in/jachen', 'https://www.linkedin.com/in/jachen'],
    ['jordan.chen@email.com', 'mailto:jordan.chen@email.com'],
  ])('links %s', (text, href) => {
    expect(toHref(text)).toBe(href)
  })

  it.each(['(214) 555-0182', 'Arlington, TX', 'Node.js', ''])('leaves %s as text', (text) => {
    expect(toHref(text)).toBeNull()
  })
})

describe('splitLinks', () => {
  it('splits on the separators people type', () => {
    expect(splitLinks('github.com/jachen · linkedin.com/in/jachen, jordan.dev | x.com/j')).toEqual([
      'github.com/jachen', 'linkedin.com/in/jachen', 'jordan.dev', 'x.com/j',
    ])
    expect(splitLinks('https://a.dev https://b.dev')).toEqual(['https://a.dev', 'https://b.dev'])
    expect(splitLinks('')).toEqual([])
  })
})

describe('contactParts', () => {
  it('links the email and each link, and leaves phone and city as text', () => {
    const parts = contactParts({
      email: 'j@x.com', phone: '555-0182', location: 'Arlington, TX', links: 'github.com/j · j.dev',
    })
    expect(parts.map((p) => p.href)).toEqual(['mailto:j@x.com', null, null, 'https://github.com/j', 'https://j.dev'])
  })
})

it('shows links without the scheme', () => {
  expect(displayUrl('https://github.com/j/draftly/')).toBe('github.com/j/draftly')
})
