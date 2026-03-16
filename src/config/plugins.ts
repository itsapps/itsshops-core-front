import { CoreContext } from '../types';
import { EleventyI18nPlugin } from '@11ty/eleventy';

export const setupPlugins = (ctx: CoreContext) => {
  const { eleventyConfig, config } = ctx
  
  eleventyConfig.addPlugin(EleventyI18nPlugin, {
    defaultLanguage: config.defaultLocale,
    errorMode: 'never'
  });
}