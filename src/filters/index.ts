import { slugify, toIsoString } from "../utils";
import type { Locale, CoreContext, TranslatorParams } from "../types";
import { resolveString } from "../data/localizers";
import { imageUrl } from "../media"
import { stegaClean } from "@sanity/client/stega"
import { renderPortableText } from "../data/portableText"

/**
 * Format a price in cents to a locale-aware currency string.
 * Usage: {{ product.price | formatPrice('de', 'EUR') }}
 */
function formatPrice(cents: number, locale = 'de', currency = 'EUR'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100)
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

/** Convert newlines to <br> — pipe result through | safe in templates */
function nl2br(text: string): string {
  if (!text) return ''
  return text.replace(/\r?\n/g, '<br>')
}

export const createFilters = (ctx: CoreContext) => {
  const { eleventyConfig, config, translate } = ctx

  // translation
  eleventyConfig.addFilter('trans', function (key: string, params: TranslatorParams = {}) {
    return translate(key, params, this.page?.lang || config.defaultLocale)
  })

  eleventyConfig.addFilter("slugify", slugify);
  eleventyConfig.addFilter("toIsoString", toIsoString);
  // eleventyConfig.addFilter("formatPrice", formatPrice);
  eleventyConfig.addFilter("formatPrice", function (price: number, locale: string | undefined) {
    return formatPrice(price, locale || this.page.lang || config.defaultLocale);
  });
  eleventyConfig.addFilter("localize", localize);
  eleventyConfig.addFilter("filterByCategory", filterByCategory as any);
  eleventyConfig.addFilter("resolveProductRefs", resolveProductRefs as any);
  eleventyConfig.addFilter("findById", findById as any);
  eleventyConfig.addFilter("imageUrl", (image, width, height) =>
    imageUrl(ctx.imageBuilder, image, width, height)
  );
  eleventyConfig.addFilter("stegaClean", stegaClean);
  eleventyConfig.addFilter('limit', limit)
  eleventyConfig.addFilter('formatDate', function (date: string, style?: Intl.DateTimeFormatOptions['dateStyle']) {
    return formatDate(date, this.page?.lang || config.defaultLocale, style)
  })
  eleventyConfig.addFilter('nl2br', nl2br)
  eleventyConfig.addFilter('portableText', function (blocks: any[]) {
    const locale = this.page?.lang || config.defaultLocale
    const urlMap: Record<string, string> = this.ctx?.cms?.[locale]?.urlMap ?? {}
    return renderPortableText(blocks, urlMap, config.extensions?.portableText as any)
  })
  eleventyConfig.addFilter('formatDateRange', function (from: string, to?: string, options?: { combine?: boolean }) {
    return formatDateRange(from, this.page?.lang || config.defaultLocale, to, options)
  })
}
