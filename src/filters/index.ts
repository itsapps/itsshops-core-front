import { slugify } from "../data/slugify"
import { escapeHTML } from "@portabletext/to-html"
import { stegaClean } from "@sanity/client/stega"
import type { Locale, CoreContext, TranslatorParams } from "../types";
import { resolveString } from "../data/localizers";
import { imageUrl, imageSizeUrl, image } from "../image"
import { renderPortableText } from "../data/portableText"
import type { PortableTextOptions } from "../data/portableText"
import { buildPageDocSchema, buildWebSiteSchema } from "../schema"

function toIsoString(text: string) {
  return new Date(text).toISOString()
}

function map(arr: any, key: string) {
  if (!Array.isArray(arr)) return []
  return arr.map(item => item?.[key])
}

function hasDepth(url: string): boolean {
  return url.replace(/^\/|\/$/g, '').split('/').length > 1
}

function linkActiveState(itemUrl: string, pageUrl: string): string {
  if (itemUrl === pageUrl) return 'aria-current="page"'
  if (hasDepth(itemUrl) && pageUrl.startsWith(itemUrl)) return 'data-state="active"'
  return ''
}
/**
 * Format a price in cents to a locale-aware currency string.
 * Usage: {{ product.price | formatPrice('de', 'EUR') }}
 */
function formatPrice(cents: number, locale = 'de', currency = 'EUR', currencyLabel?: string): string {
  if (currencyLabel) {
    const number = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)
    return `${number} ${currencyLabel}`
  }
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100)
}

/**
 * Format a volume stored in ml to a locale-aware display string using the configured unit.
 * Usage: {{ wine.volume | formatVolume }}
 */
export function formatVolumeMl(ml: number, unit: string, locale = 'de'): string {
  let value: number
  switch (unit) {
    case 'l':  value = ml / 1000; break
    case 'cl': value = ml / 10;   break
    default:   value = ml
  }
  return `${new Intl.NumberFormat(locale).format(value)}${unit}`
}

export function formatNumber(num: number, locale = 'de'): string {
  return `${new Intl.NumberFormat(locale).format(num || 0)}`
}

/**
 * Resolve an InternationalizedArray to a plain string in templates.
 * Usage: {{ module.heading | localize(product.locale, defaultLocale) }}
 */
function localize(arr: any, locale: string, fallback?: string): string {
  return resolveString(arr, locale as Locale, (fallback ?? locale) as Locale)
}

/**
 * Filter products (from cms[locale].products) by a category id.
 * Usage: {% set categoryProducts = cms[category.locale].products | filterByCategory(category._id) %}
 */
function filterByCategory(products: any[], categoryId: string): any[] {
  return (products ?? []).filter(p =>
    (p.categories ?? []).some((c: any) => c._id === categoryId)
  )
}

/**
 * Trim filterGroups to only values present in the given products.
 * Removes values not represented by any product, and removes empty groups.
 * Usage: {% set contextFilterGroups = filterGroups | filterGroupsForProducts(categoryProducts) %}
 */
function filterGroupsForProducts(filterGroups: any[], products: any[]): any[] {
  // Collect all values present across the given products per key
  const present = new Map<string, Set<string>>()
  for (const p of (products ?? [])) {
    const attrs: Record<string, string[]> = p.filterAttributes ?? {}
    for (const [key, values] of Object.entries(attrs)) {
      if (!present.has(key)) present.set(key, new Set())
      for (const v of values) present.get(key)!.add(v)
    }
  }

  return (filterGroups ?? [])
    .map((group: any) => {
      const presentValues = present.get(group.key)
      if (!presentValues?.size) return null
      const values = group.values.filter((v: any) => presentValues.has(v.value))
      if (!values.length) return null
      return { ...group, values }
    })
    .filter(Boolean)
}

/**
 * Resolve product refs to full product objects from cms data.
 * Accepts either [{_id, ...}] objects or plain string IDs.
 * Usage: {% set resolved = module.products | resolveProductRefs(cms[_locale].products) %}
 *        {% set linked   = cms[locale].products | resolveProductRefs(page.linkedProductIds) %}
 */
function resolveProductRefs(refs: any[], allProducts: any[]): any[] {
  const map = new Map((allProducts ?? []).map((p: any) => [p._id, p]))
  return (refs ?? []).map(r => map.get(typeof r === 'string' ? r : r._id)).filter(Boolean) as any[]
}

function findById(arr: any[], id: string): any {
  return (arr ?? []).find((item: any) => item._id === id) ?? null
}

function findByProductId(arr: any[], id: string): any {
  return (arr ?? []).find((item: any) => item.product?._id === id) ?? null
}

