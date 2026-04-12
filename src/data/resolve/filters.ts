import { slugify } from '../slugify'
import { stegaClean } from '@sanity/client/stega'
import { formatVolumeMl } from '../../filters'
import type { ResolveContext } from '../../types'
import type { FilterGroup, ResolvedCategory, ResolvedFilterKey, ResolvedWine } from '../../types/data'

export type FilterAccumulator = Map<string, {
  label: string
  values: Map<string, { label: string; count: number }>
}>

export function buildFilterAttributes(
  kind: string,
  wine: ResolvedWine | null,
  rawOptions: Array<{ _id: string; name: any; group?: { _id: string; title: any } }>,
  ctx: ResolveContext,
  categories?: ResolvedCategory[],
): Record<string, string[]> {
  const attrs: Record<string, string[]> = {}

  if (kind === 'wine' && wine) {
    if (wine.vintage) attrs.vintage = [stegaClean(String(wine.vintage))]
    const w = wine as any
    if (w.color) attrs.color = [slugify(stegaClean(String(w.color)))]
    if (w.flavor) attrs.flavor = [slugify(stegaClean(String(w.flavor)))]
    if (w.varietals?.length) {
      attrs.varietal = (w.varietals as Array<{ name: string | null }>)
        .map(v => v.name ? slugify(stegaClean(v.name)) : '')
        .filter(Boolean)
    }
    if (w.classifications?.length) {
      attrs.classification = (w.classifications as Array<{ name: string | null }>)
        .map(c => c.name ? slugify(stegaClean(c.name)) : '')
        .filter(Boolean)
    }
    if (wine.volume) attrs.volume = [stegaClean(String(wine.volume))]
  }

  for (const opt of rawOptions) {
    if (!opt.group) continue
    const groupKey = slugify(stegaClean(ctx.resolveString(opt.group.title)) || opt.group._id)
    const valueSlug = slugify(stegaClean(ctx.resolveString(opt.name)))
    if (groupKey && valueSlug) {
      if (!attrs[groupKey]) attrs[groupKey] = []
      if (!attrs[groupKey].includes(valueSlug)) attrs[groupKey].push(valueSlug)
    }
  }

  if (categories?.length) {
    attrs.category = categories.map(c => c.slug).filter(Boolean)
  }

  return attrs
}

export function accumulateFilterGroups(
  acc: FilterAccumulator,
  kind: string,
  wine: ResolvedWine | null,
  rawOptions: Array<{ _id: string; name: any; group?: { _id: string; title: any } }>,
  ctx: ResolveContext,
  categories?: ResolvedCategory[],
): void {
  if (kind === 'wine' && wine) {
    if (wine.vintage) {
      const v = stegaClean(String(wine.vintage))
      addToAcc(acc, 'vintage', ctx.translate('filters.vintage'), v, v)
    }
    const w = wine as any
    if (w.color) {
      const c = stegaClean(String(w.color))
      addToAcc(acc, 'color', ctx.translate('filters.color'), slugify(c), c)
    }
    if (w.flavor) {
      const f = stegaClean(String(w.flavor))
      addToAcc(acc, 'flavor', ctx.translate('filters.flavor'), slugify(f), f)
    }
    if (w.varietals?.length) {
      const label = ctx.translate('filters.varietal')
      for (const varietal of w.varietals as Array<{ name: string | null }>) {
        if (varietal.name) addToAcc(acc, 'varietal', label, slugify(stegaClean(varietal.name)), stegaClean(varietal.name))
      }
    }
    if (w.classifications?.length) {
      const label = ctx.translate('filters.classification')
      for (const cl of w.classifications as Array<{ name: string | null }>) {
        if (cl.name) addToAcc(acc, 'classification', label, slugify(stegaClean(cl.name)), stegaClean(cl.name))
      }
    }
    if (wine.volume) {
      addToAcc(acc, 'volume', ctx.translate('filters.volume'), stegaClean(String(wine.volume)), formatVolumeMl(wine.volume, ctx.units.volume, ctx.locale))
    }
  }

  for (const opt of rawOptions) {
    if (!opt.group) continue
    const groupLabel = ctx.resolveString(opt.group.title) || ''
    const groupKey = slugify(stegaClean(groupLabel) || opt.group._id)
    const valueLabel = ctx.resolveString(opt.name)
    const valueSlug = slugify(stegaClean(valueLabel))
    if (groupKey && valueSlug) {
      addToAcc(acc, groupKey, groupLabel, valueSlug, valueLabel)
    }
  }

  if (categories?.length) {
    const label = ctx.translate('filters.category')
    for (const cat of categories) {
      if (cat.slug) addToAcc(acc, 'category', label, cat.slug, cat.title)
    }
  }
}

function addToAcc(
  acc: FilterAccumulator,
  groupKey: string,
  groupLabel: string,
  valueSlug: string,
  valueLabel: string,
): void {
  if (!acc.has(groupKey)) acc.set(groupKey, { label: groupLabel, values: new Map() })
  const group = acc.get(groupKey)!
  const existing = group.values.get(valueSlug)
  if (existing) existing.count++
  else group.values.set(valueSlug, { label: valueLabel, count: 1 })
}

/**
 * Resolve raw filter specs (from module or category GROQ data) to filter group keys.
 * wineFieldFilter → field string directly (e.g. 'vintage')
 * reference → slugified option group title
 */
export function resolveFilterSpecs(
  rawFilters: any[],
  ctx: ResolveContext,
): ResolvedFilterKey[] {
  return (rawFilters ?? []).flatMap((f: any) => {
    if (!f) return []
    const fType = stegaClean(f._type)
    if ((fType === 'wineFieldFilter' || fType === 'productFieldFilter') && f.field) return [stegaClean(f.field) as string]
    if (fType === 'reference' && f.title) {
      const key = slugify(stegaClean(ctx.resolveString(f.title)) || '')
      return key ? [key] : []
    }
    return []
  })
}

export function buildFilterGroups(acc: FilterAccumulator): FilterGroup[] {
  return Array.from(acc.entries()).map(([key, { label, values }]) => ({
    key,
    label,
    values: Array.from(values.entries())
      .map(([value, { label: vLabel, count }]) => ({ value, label: vLabel, count }))
      .sort((a, b) =>
        key === 'vintage'
          ? b.value.localeCompare(a.value)
          : key === 'volume'
            ? Number(a.value) - Number(b.value)
            : a.label.localeCompare(b.label)
      ),
  }))
}
