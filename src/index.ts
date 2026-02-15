import * as fs from 'fs';          // Fixes TS1192
import * as path from 'path';      // Fixes TS1259
import Nunjucks from 'nunjucks';   // (Or import * as nunjucks from 'nunjucks' if it still complains)

// For local imports (TS5097):
// In modern TS, you should import the '.mjs' or '.js' equivalent, 
// or remove the extension entirely if you aren't using "allowImportingTsExtensions"
// import { someUtil } from './utils';

import { fileURLToPath } from "url"
// import {
//   EleventyRenderPlugin,
//   EleventyI18nPlugin,
// } from '@11ty/eleventy';
import { someFilter } from './config/filters';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templatesRoot = path.join(__dirname, 'templates'); // now in dist/
const layoutsDir = path.join(templatesRoot, 'layouts');
const corePagesRoot = path.join(templatesRoot, 'pages');

export const shopCoreFrontendPlugin = (eleventyConfig: any, options: any) => {
  // console.log("baseConfig: ", options.baseConfig)
  /*
   * Nunjucks - templates overrides
   */
  let nunjucksEnvironment = new Nunjucks.Environment(
		new Nunjucks.FileSystemLoader([
      path.resolve("src/_includes"),
      templatesRoot,
    ], { noCache: true })
	);
	eleventyConfig.setLibrary("njk", nunjucksEnvironment);
  eleventyConfig.setNunjucksEnvironmentOptions({
		throwOnUndefined: true,
	});
  

  // layouts
  if (fs.existsSync(layoutsDir)) {
    for (const file of fs.readdirSync(layoutsDir)) {
      if (!file.endsWith(".njk")) continue
      const customerLayoutPath = path.join(process.cwd(), eleventyConfig.directories.layouts, file)
      if (fs.existsSync(customerLayoutPath)) {
        continue // layout exists, so use this one instead of the one from core
      }

      const content = fs.readFileSync(path.join(layoutsDir, file), "utf-8")
      let layoutPath = eleventyConfig.directories.getLayoutPathRelativeToInputDirectory(file);
      eleventyConfig.addTemplate(layoutPath, content)
      // eleventyConfig.addLayoutAlias(file.replace(".njk", ""), file);
    }
  } else {
    console.warn(`No layouts found  at: ${layoutsDir}`)
  }
  const buildMode = 'normal'

  const customerPagesRoot = path.join(eleventyConfig.directories.input, 'pages')
  // const projectRoot = process.cwd();
  // const customerPagesRoot = path.resolve(
  //   projectRoot,
  //   eleventyConfig.directories.input,
  //   'pages'
  // );

  console.log(`🔍 Checking for pages at: ${customerPagesRoot}`);
  if (fs.existsSync(customerPagesRoot)) {
    for (const dir of fs.readdirSync(customerPagesRoot)) {
      const dirPath = path.join(customerPagesRoot, dir)
      if (!fs.statSync(dirPath).isDirectory()) continue

      for (const file of fs.readdirSync(dirPath)) {
        if (!file.endsWith('.njk')) continue

        if (shouldIgnoreTemplate({
          mode: buildMode,
          previewType: "options.preview.documentType",
          dir,
          file,
          features: {}
        })) {
          eleventyConfig.ignores.add(path.join(dirPath, file))
        }
      }
    }
  }

  for (const dir of fs.readdirSync(corePagesRoot)) {
    const dirPath = path.join(corePagesRoot, dir)
    if (!fs.statSync(dirPath).isDirectory()) continue

    for (const file of fs.readdirSync(dirPath)) {
      if (!file.endsWith('.njk')) continue

      const customerPath = path.join(customerPagesRoot, dir, file)
      const corePath = path.join(dirPath, file)

      if (
        !shouldIgnoreTemplate({
          mode: buildMode,
          previewType: "options.preview.documentType",
          dir,
          file,
          features: {}
        }) &&
        !fs.existsSync(customerPath)
      ) {
        eleventyConfig.addTemplate(`pages/${dir}/${file}`, fs.readFileSync(corePath, 'utf8'))
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
          eleventyConfig.addTemplate(
            path.join('misc', entryRelativePath), 
            fs.readFileSync(entryPath, 'utf8')
          );
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

  eleventyConfig.addFilter("someFilter", someFilter);
}

function shouldIgnoreTemplate({
  mode,          // 'preview' | 'maintenance' | 'normal'
  previewType,   // 'page' | 'post'
  dir,
  file,
  features
}: {mode: string, previewType: string, dir: string, file: string, features: any}) {
  /* ------------------------------
   * PREVIEW MODE (selected doc only)
   * ------------------------------ */
  if (mode === 'preview') {
    if (dir !== 'preview') return true
    return file !== `${previewType}s.njk`
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
  if (dir === 'standard') {
    return false
  }
  else if (dir === 'preview') {
    return false
  }

  // All other directories
  // Preview templates are enabled in normal mode
  // Maintenance templates ignored in normal mode
  if (dir === 'maintenance') return true

  return false
}