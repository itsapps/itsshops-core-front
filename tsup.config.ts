import { defineConfig } from 'tsup';
import fsExtra from 'fs-extra';
const { copySync } = fsExtra;

export default defineConfig({
  entry: {
    itsshops: 'src/bin/itsshops.ts',
    index: 'src/index.ts',
    tailwind: 'tailwind.config.ts',
    preview: 'src/netlify/functions/preview.ts',
  },
  format: ['esm'],
  dts: true,        // Generates .d.ts files
  splitting: false, // Often safer for Netlify functions to avoid shared chunks
  clean: true,
  bundle: true,
  treeshake: true,
  external: ['fs', 'path', 'url'],
  noExternal: ['@sindresorhus/slugify', 'dayjs', 'nunjucks'],
  onSuccess: async () => {
    copySync('src/templates', 'dist/templates', { overwrite: true });
    copySync('src/assets', 'dist/assets', { overwrite: true });
  },
});