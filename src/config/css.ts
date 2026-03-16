import fs from 'node:fs/promises'
import path from 'node:path'

import { type CoreContext } from '../types'

export const cssConfig = (ctx: CoreContext) => {
  const { eleventyConfig, config } = ctx
  eleventyConfig.addBundle('css', {hoist: true});

  if (config.preview.enabled) {
    return
  }

  const { cssPath, minify, ...tailwind } = config.css || {};
  eleventyConfig.addTemplateFormats('css');

  eleventyConfig.addExtension('css', {
    outputFileExtension: 'css',
    compile: async (inputContent: string, inputPath: string) => {
      const paths: string[] = [];
      if (inputPath.endsWith(cssPath || '/assets/css/global/global.css')) {
        paths.push('src/_includes/css/global.css');
      } else {
        return;
      }

      return async () => {
        const [
          { default: postcss },
          { default: postcssImport },
          { default: postcssImportExtGlob },
          { default: postcssCustomMedia },
          { default: postcssNesting },
          { default: tailwindcss },
          { default: tailwindcssnesting },
          { default: autoprefixer },
          { getTailwindConfig },
        ] = await Promise.all([
          import('postcss'),
          import('postcss-import'),
          import('postcss-import-ext-glob'),
          import('postcss-custom-media'),
          import('postcss-nesting'),
          import('tailwindcss'),
          import('tailwindcss/nesting/index.js'),
          import('autoprefixer'),
          import('./tailwind/tailwind.config.js'),
        ])

        const tailwindConfig = getTailwindConfig(tailwind);

        const plugins: any[] = [
          postcssImportExtGlob,
          postcssImport,
          postcssCustomMedia,
          postcssNesting,
          tailwindcssnesting,
          tailwindcss(tailwindConfig),
          postcssNesting,
          autoprefixer,
        ];
        if (minify) {
          const { default: cssnano } = await import('cssnano')
          plugins.push(cssnano);
        }
        const result = await postcss(plugins).process(inputContent, {from: inputPath});

        for (const outputPath of paths) {
          await fs.mkdir(path.dirname(outputPath), {recursive: true});
          await fs.writeFile(outputPath, result.css);
        }

        return result.css;
      };
    }
  });
};
