export interface ImageSpot {
  index: number
  kind: 'img' | 'background'
  key: string
  label: string
  src: string
}

export interface ImageSpotUpdate {
  index: number
  key: string
  label: string
  url: string
}

const SKIP_HINT = /logo|icon|favicon|sprite|pixel|badge|emoji/i

interface Region {
  start: number
  end: number
}

function decodeAttr(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, '\'')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function readAttr(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\`]+))`, 'i'))
  return decodeAttr(match?.[1] ?? match?.[2] ?? match?.[3] ?? '')
}

function hiddenRanges(html: string): Region[] {
  const ranges: Region[] = []
  const blocks = /<(script|style|svg)\b[^>]*>[\s\S]*?<\/\1>/gi
  for (const match of html.matchAll(blocks)) {
    ranges.push({ start: match.index ?? 0, end: (match.index ?? 0) + match[0].length })
  }
  const comments = /<!--[\s\S]*?-->/g
  for (const match of html.matchAll(comments)) {
    ranges.push({ start: match.index ?? 0, end: (match.index ?? 0) + match[0].length })
  }
  return ranges
}

function inside(index: number, ranges: Region[]): boolean {
  return ranges.some(range => index >= range.start && index < range.end)
}

function backgroundUrl(style: string): string {
  const match = style.match(/background(?:-image)?\s*:[^;]*url\(\s*(['"]?)(https?:\/\/[^)'"]+)\1\s*\)/i)
  return match?.[2] || ''
}

function skipImage(tag: string, src: string): boolean {
  const hint = `${src} ${readAttr(tag, 'alt')} ${readAttr(tag, 'class')} ${readAttr(tag, 'id')}`
  if (SKIP_HINT.test(hint)) return true
  if (/\.svg(?:$|\?)/i.test(src) || src.startsWith('data:')) return true
  const width = Number(readAttr(tag, 'width'))
  const height = Number(readAttr(tag, 'height'))
  return width > 0 && width < 48 && height > 0 && height < 48
}

function slugSlot(label: string): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  return slug || 'photo'
}

function slotTitle(key: string): string {
  return key.split(/[-_\s]+/).filter(Boolean).map((part) => {
    if (/^\d+$/.test(part)) return part
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
  }).join(' ')
}

function spotKey(index: number): string {
  return index === 0 ? 'hero' : `section-${index + 1}`
}

function spotLabel(index: number): string {
  return index === 0 ? 'Hero' : `Section ${index + 1}`
}

interface Classified {
  kind: 'img' | 'background'
  src: string
}

function classifyTag(tag: string, tagName: string): Classified | null {
  const name = tagName.toLowerCase()
  if (name === 'img') {
    const src = readAttr(tag, 'src')
    if (skipImage(tag, src)) return null
    return { kind: 'img', src: /^https?:\/\//i.test(src) ? src : '' }
  }
  const bg = backgroundUrl(readAttr(tag, 'style'))
  if (!bg) return null
  return { kind: 'background', src: bg }
}

interface FoundTag {
  index: number
  start: number
  end: number
  tag: string
  classified: Classified
}

function findSpots(html: string): FoundTag[] {
  const ranges = hiddenRanges(html)
  const found: FoundTag[] = []
  const tags = /<([a-zA-Z][\w:-]*)\b[^>]*>/g
  for (const match of html.matchAll(tags)) {
    const start = match.index ?? 0
    if (inside(start, ranges)) continue
    const tag = match[0]
    const classified = classifyTag(tag, match[1] || '')
    if (!classified) continue
    found.push({
      index: found.length,
      start,
      end: start + tag.length,
      tag,
      classified
    })
    if (found.length >= 24) break
  }
  return found
}

/** Images already on the page, in document order. The first is the hero. */
export function detectImageSpots(html: string): ImageSpot[] {
  return findSpots(html).map(spot => ({
    index: spot.index,
    kind: spot.classified.kind,
    key: spotKey(spot.index),
    label: spotLabel(spot.index),
    src: spot.classified.src
  }))
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function setAttr(tag: string, name: string, value: string): string {
  const escaped = escapeAttr(value)
  const re = new RegExp(`\\s${name}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s"'=<>\`]+)`, 'i')
  if (re.test(tag)) return tag.replace(re, ` ${name}="${escaped}"`)
  return tag.replace(/>$/, ` ${name}="${escaped}">`)
}

function rewriteSpot(tag: string, kind: 'img' | 'background', update: { key: string, label: string, url: string }): string {
  let next = tag
  if (kind === 'img') {
    next = setAttr(next, 'src', update.url)
  } else {
    const style = readAttr(tag, 'style')
    const replaced = style.replace(
      /url\(\s*(['"]?)https?:\/\/[^)'"]+\1\s*\)/i,
      `url("${update.url.replace(/"/g, '')}")`
    )
    next = setAttr(next, 'style', replaced)
  }
  next = setAttr(next, 'data-photo-slot', update.key)
  if (!readAttr(tag, 'data-photo-query')) {
    next = setAttr(next, 'data-photo-query', update.label || slotTitle(update.key))
  }
  return next
}

/**
 * Swap src or background-image on the chosen spots and mark data-photo-slot.
 * Copy, layout, and every other tag stay as they were.
 */
export function applyImageSpotPhotos(html: string, updates: ImageSpotUpdate[]): { html: string, applied: number } {
  const wanted = new Map<number, { key: string, label: string, url: string }>()
  for (const update of updates) {
    const url = update.url.trim()
    if (!/^https?:\/\//i.test(url)) continue
    const label = update.label.replace(/\s+/g, ' ').trim()
    const key = slugSlot(update.key || label)
    if (!key || !label) continue
    wanted.set(update.index, { key, label, url })
  }
  if (!wanted.size) return { html, applied: 0 }

  const spots = findSpots(html)
  let applied = 0
  let cursor = 0
  let next = ''
  for (const spot of spots) {
    next += html.slice(cursor, spot.start)
    const update = wanted.get(spot.index)
    if (!update) {
      next += spot.tag
    } else {
      next += rewriteSpot(spot.tag, spot.classified.kind, update)
      applied += 1
    }
    cursor = spot.end
  }
  next += html.slice(cursor)
  return { html: next, applied }
}