function formatDate(
  date: string,
  locale: string,
  style: Intl.DateTimeFormatOptions['dateStyle'] = 'medium',
): string {
  if (!date) return ''
  return new Intl.DateTimeFormat(locale, { dateStyle: style }).format(new Date(date))
}

/**
 * Format a date or date range in a locale-aware way.
 * With combine: true (default), a same-month range is collapsed: "15.–17. März 2026" / "March 15–17, 2026"
 * With combine: false, from and to are formatted fully: "15. März 2026 – 17. März 2026"
 * Usage: {{ event.from | formatDateRange(event.to) }}
 *        {{ event.from | formatDateRange(event.to, { combine: false }) }}
 */
function formatDateRange(
  from: string,
  locale: string,
  to?: string,
  { combine = true }: { combine?: boolean } = {},
): string {
  if (!from) return ''
  const fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  const f = new Date(from + 'T00:00:00')
  if (!to || to === from) return fmt.format(f)
  const t = new Date(to + 'T00:00:00')
  if (combine) return fmt.formatRange(f, t)
  return `${fmt.format(f)} – ${fmt.format(t)}`
}

/** Take the first n items from an array. Usage: {% for x in arr | limit(5) %} */
function limit(arr: any[], n: number): any[] {
  return (arr ?? []).slice(0, n)
}

/** Truncate a string to n characters with an ellipsis.
 * Usage: {{ text | truncate(120) }} */
function truncate(text: string, n: number): string {
  if (!text || text.length <= n) return text ?? ''
  return text.slice(0, n).trimEnd() + '…'
}

/** International postal prefixes (ISO 3166-1 alpha-2 → prefix) */
const POSTAL_PREFIXES: Record<string, string> = {
  AT: 'A',  DE: 'D',  CH: 'CH', LI: 'FL', FR: 'F',
  IT: 'I',  HU: 'H',  SK: 'SK', CZ: 'CZ', SI: 'SLO',
  PL: 'PL', NL: 'NL', BE: 'B',  LU: 'L',  DK: 'DK',
  SE: 'S',  NO: 'N',  FI: 'FIN',
}

/** Prepend international postal prefix to a zip code when the country has one.
 * Usage: {{ address.zip | postalCode(address.country) }} → "A-7000" */
function postalCode(zip: string, country?: string): string {
  if (!zip) return ''
  const prefix = country ? POSTAL_PREFIXES[country.toUpperCase()] : undefined
  return prefix ? `${prefix}-${zip}` : zip
}

/** Format an ISO 3166-1 alpha-2 country code to a localized country name.
 * Usage: {{ address.country | countryName }} → "Österreich" / "Austria" */
