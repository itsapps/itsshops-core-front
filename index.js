import fs from "fs"
import path from "path"
import Nunjucks from "nunjucks"
import { fileURLToPath } from "url"
import {
  EleventyRenderPlugin,
  EleventyI18nPlugin,
} from '@11ty/eleventy';

import {createTranslation} from './utils/frontTranslation.mjs';

import cms from "./data/cms.mjs"
import { createSanityClient, createImageBuilder } from './shared/sanity.mjs'
import { createImageSettings } from './data/imageSizes.mjs'
import { createStaticPages } from './data/static.mjs'
import { cssConfig } from "./config/tailwind/css-config.mjs";
import { formatDate, localizeMoney, localizeNumber, getLocalizedValue, getLocalizedObject, getLocalizedImage } from './shared/localize.mjs';
import { sanityImageUrls, sanityImageSchema, sanityImagePreload, sanityImageSeo, sanityReplaceableImageUrl, pictureFromData, sanityPicture } from './utils/media.mjs';
import { toIsoString, readingTime, toJson, fromJson, encodeText } from './utils/utils.mjs';

import {
  languages,
  languageMap,
} from './data/locales.mjs';

// Convert current module URL to a directory path
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const coreRoot = path.resolve(__dirname)
const assetsRoot = path.join(coreRoot, "assets")
const templatesRoot = path.join(coreRoot, "templates")

const sanityApiVersion = "v2025-05-25"

