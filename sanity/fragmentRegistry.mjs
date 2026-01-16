import { image, localeImage, customImage } from './fragments/image.mjs';
import { portableText } from './fragments/portableText.mjs';
import seo from './fragments/seo.mjs';
import youtube from './fragments/youtube.mjs';
import {internalLink} from './fragments/internalLink.mjs';
import action from './fragments/action.mjs';
// import column from './fragments/column.mjs';
import slide from './fragments/slide.mjs';
import * as nav from './fragments/nav.mjs';

export function localizeFragment(fragment, locales) {
  return locales.map(locale => `${locale}[]{${fragment}}`).join(',');
}

export function createFragmentRegistry({
  locales,
  overrides = {},
}) {
  const fixedRegistry = {
    image: image(),
    localeImage: localeImage(),
    customImage: customImage(),
    seo: seo({image: image()}),
    subMenu: nav.subMenu(nav.navPage(), nav.navLink()),
  };
  const overrideRegistry = {
    internalLink: internalLink(),
    youtube: youtube(),
    navPage: nav.navPage(),
    navLink: nav.navLink(),
    action: action({internalLink: internalLink()}),
    // column: column(),
    slide: slide({localeImage: localeImage()}),

    // those need a rebuild
    portableText: portableText({
      internalLink: internalLink(),
      customImage: customImage(),
      youtube: youtube(),
    }),
  };

  // 🔥 Allow override, addition or extension
  for (const key in overrides) {
    overrideRegistry[key] =
      typeof overrides[key] === 'function'
        ? overrides[key]({...fixedRegistry, ...overrideRegistry})
        : overrides[key];
  }

  // Rebuild fragments with dependencies
  overrideRegistry.portableText = portableText({
    internalLink: overrideRegistry.internalLink,
    customImage: fixedRegistry.customImage,
    youtube: overrideRegistry.youtube
  })

  // registry.column = localizeFragment(registry.column, locales);
  // registry.slide = localizeFragment(registry.slide, locales);

  // navigation
  fixedRegistry.subMenu = nav.subMenu({
    navPage: overrideRegistry.navPage,
    navLink: overrideRegistry.navLink,
  });

  fixedRegistry.menuLinks = nav.menuLinks({
    navPage: overrideRegistry.navPage,
    navLink: overrideRegistry.navLink,
    subMenu: fixedRegistry.subMenu,
  });

  const registry = {
    ...fixedRegistry,
    ...overrideRegistry,
  };
  return {
    get(name) {
      if (!registry[name]) {
        throw new Error(`Unknown fragment: ${name}`);
      }
      return registry[name];
    },
    localize(name) {
      return localizeFragment(registry[name], locales);
    }
  };
}
