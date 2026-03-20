import { toHTML, escapeHTML, mergeComponents } from '@portabletext/to-html'
import type { PortableTextHtmlComponents } from '@portabletext/to-html'
import { stegaClean } from '@sanity/client/stega' // only for href attributes, never for text content
import type { Locale } from '../types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Strip leading/trailing <br> tags and whitespace from a block's rendered children. */
function blockContent(children: string | undefined): string {
  return (children ?? '').replace(/^(\s*<br\s*\/?>\s*)+|(\s*<br\s*\/?>\s*)+$/gi, '').trim()
}

// ─── Core components ──────────────────────────────────────────────────────────

const coreComponents = (urlMap: Record<string, string>): Partial<PortableTextHtmlComponents> => ({
  block: {
    // Strip leading/trailing <br> and filter empty blocks entirely
    normal:     ({ children }) => blockContent(children) ? `<p>${blockContent(children)}</p>` : '',
    h1:         ({ children }) => blockContent(children) ? `<h1>${blockContent(children)}</h1>` : '',
    h2:         ({ children }) => blockContent(children) ? `<h2>${blockContent(children)}</h2>` : '',
    h3:         ({ children }) => blockContent(children) ? `<h3>${blockContent(children)}</h3>` : '',
    h4:         ({ children }) => blockContent(children) ? `<h4>${blockContent(children)}</h4>` : '',
    blockquote: ({ children }) => blockContent(children) ? `<blockquote>${blockContent(children)}</blockquote>` : '',
  },
  hardBreak: () => '<br>',
  marks: {
    internalLink: ({ children, value }) => {
      const id  = value?.reference?._id ?? ''
      const url = urlMap[id] ?? `/${value?.reference?.slug ?? ''}`
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

/**
 * Render portable text blocks to HTML.
 * Called by the `portableText` Nunjucks filter — urlMap is passed at template time.
 */
export function renderPortableText(
  blocks: any[],
  urlMap: Record<string, string> = {},
  extra?: Partial<PortableTextHtmlComponents>,
): string {
  if (!blocks?.length) return ''
  const components = extra
    ? mergeComponents(coreComponents(urlMap) as PortableTextHtmlComponents, extra)
    : coreComponents(urlMap)
  return toHTML(blocks, { components })
}
