import fs from 'node:fs'
import path from 'node:path'
import { CoreContext } from '../types';
import { EleventyI18nPlugin } from '@11ty/eleventy';

export const setupPlugins = (ctx: CoreContext) => {
  const { eleventyConfig, config } = ctx

  eleventyConfig.addPlugin(EleventyI18nPlugin, {
    defaultLanguage: config.defaultLocale,
    errorMode: 'never'
  });

  eleventyConfig.addBundle('html');
  eleventyConfig.addBundle('js');

  const fontsPreloadDir = path.resolve(eleventyConfig.directories.input, 'assets/fonts/preload')
  const preloadFonts = fs.existsSync(fontsPreloadDir)
    ? fs.readdirSync(fontsPreloadDir, { recursive: true })
        .filter((f): f is string => typeof f === 'string' && f.endsWith('.woff2'))
        .map(f => `/assets/fonts/preload/${f.split(path.sep).join('/')}`)
    : []
  eleventyConfig.addGlobalData('preloadFonts', preloadFonts)
}