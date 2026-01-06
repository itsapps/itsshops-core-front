import fs from "fs"
import path from "path"
import Nunjucks from "nunjucks"
import { fileURLToPath } from "url"

import priceData from "./shortcodes/priceData.js"
import cms from "./sanity/cms.mjs"
import { sanityApiVersion } from './shared/settings.mjs';

import {
  languages,
} from './shared/locales.mjs';

// Convert current module URL to a directory path
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const coreRoot = path.resolve(__dirname)
const templatesRoot = path.join(coreRoot, "templates")

export const shopCoreFrontendPlugin = (eleventyConfig, options = {}) => {
  /**
   * Locales
   * 
   */
  const projectLanguages = options.locales.map((locale) => {
    return languages.find((lang) => lang.code === locale)
  }).filter(Boolean);
  // first locale is default if customer didn't specify
  const locales = projectLanguages.map((locale) => locale.code);
  const defaultLocale = locales[0];
  // make globally available
  eleventyConfig.addGlobalData('supportedLocales', locales);
  eleventyConfig.addGlobalData('defaultLocale', defaultLocale);

  /*
   * Features
   */
  const defaultFeatures = {
    products: true,
    pages: true,
    checkout: true,
    blog: false,
    users: false,
  };
  const features = { ...defaultFeatures, ...options.features };
  const queryOptions = options.queryOptions || {};
  eleventyConfig.addGlobalData("features", features);

  // const coreLayouts = path.join(
  //   path.dirname(new URL(import.meta.url).pathname),
  //   "templates/layouts"
  // )
  // eleventyConfig.addLayoutAlias("base", "base.njk")

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
  eleventyConfig.addWatchTarget(templatesRoot);
  
  // const templatePath = path.join(
  //   __dirname, "templates", "something.njk"
  // )
  // const templateContent = fs.readFileSync(templatePath, "utf-8")
  // eleventyConfig.addTemplate("something.njk", templateContent)

  // read templates/layouts/ and add virtuals templates for each
  // const layoutsPath = path.join(templatesRoot, "layouts")
  // const layouts = fs.readdirSync(layoutsPath)
  // for (const layout of layouts) {
  //   const layoutPath = path.join(layoutsPath, layout)
  //   const layoutContent = fs.readFileSync(layoutPath, "utf-8")
  //   eleventyConfig.addTemplate(layout.replace(".njk", ""), layoutContent)
  // }

  // eleventyConfig.addLayoutAlias('base', "templates/layouts/base.njk");
  // eleventyConfig.addGlobalData("layout", path.join(templatesRoot, "layouts", 'base.njk'));
  // eleventyConfig.addLayoutAlias('base', path.join(templatesRoot, "layouts", 'base.njk'));

  const pageDirs = ["preview", "standard"]
  for (const dir of pageDirs) {
    const pagesDir = path.join(templatesRoot, "pages", dir)
    for (const file of fs.readdirSync(pagesDir)) {
      if (!file.endsWith(".njk")) continue
      
      // const content = fs.readFileSync(path.join(pagesDir, file), "utf-8")
      // eleventyConfig.addTemplate(`${dir}/${file}`, content)
    
      // const pagesPath = path.join(process.cwd(), "src/pages/preview", file)
      const pagesPath = path.join(process.cwd(), "src", "pages", dir, file)
      if (fs.existsSync(pagesPath)) {
        continue
      }

      // Skip user pages if disabled
      if (!features.users && file.startsWith("user-")) continue
      if (!features.checkout && file === "checkout.njk") continue

      const content = fs.readFileSync(path.join(pagesDir, file), "utf-8")
      eleventyConfig.addTemplate(`pages/${dir}/${file}`, content)
      // eleventyConfig.addTemplate(`${dir}/${file}`, content)
    }
  }


  eleventyConfig.addGlobalData('cms', async () => cms({
    locales,
    defaultLocale,
    apiVersion: sanityApiVersion,
    features,
    queryOptions,
    overrideFragments: options.fragments,
    overrideModules: options.modules
  }));

  // eleventyConfig.addShortcode("priceData", priceData)
  eleventyConfig.addNunjucksGlobal("priceData", priceData)
}