import { CoreContext } from '../types';

export const setupAssets = (ctx: CoreContext) => {
  const { eleventyConfig, config } = ctx

  if (!config.preview.enabled) {
    const assetsToCopy = [
      'src/assets/fonts/',
    ]
    assetsToCopy.forEach(path => eleventyConfig.addPassthroughCopy(path))

    // favicons to root directory
    eleventyConfig.addPassthroughCopy({
      'src/assets/images/static/*': '/assets/images/'
    });
    eleventyConfig.addPassthroughCopy({
      'src/assets/images/favicon/*': '/'
    });
  }
}