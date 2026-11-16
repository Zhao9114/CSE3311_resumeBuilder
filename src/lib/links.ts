/**
 * Turns the free-text contact and link fields into clickable links for the
 * resume. Chrome keeps <a href> as real links when the page is saved as a
 * PDF, so a recruiter can click straight through to GitHub or a portfolio.
 */

export interface ContactPart {
  text: string
  /** Where the part links to, or null for plain text (a phone, a city). */
  href: string | null
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i
const URL_WITH_SCHEME = /^https?:\/\/\S+$/i
// A bare domain with an optional path: github.com/jachen, jordan.dev
const BARE_DOMAIN = /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?$/i
const NOT_A_TLD = /\.(js|ts|jsx|tsx|py|md|txt|sh|rs|cpp|java|json|css|html)$/i

/** The href for one piece of text, or null when it is not a link. */
export function toHref(raw: string): string | null {
  const text = raw.trim()
  if (!text) return null
  if (EMAIL.test(text)) return `mailto:${text}`
  if (URL_WITH_SCHEME.test(text)) return text
  // "Node.js" has the shape of a domain; file-extension endings are not TLDs here.
  if (BARE_DOMAIN.test(text) && !NOT_A_TLD.test(text.split('/')[0])) return `https://${text}`
  return null
}

/**
 * Splits the Links field ("github.com/me · linkedin.com/in/me, me.dev") into
 * its parts. Separators people use: the middle dot, commas, pipes,
 * semicolons, and runs of spaces.
 */
export function splitLinks(links: string): string[] {
  return links
    .split(/\s*[·,|;]\s*|\s{2,}|\s+(?=https?:\/\/)/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Email, phone, location, then each link, ready to render. */
export function contactParts(profile: { email: string; phone: string; location: string; links: string }): ContactPart[] {
  const parts = [profile.email, profile.phone, profile.location].map((s) => s.trim()).filter(Boolean)
  return [...parts, ...splitLinks(profile.links)].map((text) => ({ text, href: toHref(text) }))
}

/** What to show for a link: the address without the scheme, which reads better on paper. */
export function displayUrl(url: string): string {
  return url.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '')
}
