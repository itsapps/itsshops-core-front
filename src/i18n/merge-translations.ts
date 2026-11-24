type Tree = { [key: string]: unknown }

const isTree = (v: unknown): v is Tree => !!v && typeof v === 'object' && !Array.isArray(v)

/**
 * Deep-merge translation trees (nested objects of strings) into a new object; later sources win.
 * Dependency-free on purpose: it runs in the Netlify functions, which are ESM — a bare
 * `lodash/merge` subpath import doesn't resolve there.
 */
export function mergeTranslations<T extends object>(base: T, ...overlays: object[]): T {
  const out: Tree = { ...(base as Tree) }
  for (const overlay of overlays) {
    for (const [key, value] of Object.entries(overlay)) {
      out[key] = isTree(value) && isTree(out[key]) ? mergeTranslations(out[key] as Tree, value) : value
    }
  }
  return out as T
}
