import { defineConfig } from 'tsup';
import fsExtra from 'fs-extra';
import esbuild from 'esbuild';
const { copySync } = fsExtra;

export default defineConfig({
  entry: {
    itsshops: 'src/bin/itsshops.ts',
    index: 'src/index.ts',
    core: 'src/core/index.ts',
    preview: 'src/netlify/functions/preview.ts',
    'payment-create': 'src/netlify/functions/payment-create.ts',
    'payment-webhooks': 'src/netlify/functions/payment-webhooks.ts',
    'test-utils': 'src/test-utils/index.ts',
  },
  format: ['esm'],
  dts: true,
  splitting: false,
  clean: true,
  sourcemap: true,
  external: ['esbuild', 'vitest'],
  noExternal: ['@portabletext/to-html'],
  onSuccess: async () => {
    copySync('src/templates',          'dist/templates', { overwrite: true });
    copySync('src/scripts',            'dist/scripts',   { overwrite: true });
    copySync('src/shared',             'dist/shared',    { overwrite: true });
    copySync('src/assets/css/core.css', 'dist/core.css',  { overwrite: true });
    copySync('src/assets/css/reset.css','dist/reset.css', { overwrite: true });

    // Pre-build core inline scripts into dist/templates so {% include %} works
    // even when customers have no src/assets/scripts/inline/ of their own.
    await esbuild.build({
      entryPoints: ['src/scripts/inline/theme.ts'],
      outdir: 'dist/templates/scripts/inline',
      bundle: true,
      format: 'iife',
      target: 'es2017',
      minify: true,
    })
  },
});