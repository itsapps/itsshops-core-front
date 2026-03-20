import { toHTML, escapeHTML, mergeComponents } from '@portabletext/to-html'
import type { PortableTextHtmlComponents } from '@portabletext/to-html'
import { stegaClean } from '@sanity/client/stega'
import type { Locale } from '../types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Strip stega markers, leading/trailing <br> tags and whitespace from a block's rendered children. */
function blockContent(children: string | undefined): string {
  return stegaClean(children ?? '').replace(/^(\s*<br\s*\/?>\s*)+|(\s*<br\s*\/?>\s*)+$/gi, '').trim()
}

function renderBlock(tag: string, children: string, cls?: string): string {
  const content = blockContent(children)
  const attrs = cls ? ` class="${cls}"` : ''
  return `<${tag}${attrs}>${content}</${tag}>`
}

/** Returns true if a portable text block has no visible text content. */
function isEmptyBlock(block: any): boolean {
  if (block._type !== 'block') return false
  return (block.children ?? []).every((child: any) => !stegaClean(child.text ?? '').trim())
}

// ─── Core components ──────────────────────────────────────────────────────────

const coreComponents = (urlMap: Record<string, string>): Partial<PortableTextHtmlComponents> => ({
  block: {
    normal:     ({ children }) => renderBlock('p',          children ?? ''),
    h1:         ({ children }) => renderBlock('h1',         children ?? ''),
    h2:         ({ children }) => renderBlock('h2',         children ?? ''),
    h3:         ({ children }) => renderBlock('h3',         children ?? ''),
    h4:         ({ children }) => renderBlock('h4',         children ?? ''),
    blockquote: ({ children }) => renderBlock('blockquote', children ?? ''),
  },
  hardBreak: () => '<br>',
  marks: {
    internalLink: ({ children, value }) => {
      const id  = value?.reference?._id ?? ''
      const url = urlMap[id] ?? `/${stegaClean(value?.reference?.slug ?? '')}`
      return `<a href="${escapeHTML(url)}">${children}</a>`
    },
    link: ({ children, value }) => {
      const href = escapeHTML(stegaClean(value?.href ?? value?.url ?? '#'))
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${children}</a>`
    },
    externalLink: ({ children, value }) => {
      const href = escapeHTML(stegaClean(value?.href ?? value?.url ?? '#'))
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${children}</a>`
    },
  },
})

// ─── i18n resolution ─────────────────────────────────────────────────────────

/**
 * Resolve InternationalizedArray or plain block array to blocks for the given locale.
 * Returns raw blocks — render to HTML via the `portableText` Nunjucks filter.
 */
export function resolvePortableText(
  raw: any,
  locale: Locale,
  defaultLocale: Locale,
): any[] {
  if (!raw) return []

  if (Array.isArray(raw) && raw[0]?._key && 'value' in (raw[0] ?? {})) {
    const entry =
      raw.find((e: any) => e._key === locale) ??
      raw.find((e: any) => e._key === defaultLocale) ??
      raw[0]
    return entry?.value ?? []
  }

  return raw
}

// ─── HTML rendering ───────────────────────────────────────────────────────────

export type PortableTextOptions = {
  /**
   * Render empty blocks as empty tags instead of filtering them out.
   * Useful for editorial long-form content where editors use empty lines for spacing.
   * Defaults to false.
   */
  allowEmptyBlocks?: boolean
}

/**
 * Render portable text blocks to HTML.
 * Called by the `portableText` Nunjucks filter — urlMap is passed at template time.
 */
export function renderPortableText(
  blocks: any[],
  urlMap: Record<string, string> = {},
  extra?: Partial<PortableTextHtmlComponents>,
  options: PortableTextOptions = {},
): string {
  if (!blocks?.length) return ''
  const { allowEmptyBlocks = false } = options
  // Clean only structural routing fields — style/listItem drive component dispatch.
  // Text span content is left encoded so stega visual editing overlays still work.
  const normalizedBlocks = blocks
    .filter(block => allowEmptyBlocks || !isEmptyBlock(block))
    .map((block: any) => ({
      ...block,
      style:    block.style    ? stegaClean(block.style)    : block.style,
      listItem: block.listItem ? stegaClean(block.listItem) : block.listItem,
    }))
  const components = extra
    ? mergeComponents(coreComponents(urlMap) as PortableTextHtmlComponents, extra)
    : coreComponents(urlMap)
  return toHTML(normalizedBlocks, { components })
}
