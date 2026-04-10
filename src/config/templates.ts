import * as fs from 'fs';
import * as path from 'path';
// import Nunjucks from 'nunjucks';
import { fileURLToPath } from "url"
import { type CoreContext } from '../types';
// import {
//   EleventyRenderPlugin,
//   EleventyI18nPlugin,
// } from '@11ty/eleventy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templatesRoot = path.join(__dirname, 'templates');
const layoutsDir    = path.join(templatesRoot, 'layouts');
const coreDir       = path.join(templatesRoot, 'core');
const corePagesRoot = path.join(templatesRoot, 'pages');

export const setupTemplates = (ctx: CoreContext) => {
  const { eleventyConfig, config } = ctx

  // add templates to search path
  loadTemplates(ctx)

  if (config.debug.enabled) {
    console.log('Debug mode enabled: throwing errors for undefined variables in templates')
    eleventyConfig.setNunjucksEnvironmentOptions({
      throwOnUndefined: true,
    });
  }
}

export const loadTemplates = (ctx: CoreContext) => {
  const { eleventyConfig, config } = ctx
  
  const loadedTemplates: string[] = []
  const ignoredTemplates: string[] = []

  const customerIncludesDir = path.resolve("src/_includes")

  // Nunjucks search order: customer overridable/ first, then core templates
  eleventyConfig.amendLibrary("njk", (env: any) => {
    env.loaders[0].searchPaths.push(customerIncludesDir, templatesRoot);
  });

  // Protect core/ templates from customer overrides
  if (fs.existsSync(coreDir)) {
    const walkCore = (dir: string, rel = '') => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const entryRel = path.join(rel, entry.name)
        if (entry.isDirectory()) {
          walkCore(path.join(dir, entry.name), entryRel)
        } else if (entry.name.endsWith('.njk')) {
          const conflict = path.join(customerIncludesDir, 'core', entryRel)
          if (fs.existsSync(conflict)) {
            throw new Error(`Conflict detected: You are not allowed to override the core template at: ${conflict}`)
          }
        }
      }
    }
    walkCore(coreDir)
  }

  if (fs.existsSync(layoutsDir)) {
    for (const file of fs.readdirSync(layoutsDir)) {
      if (!file.endsWith(".njk")) continue

      const customerLayoutPath = path.join(process.cwd(), eleventyConfig.directories.layouts, file)
      if (fs.existsSync(customerLayoutPath)) {
        throw new Error(`Conflict detected: You are not allowed to override the core layout at: ${customerLayoutPath}`)
      }

      // const content = '<main id="main" class="relative">{{ shopConfig.title | safe }}{{ content | safe }}</main>'
      const content = fs.readFileSync(path.join(layoutsDir, file), "utf-8")
      let layoutPath = eleventyConfig.directories.getLayoutPathRelativeToInputDirectory(file) as string
      eleventyConfig.addTemplate(layoutPath, content, {})
      loadedTemplates.push(layoutPath)
    }
  } else {
    console.warn(`No layouts found  at: ${layoutsDir}`)
  }

  const customerPagesRoot = path.join(eleventyConfig.directories.input, 'pages')

  // eleventyConfig.addTemplate("virtual.11ty.js", function(data: any) {
	// 	return `<h1>Hello</h1>`;
	// });

  for (const dir of fs.readdirSync(corePagesRoot)) {
    const dirPath = path.join(corePagesRoot, dir)
    if (!fs.statSync(dirPath).isDirectory()) continue

    for (const file of fs.readdirSync(dirPath)) {
      if (!file.endsWith('.njk')) continue

      const customerPath = path.join(customerPagesRoot, dir, file)
      const corePath = path.join(dirPath, file)
      if (fs.existsSync(customerPath)) {
        throw new Error(`Conflict detected: You are not allowed to override the core page template at: ${customerPath}`)
      }

      const ignoreTemplate = shouldIgnoreTemplate({ dir, file, ctx })
      const templatePath = path.join(dir, file)
      if (ignoreTemplate) {
        ignoredTemplates.push(templatePath)
      } else {
        eleventyConfig.addTemplate(`pages/${dir}/${file}`, fs.readFileSync(corePath, 'utf8'), {})
        loadedTemplates.push(templatePath)
      }
    }
  }

  // misc templates
  const coreMiscPagesRoot = path.join(templatesRoot, 'misc');
  const walkAndAdd = (currentDirPath: string, relativePath = "") => {
    const entries = fs.readdirSync(currentDirPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentDirPath, entry.name);
      const entryRelativePath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        // Recursive call for subfolders
        walkAndAdd(entryPath, entryRelativePath);
      } else if (entry.isFile() && entry.name.endsWith('.njk')) {
        // Logic for .njk files
        const customerPath = path.join(customerPagesRoot, entryRelativePath);

        if (!fs.existsSync(customerPath)) {
          // Register the virtual template. 
          // We use entryRelativePath to maintain the folder structure in the URL (e.g., misc/sub/page.njk)
          if (config.buildMode === 'normal') {
            const templatePath = path.join('misc', entryRelativePath)
            eleventyConfig.addTemplate(
              templatePath, 
              fs.readFileSync(entryPath, 'utf8'),
              {},
            );
            loadedTemplates.push(templatePath)
          } else {
            ignoredTemplates.push(entryRelativePath)
          }
        } else {
          throw new Error(`Conflict detected: You are not allowed to override the core template at: ${customerPath}`);
        }
      }
    }
  };

  // Start the process
  if (fs.existsSync(coreMiscPagesRoot)) {
    walkAndAdd(coreMiscPagesRoot);
  }

  // Log loaded and ignored templates
  console.log('BUILD MODE: ', config.buildMode.toUpperCase());
  console.log(`✅ Loaded templates:\n${loadedTemplates.map(t => `   - ${t}`).join('\n')}`);
  if (ignoredTemplates.length > 0) {
    console.warn(`⚠️ Ignored templates:\n${ignoredTemplates.map(t => `   - ${t}`).join('\n')}`);
  }
}

function shouldIgnoreTemplate({
  dir,
  file,
  ctx
}: {
  dir: string,
  file: string,
  ctx: CoreContext
}): boolean {
  const { config } = ctx
  const mode = config.buildMode

  /* ------------------------------
   * PREVIEW MODE (selected doc only)
   * ------------------------------ */
  if (mode === 'preview') {
    if (dir !== 'preview') return true
    return file !== `${config.preview.documentType}s.njk`
  }

  /* ------------------------------
   * MAINTENANCE MODE
   * ------------------------------ */
  if (mode === 'maintenance') {
    return !(dir === 'maintenance' && file === 'maintenance.njk')
  }

  /* ------------------------------
   * NORMAL MODE
   * ------------------------------ */

  // Feature-gated normal pages
  const features = config.features

  if (dir === 'standard') {
    if (file.startsWith('user-') && !features.users.enabled) return true
    if (file.startsWith('blog-') && !features.blog) return true
    if (file === 'products.njk' && !features.shop.enabled) return true
    if (file === 'categories.njk' && !features.shop.category) return true
    if (file === 'manufacturers.njk' && !features.shop.manufacturer) return true
    if ((file === 'checkout.njk' || (file === 'order-thanks.njk')) && !features.shop.checkout) return true
  }
  if (dir === 'maintenance') return true
  if (dir === 'preview') return true

  return false
}