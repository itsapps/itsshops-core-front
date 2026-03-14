import * as fs from 'fs';
import * as path from 'path';
// import Nunjucks from 'nunjucks';
import { fileURLToPath } from "url"
import { PluginConfigs, CoreConfig } from '../types';
// import {
//   EleventyRenderPlugin,
//   EleventyI18nPlugin,
// } from '@11ty/eleventy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templatesRoot = path.join(__dirname, 'templates');
const layoutsDir = path.join(templatesRoot, 'layouts');
const corePagesRoot = path.join(templatesRoot, 'pages');

export const loadTemplates = (configs: PluginConfigs) => {
  const loadedTemplates: string[] = []
  const ignoredTemplates: string[] = []
  const { eleventyConfig, config } = configs

  // add templates to search path
  eleventyConfig.amendLibrary("njk", (env: any) => {
    env.loaders[0].searchPaths.push(
      path.resolve("src/_includes"),
      templatesRoot
    );
  });

  // 
  if (fs.existsSync(layoutsDir)) {
    for (const file of fs.readdirSync(layoutsDir)) {
      if (!file.endsWith(".njk")) continue

      const customerLayoutPath = path.join(process.cwd(), eleventyConfig.directories.layouts, file)
      // const customerLayoutPath = path.join(inputDir, layoutsDirName, file);
      if (fs.existsSync(customerLayoutPath)) {
        loadedTemplates.push(customerLayoutPath)
        continue;
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
          dir,
          file,
          config,
        })) {
          console.log(`🚫 Ignoring template: ${dirPath}/${file}`);
          const templatePath = path.join(dir, file)
          eleventyConfig.ignores.add(templatePath)
          ignoredTemplates.push(templatePath)
        }
      }
    }
  }

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
      const ignoreTemplate = shouldIgnoreTemplate({
        dir,
        file,
        config
      })
      const templatePath = path.join(dir, file)
      if (ignoreTemplate) {
        ignoredTemplates.push(templatePath)
      } else if (!fs.existsSync(customerPath)) {
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
  config
}: {
  dir: string,
  file: string,
  config: CoreConfig}
): boolean {
  const mode = config.buildMode

  /* ------------------------------
   * PREVIEW MODE (selected doc only)
   * ------------------------------ */
  if (mode === 'preview') {
    if (dir !== 'preview') return true
    if (file === 'posts.njk' && !config.features.blog) return true
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
    if (file.startsWith('user-') && !features.users) return true
    if (file.startsWith('blog-') && !features.blog) return true
    if (file === 'products.njk' && !features.shop.enabled) return true
    if (file === 'categories.njk' && !features.shop.category) return true
    if (file === 'manufacturers.njk' && !features.shop.manufacturer) return true
    if ((file === 'checkout.njk' || (file === 'order-thanks.njk')) && !features.shop.checkout) return true
  }
  else if (dir === 'preview') {
    if (file.startsWith('posts') && !features.blog) return true
    return false
  }

  // All other directories
  // Preview templates are enabled in normal mode
  // Maintenance templates ignored in normal mode
  if (dir === 'maintenance') return true

  return false
}