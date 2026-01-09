import fs from "fs"
import path from "path"
import Nunjucks from "nunjucks"
import { fileURLToPath } from "url"
import {EleventyI18nPlugin} from '@11ty/eleventy';

import {createTranslation} from './utils/translation.mjs';
import priceData from "./shortcodes/priceData.js"
import cms from "./sanity/cms.mjs"
import { sanityApiVersion } from './shared/settings.mjs';
import { createSanityClient } from './sanity/client.mjs'
import { createImageBuilder } from './sanity/imageBuilder.mjs'
import { createSanityImageUrls, createSanityImageSeo } from './sanity/imageUrls.mjs'

import {
  languages,
} from './shared/locales.mjs';

// Convert current module URL to a directory path
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const coreRoot = path.resolve(__dirname)
const templatesRoot = path.join(coreRoot, "templates")

export const shopCoreFrontendPlugin = (eleventyConfig, options = {
  isDev: false,
  isPreview: false,
  locales: ['de', 'en'],
  sanityClientConfig: {
    projectId: "",
    dataset: "",
    token: "",
    perspective: "",
  },
  features: {
    products: true,
    pages: true,
    checkout: true,
    blog: false,
    users: false,
  },
  queryOptions: {},
  fragments: {},
  modules: {},
  aggregate: {},
}) => {
  /**
   * Locales
   * 
   */
  const projectLanguages = options.locales.map((locale) => {
    return languages.find((lang) => lang.code === locale)
  }).filter(Boolean);
  const locales = projectLanguages.map((locale) => locale.code);
  const defaultLocale = locales[0];// first locale is default

  // make globally available
  eleventyConfig.addGlobalData('supportedLocales', locales);
  eleventyConfig.addGlobalData('defaultLocale', defaultLocale);
  
  const translate = createTranslation({isDev: options.isDev, locales, defaultLocale});
  eleventyConfig.addPlugin(EleventyI18nPlugin, {
    defaultLanguage: defaultLocale,
    errorMode: 'never'
  });
  // template translation
  eleventyConfig.addFilter('t', function (key, params = {}, locale) {
    return translate(key, params, locale ?? this.page.lang);
  });
  

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
    ], { noCache: options.isDev })
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

  // layouts
  const layoutsDir = path.join(templatesRoot, "layouts")
  for (const file of fs.readdirSync(layoutsDir)) {
    if (!file.endsWith(".njk")) continue
    const customerLayoutPath = path.join(process.cwd(), eleventyConfig.directories.layouts, file)
    if (fs.existsSync(customerLayoutPath)) {
      // layout exists, so use this one instead of the one from core
      continue
    }

    const content = fs.readFileSync(path.join(layoutsDir, file), "utf-8")
    let layoutPath = eleventyConfig.directories.getLayoutPathRelativeToInputDirectory(file);
    eleventyConfig.addTemplate(layoutPath, content)
    // eleventyConfig.addLayoutAlias(file.replace(".njk", ""), file);
  }

  // templates
  const pageDirs = ["preview", "standard"]
  for (const dir of pageDirs) {
    const pagesDir = path.join(templatesRoot, "pages", dir)
    for (const file of fs.readdirSync(pagesDir)) {
      if (!file.endsWith(".njk")) continue
    
      const pagesPath = path.join(process.cwd(), eleventyConfig.directories.input, "pages", dir, file)
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


  const sanityClient = createSanityClient({...options.sanityClientConfig, apiVersion: sanityApiVersion});
  const imageBuilder = createImageBuilder(sanityClient);
  const imageUrls = createSanityImageUrls({ imageBuilder });
  const imageSeo = createSanityImageSeo({ sanityImageUrls: imageUrls });

  eleventyConfig.addGlobalData('cms', async () => cms({
    locales,
    defaultLocale,
    helpers: {
      translate,
      imageUrls,
      imageSeo,
    },
    client: sanityClient,
    features,
    queryOptions,
    overrideFragments: options.fragments,
    overrideModules: options.modules,
    aggregate: options.aggregate
  }));

  // eleventyConfig.addShortcode("priceData", priceData)
  eleventyConfig.addNunjucksGlobal("priceData", priceData)
}