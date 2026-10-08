// Loads every built Netlify function (`exports["./functions/*"]`) in plain Node ESM — the way
// Netlify runs them. Catches imports vitest resolves but Node doesn't (e.g. an extensionless
// `lodash/merge` subpath). Run after `npm run build`: `npm run check:functions`.
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
// Some modules create clients at import time; dummy values are enough to load them.
for (const name of ['SANITY_PROJECT_ID', 'SANITY_DATASET', 'SANITY_TOKEN']) process.env[name] ??= 'check'

let failed = 0
const subpaths = Object.keys(pkg.exports).filter((key) => key.startsWith('./functions/'))
for (const subpath of subpaths) {
  try {
    await import(new URL(`../${pkg.exports[subpath].import}`, import.meta.url).href)
  } catch (err) {
    failed++
    console.error(`✗ ${subpath}: ${String(err?.message ?? err).split('\n')[0]}`)
  }
}
console.log(`${subpaths.length - failed}/${subpaths.length} functions load in plain Node`)
process.exit(failed ? 1 : 0)
