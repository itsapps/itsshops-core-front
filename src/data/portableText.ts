import type { Locale } from '../types'

type Block = {
  _type: string
  _key: string
  style?: string
  children?: Span[]
  markDefs?: MarkDef[]
}

type Span = {
  _type: 'span'
  text: string
  marks?: string[]
}

type MarkDef = {
  _key: string
  _type: string
  href?: string
  url?: string
  reference?: { _id: string; slug?: string }
}

const STYLE_TAG: Record<string, string> = {
  normal: 'p', blockquote: 'blockquote',
  h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h5', h6: 'h6',
}

const DECORATOR: Record<string, [string, string]> = {
  strong: ['<strong>', '</strong>'],
  em: ['<em>', '</em>'],
  underline: ['<u>', '</u>'],
  'strike-through': ['<s>', '</s>'],
  code: ['<code>', '</code>'],
}

function renderSpan(span: Span, markDefs: MarkDef[]): string {
  let text = span.text ?? ''
  for (const mark of (span.marks ?? [])) {
    const def = markDefs.find(d => d._key === mark)
    if (def) {
      if (def._type === 'link' || def._type === 'externalLink') {
        const href = def.href ?? def.url ?? '#'
        text = `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`
      } else if (def._type === 'internalLink') {
        // slug available but not locale-prefixed — customer can post-process
        const slug = def.reference?.slug ?? ''
        text = `<a href="/${slug}" data-ref="${def.reference?._id ?? ''}">${text}</a>`
      }
    } else if (DECORATOR[mark]) {
      const [open, close] = DECORATOR[mark]
      text = `${open}${text}${close}`
    }
  }
  return text
}

function renderBlock(block: Block): string {
  if (!block.children) return ''   // skip custom embeds (images, custom types without children)
  const tag = STYLE_TAG[block.style ?? 'normal'] ?? 'p'
  const inner = (block.children ?? []).map(s => renderSpan(s, block.markDefs ?? [])).join('')
  return `<${tag}>${inner}</${tag}>`
}

/**
 * Resolve Sanity portable text to an HTML string.
 * Accepts both plain block arrays and InternationalizedArray format ({ _key, value: blocks[] }).
 */
export function resolvePortableText(
  raw: any,
  locale: Locale,
  defaultLocale: Locale
): string {
  if (!raw) return ''

  // InternationalizedArray format: [{ _key: 'de', value: [...blocks] }]
  let blocks: Block[]
  if (Array.isArray(raw) && raw[0]?._key && 'value' in (raw[0] ?? {})) {
    const entry =
      raw.find((e: any) => e._key === locale) ??
      raw.find((e: any) => e._key === defaultLocale) ??
      raw[0]
    blocks = entry?.value ?? []
  } else {
    blocks = raw
  }

  return blocks.map(renderBlock).filter(Boolean).join('\n')
}
