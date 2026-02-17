import * as fs from 'fs';
import * as path from 'path';
import Nunjucks from 'nunjucks';
import { fileURLToPath } from "url"
// import {
//   EleventyRenderPlugin,
//   EleventyI18nPlugin,
// } from '@11ty/eleventy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templatesRoot = path.join(__dirname, 'templates');
const layoutsDir = path.join(templatesRoot, 'layouts');
const corePagesRoot = path.join(templatesRoot, 'pages');

export const loadTemplates = (eleventyConfig: any) => {
  // console.log("baseConfig: ", options.baseConfig)
  /*
   * Nunjucks - templates overrides
   */
  eleventyConfig.amendLibrary("njk", (env: any) => {
    env.loaders[0].searchPaths.push(
      path.resolve("src/_includes"),
      templatesRoot
    );
  });
  // const nunjucksEnvironment = new Nunjucks.Environment(
	// 	new Nunjucks.FileSystemLoader([
  //     path.resolve("src/_includes"),
  //     templatesRoot,
  //   ], { noCache: true })
	// );
	// eleventyConfig.setLibrary("njk", nunjucksEnvironment);
  eleventyConfig.setNunjucksEnvironmentOptions({
		throwOnUndefined: true,
	});
  

  // const layoutsDirName = eleventyConfig.directories.layouts || "_layouts";
  // const inputDir = eleventyConfig.dir.input;

  // layouts
  if (fs.existsSync(layoutsDir)) {
    for (const file of fs.readdirSync(layoutsDir)) {
      if (!file.endsWith(".njk")) continue

      const customerLayoutPath = path.join(process.cwd(), eleventyConfig.directories.layouts, file)
      // const customerLayoutPath = path.join(inputDir, layoutsDirName, file);
      if (fs.existsSync(customerLayoutPath)) {
        continue;
      }

      const content = fs.readFileSync(path.join(layoutsDir, file), "utf-8")
      let layoutPath = eleventyConfig.directories.getLayoutPathRelativeToInputDirectory(file);
      let layoutPat = `src/_layouts/${file}`;
      console.log("layoutPath: ", layoutPath)
      eleventyConfig.addTemplate(layoutPath, content)
      eleventyConfig.addLayoutAlias(file.replace(".njk", ""), file);

      // read core layout from core folder
      // const coreLayoutFilePath = path.join(layoutsDir, file);
      // const content = fs.readFileSync(coreLayoutFilePath, "utf-8");

      // // register virtual template inside Eleventy's layout namespace
      // const virtualLayoutPath = `${layoutsDirName}/${file}`;
      // eleventyConfig.addTemplate(virtualLayoutPath, content);
      // eleventyConfig.addLayoutAlias(file.replace(".njk", ""), virtualLayoutPath);
      
      
      // const customerLayoutPath = path.join(process.cwd(), layoutsDirName, file)
      // if (fs.existsSync(customerLayoutPath)) {
      //   continue // layout exists, so use this one instead of the one from core
      // }
      // const coreLayoutFilePath = path.join(layoutsDir, file);
      // const content = fs.readFileSync(coreLayoutFilePath, "utf-8");
      // let layoutPath = eleventyConfig.directories.getLayoutPathRelativeToInputDirectory(file);
      // const virtualLayoutPath = `${layoutPath}/${file}`;
      // eleventyConfig.addTemplate(virtualLayoutPath, content);
      // eleventyConfig.addLayoutAlias(file.replace(".njk", ""), virtualLayoutPath);
      // const layoutPath = path.join(layoutsDir, file);
      // const content = fs.readFileSync(layoutPath, "utf-8");
      // // let layoutPath = eleventyConfig.directories.getLayoutPathRelativeToInputDirectory(file);
      // // eleventyConfig.addTemplate(layoutPath, content);
      // const virtualLayoutPath = `_includes/layouts/${file}`;
      // eleventyConfig.addTemplate(virtualLayoutPath, content);

      // const content = fs.readFileSync(path.join(layoutsDir, file), "utf-8")
      // let layoutPath = eleventyConfig.directories.getLayoutPathRelativeToInputDirectory(file);
      // eleventyConfig.addTemplate(layoutPath, content)
      // eleventyConfig.addLayoutAlias(file.replace(".njk", ""), file);
    }
  } else {
    console.warn(`No layouts found  at: ${layoutsDir}`)
  }
  // return
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
          console.log(`🚫 Ignoring template: ${dirPath}/${file}`);
          eleventyConfig.ignores.add(path.join(dirPath, file))
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

  // return nunjucksEnvironment
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