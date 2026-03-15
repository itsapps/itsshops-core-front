import { PluginConfigs } from '../types';

export const setupAssets = (configs: PluginConfigs) => {
  const { eleventyConfig, config } = configs

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