export const shopCoreFrontendPlugin = (eleventyConfig, options = {
  dev: {
    enabled: true,
    liveReload: true,
    serverPort: 8080,
  },
  isMaintenanceMode: false,
  preview: {
    enabled: false,
    documentType: "page",
    documentId: undefined,
    locale: "de",
  },
  locales: ['de', 'en'],
  defaultLocale: 'de',
  translations: {},
  css: {
    minify: false,
    inline: true,
    viewport: {},
    screens: {},
    colors: [],
    fontFamilies: [],
    textSizes: [],
    spacings: [],
  },
  js: {
    minify: false,
  },
  imagePlaceholders: {},
  baseUrl,
  hostname,
  doIndexPages: false,
  captchaSiteKey,
  maxProducts: -1,
  manifest: {
    themeBgColor: '#ffffff',
    themeColor: '#000000',
  },
  developer: {
    name: "",
    website: "",
  },
  stripe: {
    publishableApiKey: "",
  },
  supportEmail: "",
  sanity: {
    projectId: "",
    dataset: "",
    token: "",
    perspective: "",
    studioUrl: "",
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
  const isDev = options.dev.enabled;
  const isPreview = options.preview.enabled;
  const isMaintenanceMode = options.isMaintenanceMode;

  /*
   * Features
   */
  const defaultFeatures = {
    products: true,
    checkout: true,
    blog: false,
    users: false,
  };
  const features = { ...defaultFeatures, ...options.features };
  eleventyConfig.addGlobalData("features", features);

  /**
   * Locales
   */
  const projectLanguages = options.locales.map((locale) => {
    return languages.find((lang) => lang.code === locale)
  }).filter(Boolean);
  const locales = projectLanguages.map((locale) => locale.code);
  const defaultLocale = options.defaultLocale;
  // translation
  const translate = createTranslation({isDev: isDev, locales, defaultLocale, overrides: options.translations});
  eleventyConfig.addPlugin(EleventyI18nPlugin, {
    defaultLanguage: defaultLocale,
    errorMode: 'never'
  });
  // template translation
  // eleventyConfig.addFilter('t', function (key, params = {}, locale) {
  //   return translate(key, params, locale ?? this.page.lang);
  // });
  const localizers = {
    formatDate,
    localizeMoney,
    localizeNumber,
    getLocalizedValue: (obj, attribute, locale) => getLocalizedValue(obj, attribute, locale, defaultLocale, locales),
    getLocalizedObject: (obj, locale) => getLocalizedObject(obj, locale, defaultLocale, locales),
    getLocalizedImage: (image, locale) => getLocalizedImage(image, locale, defaultLocale, locales),
    translate: (key, params = {}, locale) => translate(key, params, locale || this?.page?.lang || defaultLocale),
    t: (key, params = {}, locale) => translate(key, params, locale || this?.page?.lang || defaultLocale),
  }
  Object.entries(localizers).forEach(([k, v]) => {
    eleventyConfig.addFilter(k, v);
    eleventyConfig.addShortcode(k, v);
  })
  eleventyConfig.addGlobalData('localizers', localizers);
  const utils = {
    toIsoString, readingTime, toJson, fromJson, encodeText
  }
  Object.entries(utils).forEach(([k, v]) => {
    eleventyConfig.addFilter(k, v)
    eleventyConfig.addShortcode(k, v)
  });
  eleventyConfig.addGlobalData('utils', utils);

  // static pages
  eleventyConfig.addGlobalData('static', createStaticPages(locales, isDev, translate));

  /**
   * Ignores
   */
  eleventyConfig.setUseGitIgnore(false);
  isDev && eleventyConfig.watchIgnores.add("**/.DS_Store");
  eleventyConfig.ignores.add("node_modules");
  eleventyConfig.ignores.add(path.join(eleventyConfig.directories.includes, "css"));
  eleventyConfig.ignores.add(path.join(eleventyConfig.directories.includes, "scripts"));
  isDev && eleventyConfig.watchIgnores.add(path.join(eleventyConfig.directories.includes, "css"));
  isDev && eleventyConfig.watchIgnores.add(path.join(eleventyConfig.directories.includes, "scripts"));
  isDev && eleventyConfig.addWatchTarget(templatesRoot);
  isDev && eleventyConfig.addWatchTarget('./src/assets/**/*.{css,ts,js,mjs,svg,png,jpeg}');

  // 	---------------------  Debug -----------------------
  isDev && eleventyConfig.addFilter("debugger", (...args) => {
    return ""
  })
  isDev && eleventyConfig.setServerOptions({
    port: options.dev.serverPort,
    showAllHosts: true,
    liveReload: options.dev.liveReload,
    middleware: [
      function (req, res, next) {
        if (req.url === '/') {
          res.writeHead(302, { Location: `/${defaultLocale}` });
          res.end();
          return;
        }
        next();
      }
    ]
  });

  // settings
  eleventyConfig.addGlobalData('settings', {
    defaultLocale,
    supportedLocales: locales,
    inlineCss: options.css.inline,
    isMaintenanceMode: options.isMaintenanceMode,
    isPreview,
    supportEmail: options.supportEmail,
    baseUrl: options.baseUrl,
    doIndexPages: options.doIndexPages,
    toAbsoluteUrl: (relativePath) => {
      return new URL(relativePath, options.baseUrl).href
    }
  });

  // css/tailwind
  !isPreview && eleventyConfig.addPlugin(cssConfig, options.css);
  // TODO: jsconfig !isPreview && eleventyConfig.addPlugin(plugins.jsConfig);
  
  eleventyConfig.addPlugin(EleventyRenderPlugin);
  eleventyConfig.addBundle('css', {hoist: true});
  eleventyConfig.addBundle("html");
  eleventyConfig.addBundle("js");

  /*
   * Nunjucks - templates overrides
   */
  let nunjucksEnvironment = new Nunjucks.Environment(
		new Nunjucks.FileSystemLoader([
      path.resolve("src/_includes"),
      templatesRoot,
    ], { noCache: isDev })
	);
	eleventyConfig.setLibrary("njk", nunjucksEnvironment);
  eleventyConfig.setNunjucksEnvironmentOptions({
		throwOnUndefined: true,
	});
  

  // layouts
  const layoutsDir = path.join(templatesRoot, "layouts")
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

  const buildMode = isPreview
      ? 'preview'
      : isMaintenanceMode
        ? 'maintenance'
        : 'normal'

  const customerPagesRoot = path.join(eleventyConfig.directories.input, 'pages')
  for (const dir of fs.readdirSync(customerPagesRoot)) {
    const dirPath = path.join(customerPagesRoot, dir)
    if (!fs.statSync(dirPath).isDirectory()) continue

    for (const file of fs.readdirSync(dirPath)) {
      if (!file.endsWith('.njk')) continue

      if (shouldIgnoreTemplate({
        mode: buildMode,
        previewType: options.preview.documentType,
        dir,
        file,
        features
      })) {
        eleventyConfig.ignores.add(path.join(dirPath, file))
      }
    }
  }

  const corePagesRoot = path.join(templatesRoot, 'pages')
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
          previewType: options.preview.documentType,
          dir,
          file,
          features
        }) &&
        !fs.existsSync(customerPath)
      ) {
        eleventyConfig.addTemplate(`pages/${dir}/${file}`, fs.readFileSync(corePath, 'utf8'))
      }
    }
  }

  // 	--------------------- Passthrough copies ---------------------
  // keep directory
  [
    path.join(eleventyConfig.directories.input, 'assets/images/emailHeaderLogo.png'),
    path.join(eleventyConfig.directories.input, 'assets/images/ripple.png'),
    path.join(eleventyConfig.directories.input, 'assets/fonts/'),
  ].forEach(path => eleventyConfig.addPassthroughCopy(path));
  // favicons to root directory
  eleventyConfig.addPassthroughCopy({
    [path.join(eleventyConfig.directories.input, 'assets/images/favicon/*')]: '/'
  });

  const localizedReferenceMaps = Object.assign({}, ...locales.map(locale => {
    return {[locale]: {}}
  }));

  // TODO: build hooks
  // !isPreview && eleventyConfig.on('eleventy.before', beforeBuild);
  // !isPreview && eleventyConfig.on('eleventy.after', afterBuild);

  // TODO: shortcodes, filters

  eleventyConfig.addGlobalData('placeholders', createImageSettings(isPreview, assetsRoot, eleventyConfig.directories.output, options.imagePlaceholders));

  const sanityClient = createSanityClient({...options.sanity, apiVersion: sanityApiVersion});
  const imageBuilder = createImageBuilder(sanityClient);
  const imageUrls = (image, options) => {
      return sanityImageUrls(imageBuilder, image, options);
    }
  const media = {
    imageUrls,
    imageSeo: (image, alt) => sanityImageSeo(imageUrls, image, alt),
    imageSchema: (image) => sanityImageSchema(imageUrls, image),
    imagePreload: (image, pictureSize) => sanityImagePreload(imageUrls, image, pictureSize),
    replaceableImageUrl: (image, placeholder) => sanityReplaceableImageUrl(imageUrls, image, placeholder),
    pictureFromData,
    sanityPicture: (params) => sanityPicture({...params, imageUrls}),
    placeholderPicture: (params) => ""
  }
  Object.keys(media).forEach(key => {
    eleventyConfig.addFilter(key, media[key]);
    eleventyConfig.addShortcode(key, media[key]);
  })
  
  eleventyConfig.addGlobalData('helpers', {
    sanityImagePreload: media.imagePreload,
  });
  const queryOptions = options.queryOptions || {};

  eleventyConfig.addGlobalData('cms', async () => cms({
    locales,
    defaultLocale,
    build: {
      mode: buildMode,
      baseUrl: options.baseUrl,
      languageMap,
      previewDocumentType: options.preview.documentType,
      previewDocumentId: options.preview.documentId,
      previewLocale: options.preview.locale,
      studioUrl: options.sanity.studioUrl,
      maxProducts: options.maxProducts
    },
    localizedReferenceMaps,
    helpers: {
      localizers,
      media,
    },
    client: sanityClient,
    features,
    queryOptions,
    overrideFragments: options.fragments,
    overrideModules: options.modules,
    aggregate: options.aggregate
  }));

  // eleventyConfig.addShortcode("priceData", priceData)
  // eleventyConfig.addNunjucksGlobal("priceData", priceData)
}

function shouldIgnoreTemplate({
  mode,          // 'preview' | 'maintenance' | 'normal'
  previewType,   // 'page' | 'post'
  dir,
  file,
  features
}) {
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
    if (file.startsWith('user-') && !features.users) return true
    if ((file === 'products.njk' || (file === 'categories.njk')) && !features.products) return true
    if ((file === 'checkout.njk' || (file === 'order-thanks.njk')) && !features.checkout) return true
    if (file.startsWith('blog-') && !features.blog) return true
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
