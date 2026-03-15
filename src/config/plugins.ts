import { PluginConfigs } from '../types';
import { EleventyI18nPlugin } from '@11ty/eleventy';

export const setupPlugins = (configs: PluginConfigs) => {
  const { eleventyConfig, config } = configs
  
  eleventyConfig.addPlugin(EleventyI18nPlugin, {
    defaultLanguage: config.defaultLocale,
    errorMode: 'never'
  });
}