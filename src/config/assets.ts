import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CoreContext } from '../types';

// Bundled into dist/index.js → this is core's dist/
const coreDist = path.dirname(fileURLToPath(import.meta.url))

export const setupAssets = (ctx: CoreContext) => {
  const { eleventyConfig, config } = ctx
  if (config.preview.enabled) return

  const input = eleventyConfig.directories.input

  eleventyConfig.addPassthroughCopy(path.join(input, 'assets/fonts/'))

  eleventyConfig.addPassthroughCopy({
    [path.join(input, 'assets/images/static/*')]: '/assets/images/'
  })
  eleventyConfig.addPassthroughCopy({
    [path.join(input, 'assets/images/favicon/*')]: '/'
  })
  // Core-shipped legal graphics (harmonised warranty notice) — also linked from the order email.
  eleventyConfig.addPassthroughCopy({
    [path.join(coreDist, 'assets/legal')]: '/assets/legal'
  })
}