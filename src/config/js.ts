import esbuild from 'esbuild'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import type { CoreContext } from '../types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Core default deferred entry — shipped in dist/scripts/ via tsup onSuccess copy
const coreScriptsEntry = path.join(__dirname, 'scripts/index.ts')

export const setupJs = (ctx: CoreContext) => {
  const { eleventyConfig, config } = ctx

  if (config.preview.enabled) return

  const minify    = config.js.minify ?? false
  const outdir    = path.resolve(eleventyConfig.directories.output, 'assets/scripts')
  const scriptsRoot = path.resolve(eleventyConfig.directories.input, 'assets/scripts')

  // Use customer's entry if it exists, otherwise fall back to core default
  const customerEntry = path.join(scriptsRoot, 'index.ts')
  const deferredEntry = fs.existsSync(customerEntry) ? customerEntry : coreScriptsEntry

  eleventyConfig.addTemplateFormats('ts')
  eleventyConfig.addExtension('ts', {
    outputFileExtension: 'js',
    compile: async (_content: string, inputPath: string) => {
      const abs = path.resolve(inputPath)

      // Only handle files inside src/assets/scripts/
      if (!abs.startsWith(scriptsRoot)) return

      // ── Deferred bundle ──────────────────────────────────────────────────────
      // Any change in src/assets/scripts/ triggers a full rebuild from the entry.
      // esbuild writes directly to dist/assets/scripts/ with code splitting.
      await esbuild.build({
        entryPoints: [deferredEntry],
        outdir,
        bundle: true,
        splitting: true,
        format: 'esm',
        target: 'es2020',
        minify,
      })
      // esbuild writes the files; Eleventy produces no output
    }
  })
}