function countryName(code: string, locale: string): string {
  if (!code) return ''
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

/** Convert newlines to <br> — pipe result through | safe in templates */
function nl2br(text: string): string {
  if (!text) return ''
  return text.replace(/\r?\n/g, '<br>')
}

export const createFilters = (ctx: CoreContext) => {
  const { eleventyConfig, config, translate } = ctx

  eleventyConfig.addFilter('log', (value: any, label?: string) => {
    if (label) console.warn(`⚠️ [itsshops] ${label}`, value)
    else console.warn('⚠️ [itsshops]', value)
    return value
  })
  
  // translation
  eleventyConfig.addFilter('trans', function (key: string, params: TranslatorParams = {}) {
    return translate(key, params, this.page?.lang || config.defaultLocale)
  })

  eleventyConfig.addFilter("json", JSON.stringify);
  eleventyConfig.addFilter("slugify", slugify);
  eleventyConfig.addFilter("toIsoString", toIsoString);
  // eleventyConfig.addFilter("formatPrice", formatPrice);
  eleventyConfig.addFilter("formatPrice", function (price: number, locale: string | undefined) {
    return formatPrice(price, locale || this.page?.lang || config.defaultLocale, config.units.price.currency, config.units.price.currencyLabel);
  });
  eleventyConfig.addFilter("formatVolume", function (ml: number) {
    return formatVolumeMl(ml, config.units.volume, this.page?.lang || config.defaultLocale)
  });
  eleventyConfig.addFilter("localize", localize);
  eleventyConfig.addFilter("filterByCategory", filterByCategory as any);
  eleventyConfig.addFilter("filterGroupsForProducts", filterGroupsForProducts as any);
  eleventyConfig.addFilter("hasModule", (modules: any[], type: string) =>
    (modules ?? []).some((m: any) => m._type === type) as any
  );
  eleventyConfig.addFilter("resolveProductRefs", resolveProductRefs as any);
  eleventyConfig.addFilter("findById", findById as any);
  eleventyConfig.addFilter("findByProductId", findByProductId as any);
  eleventyConfig.addFilter("imageUrl", (image, width, height, format, fit) =>
    imageUrl(ctx.imageBuilder, image, width, height, format, fit)
  );
  eleventyConfig.addFilter("imageSizeUrl", (image, size, format) =>
    imageSizeUrl(ctx.imageBuilder, image, size, format)
  );
  eleventyConfig.addFilter("stegaClean", stegaClean);
  eleventyConfig.addFilter("focalPoint", ((image: any) => {
    const hx = image?.hotspot?.x ?? 0.5
    const hy = image?.hotspot?.y ?? 0.5
    const cl = image?.crop?.left   ?? 0
    const cr = image?.crop?.right  ?? 0
    const ct = image?.crop?.top    ?? 0
    const cb = image?.crop?.bottom ?? 0
    const x = (hx - cl) / (1 - cl - cr)
    const y = (hy - ct) / (1 - ct - cb)
    return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) }
  }) as any);
  eleventyConfig.addFilter('limit', limit as any)
  eleventyConfig.addFilter('formatDate', function (date: string, style?: Intl.DateTimeFormatOptions['dateStyle']) {
    return formatDate(date, this.page?.lang || config.defaultLocale, style)
  })
  eleventyConfig.addFilter('formatNumber', function (num: number) {
    return formatNumber(num, this.page?.lang || config.defaultLocale)
  })
  eleventyConfig.addFilter('sortBy', ((arr: any[], path: string, reverse?: boolean) => {
    if (!Array.isArray(arr)) return arr
    const get = (obj: any) => path.split('.').reduce((o, k) => o?.[k], obj) ?? ''
    return [...arr].sort((a, b) => {
      const va = get(a), vb = get(b)
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return reverse ? -cmp : cmp
    })
  }) as any)
  eleventyConfig.addFilter('nl2br', nl2br)
  eleventyConfig.addFilter('postalCode', postalCode as any)
  eleventyConfig.addFilter('countryName', function (code: string) {
    return countryName(code, this.page?.lang || config.defaultLocale)
  })
  const portableTextExtCtx = {
    imageBuilder: ctx.imageBuilder,
    imageSizes: ctx.imageSizes,
    image: (img: any, size: any, options?: any) => image(ctx.imageBuilder, img, size, options),
    imageUrl: (image: any, width?: number, height?: number, format?: any) => imageUrl(ctx.imageBuilder, image, width, height, format),
    escapeHTML,
    stegaClean,
  }

  eleventyConfig.addFilter('portableText', function (blocks: any[], name?: string, options?: PortableTextOptions) {
    const locale = this.page?.lang || config.defaultLocale
    const urlMap: Record<string, string> = (this as any).ctx?.cms?.[locale]?.urlMap ?? {}
    const factory = config.extensions.portableTexts?.[name ?? 'default']
    const extra = factory?.(portableTextExtCtx)
    return renderPortableText(blocks, urlMap, extra as any, options)
  })
  eleventyConfig.addFilter('formatDateRange', function (from: string, to?: string, options?: { combine?: boolean }) {
    return formatDateRange(from, this.page?.lang || config.defaultLocale, to, options)
  })
  eleventyConfig.addFilter('docById', function (id: string) {
    const locale = this.page?.lang || config.defaultLocale
    return (this as any).ctx?.cms?.[locale]?.docMap?.[id] ?? null
  })
  eleventyConfig.addFilter('pageSchema', function (pageDoc: any, settings: any) {
    const locale = this.page?.lang || config.defaultLocale
    const products = (this as any).ctx?.cms?.[locale]?.products ?? []
    return buildPageDocSchema(pageDoc, locale, settings, config, (img, w) => imageUrl(ctx.imageBuilder, img, w), products)
  })
  eleventyConfig.addFilter('webSiteSchema', function (settings: any) {
    const locale = this.page?.lang || config.defaultLocale
    return buildWebSiteSchema(settings, config, locale)
  })
  eleventyConfig.addFilter('map', map as any)
  eleventyConfig.addFilter('truncate', truncate as any)

  /** Resolves a Sanity document ID to its URL via urlMap.
   * Usage: {{ item._id | pageUrl }} */
  eleventyConfig.addFilter('pageUrl', function (id: string) {
    const locale = this.page?.lang || config.defaultLocale
    return (this as any).ctx?.cms?.[locale]?.urlMap?.[id] ?? '#'
  })

  /** Returns aria-current="page" or data-state="active" attribute string.
   * Usage: <a href="{{ item.url }}" {{ item.url | linkActiveState }}> */
  eleventyConfig.addFilter('linkActiveState', function (this: any, url: string) {
    return linkActiveState(url, this.page?.url ?? '')
  })
}
