import { slugify, toIsoString } from "../utils";
import type { Locale, CoreContext, TranslatorParams } from "../types";
import { resolveString } from "../data/localizers";
import { imageUrl } from "../media"
import { stegaClean } from "@sanity/client/stega"

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
}
