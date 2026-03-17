import path from 'node:path'
import { CoreContext } from '../types';

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
}