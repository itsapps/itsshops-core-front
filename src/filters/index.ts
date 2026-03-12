import { slugify, toIsoString } from "../utils";
import type { Locale } from "../types";
import { resolveString } from "../data/locale";

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
 * Resolve an array of product refs [{_id, ...}] to full products from cms data.
 * Usage: {% set resolved = module.products | resolveProductRefs(cms[_locale].products) %}
 */
function resolveProductRefs(refs: any[], allProducts: any[]): any[] {
  const map = new Map((allProducts ?? []).map((p: any) => [p._id, p]))
  return (refs ?? []).map(r => map.get(r._id)).filter(Boolean) as any[]
}

export const createFilters = (eleventyConfig: any) => {
  eleventyConfig.addFilter("slugify", slugify);
  eleventyConfig.addFilter("toIsoString", toIsoString);
  eleventyConfig.addFilter("formatPrice", formatPrice);
  eleventyConfig.addFilter("localize", localize);
  eleventyConfig.addFilter("filterByCategory", filterByCategory);
  eleventyConfig.addFilter("resolveProductRefs", resolveProductRefs);
}
