import fs from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';
import postcssImport from 'postcss-import';
import postcssImportExtGlob from 'postcss-import-ext-glob';
import postcssCustomMedia from 'postcss-custom-media';
import postcssNesting from 'postcss-nesting';
import tailwindcss from 'tailwindcss';
import tailwindcssnesting from 'tailwindcss/nesting/index.js';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';

import { getTailwindConfig } from './tailwind.config.mjs';

export const cssConfig = (eleventyConfig, {minify, ...tailwind}) => {
  eleventyConfig.addTemplateFormats('css');

  eleventyConfig.addExtension('css', {
    outputFileExtension: 'css',
    compile: async (inputContent, inputPath) => {
      const paths = [];
      if (inputPath.endsWith('/assets/css/global/global.css')) {
        paths.push('src/_includes/css/global.css');
      } else {
        return;
      }

      return async () => {
        const tailwindConfig = getTailwindConfig(tailwind);

        const plugins = [
          postcssImportExtGlob,
          postcssImport,
          postcssCustomMedia,
          postcssNesting,
          tailwindcssnesting,
          // tailwindcss(tailwindcssnesting),
          tailwindcss(tailwindConfig),
          postcssNesting,
          autoprefixer,
        ];
        if (minify) {
          plugins.push(cssnano);
        }
        let result = await postcss(plugins).process(inputContent, {from: inputPath});

        // Write the output to all specified paths
        for (const outputPath of paths) {
          await fs.mkdir(path.dirname(outputPath), {recursive: true});
          await fs.writeFile(outputPath, result.css);
        }

        return result.css;
      };
    }
  });
};
