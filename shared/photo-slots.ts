export interface PhotoSlot {
  index: number
  query: string
  role: 'hero' | 'section'
  open: boolean
  src: string | null
}

const VOID_TAGS = new Set(['img', 'image', 'source', 'br', 'hr', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'wbr'])

function decodeAttr(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, '\'')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCharCode(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_, digits: string) => String.fromCharCode(parseInt(digits, 16)))
    .replace(/\s+/g, ' ')
    .trim()
}

function readableHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
}

function readSrc(tag: string): string {
  const match = tag.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i)
  return decodeAttr(match?.[1] ?? match?.[2] ?? match?.[3] ?? '')
}

function httpUrl(value: string): string | null {
  if (!/^https?:\/\//i.test(value)) return null
  return value
}

function innerHttpSrc(html: string, from: number, tagName: string): string | null {
  const close = new RegExp(`</${tagName}\\s*>`, 'i')
  const rest = html.slice(from)
  const end = rest.search(close)
  const slice = end === -1 ? rest.slice(0, 4000) : rest.slice(0, end)
  const img = /<img\b[^>]*>/gi
  for (const match of slice.matchAll(img)) {
    const src = httpUrl(readSrc(match[0]))
    if (src) return src
  }
  return null
}

/**
 * Photo slots in the same order as querySelectorAll('[data-photo-query]').
 * The first slot is the hero. A slot is open when it has no real http(s) src.
 */
export function extractPhotoSlots(html: string): PhotoSlot[] {
  const source = readableHtml(html)
  const slots: PhotoSlot[] = []
  const tags = /<([a-zA-Z][\w:-]*)\b[^>]*>/g
  for (const match of source.matchAll(tags)) {
    const tag = match[0]
    if (!/\sdata-photo-query\s*=/i.test(tag)) continue
    const queryMatch = tag.match(/\sdata-photo-query\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i)
    const query = decodeAttr(queryMatch?.[1] ?? queryMatch?.[2] ?? queryMatch?.[3] ?? '')
    if (!query) continue
    const tagName = (match[1] || '').toLowerCase()
    const ownSrc = httpUrl(readSrc(tag))
    const nestedSrc = ownSrc || VOID_TAGS.has(tagName)
      ? null
      : innerHttpSrc(source, (match.index ?? 0) + tag.length, tagName)
    const src = ownSrc || nestedSrc
    slots.push({
      index: slots.length,
      query,
      role: slots.length === 0 ? 'hero' : 'section',
      open: !src,
      src
    })
    if (slots.length >= 24) break
  }
  return slots
}

/** Unique phrases, hero first, for search chips that do not need a slot index. */
export function extractPhotoQueries(html: string): string[] {
  const queries: string[] = []
  for (const slot of extractPhotoSlots(html)) {
    if (queries.includes(slot.query)) continue
    queries.push(slot.query)
    if (queries.length >= 12) break
  }
  return queries
}

/** Keep slot indexes. Empty entries are unassigned slots, not dropped photos. */
export function slotOrderedPhotoUrls(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input.slice(0, 24).map((item) => {
    if (typeof item !== 'string') return ''
    const url = item.trim()
    if (!url) return ''
    if (!/^https?:\/\//i.test(url)) return ''
    return url
  })
}

export function slotLabel(slot: Pick<PhotoSlot, 'role' | 'query' | 'index'>): string {
  if (slot.role === 'hero') return `Hero · ${slot.query}`
  return `Slot ${slot.index + 1} · ${slot.query}`
}

function hasHttpUrl(value: string | undefined): boolean {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim())
}

/** Slot the next photo should use. An explicit aim wins; otherwise the first empty slot, then the hero. */
export function preferredSlotIndex(
  slots: readonly { index: number }[],
  assignments: Readonly<Record<number, string | undefined>>,
  activeIndex: number | null
): number | null {
  if (!slots.length) return null
  if (activeIndex != null && slots.some(slot => slot.index === activeIndex)) return activeIndex
  const open = slots.find(slot => !hasHttpUrl(assignments[slot.index]))
  return open?.index ?? slots[0].index
}

/** After a photo lands, aim at the next empty slot in order, wrapping past the hero. */
export function slotAfterAssign(
  slots: readonly { index: number }[],
  assignments: Readonly<Record<number, string | undefined>>,
  assignedIndex: number
): number {
  if (!slots.length) return assignedIndex
  const start = slots.findIndex(slot => slot.index === assignedIndex)
  const ordered = start === -1
    ? [...slots]
    : [...slots.slice(start + 1), ...slots.slice(0, start)]
  const next = ordered.find(slot => !hasHttpUrl(assignments[slot.index]))
  return next?.index ?? assignedIndex
}
