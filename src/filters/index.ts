import { slugify, toIsoString } from "../utils";
import type { Locale, PluginConfigs } from "../types";
import { resolveString } from "../data/locale";
import { imageUrl } from "../media";

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

export const createFilters = (configs: PluginConfigs) => {
  const { eleventyConfig } = configs
  eleventyConfig.addFilter("slugify", slugify);
  eleventyConfig.addFilter("toIsoString", toIsoString);
  eleventyConfig.addFilter("formatPrice", formatPrice);
  eleventyConfig.addFilter("localize", localize);
  eleventyConfig.addFilter("filterByCategory", filterByCategory);
  eleventyConfig.addFilter("resolveProductRefs", resolveProductRefs);
  eleventyConfig.addFilter("imageUrl", imageUrl);
}
