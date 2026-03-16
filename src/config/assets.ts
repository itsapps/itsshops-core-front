import { CoreContext } from '../types';

export const setupAssets = (ctx: CoreContext) => {
  const { eleventyConfig, config } = ctx

  if (!config.preview.enabled) {
    const assetsToCopy = [
      'src/assets/images/emailHeaderLogo.png',
      'src/assets/images/ripple.png',
      'src/assets/fonts/',
    ]
    assetsToCopy.forEach(path => eleventyConfig.addPassthroughCopy(path))

    // favicons to root directory
    eleventyConfig.addPassthroughCopy({
      'src/assets/images/favicon/*': '/'
    });
  }
}