/**
 * Colour roles (`--color-*`) a compiled stylesheet uses without a fallback but never defines.
 *
 * defined  = every `--color-x:` declaration in the CSS
 * used     = every `var(--color-x)` **without** a fallback (`var(--color-x, …)` is skipped; an
 *            inner `var(--color-y)` inside that fallback still counts)
 * returns  = used − defined, de-duplicated and sorted.
 *
 * Catches a renamed/removed palette colour, which otherwise falls back silently to
 * inherited/initial. Customer `colors` replace core's default palette, so only their names exist.
 */
export function findUndefinedColorVars(css: string): string[] {
  const defined = new Set<string>()
  for (const m of css.matchAll(/(--color-[\w-]+)\s*:/g)) defined.add(m[1])
  const missing = new Set<string>()
  for (const m of css.matchAll(/var\(\s*(--color-[\w-]+)\s*\)/g)) {
    if (!defined.has(m[1])) missing.add(m[1])
  }
  return [...missing].sort()
}
