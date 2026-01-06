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
  const registry = {
    image: image(),
    localeImage: localeImage(),
    customImage: customImage(),
    internalLink: internalLink(),
    youtube: youtube(),
    navPage: nav.navPage(),
    navLink: nav.navLink(),
    action: action({internalLink: internalLink()}),
    // column: column(),
    slide: slide({localeImage: localeImage()}),

    // those need a rebuild
    seo: seo({image: image()}),
    portableText: portableText({
      internalLink: internalLink(),
      customImage: customImage(),
      youtube: youtube(),
    }),
  };

  // 🔥 Allow override, addition or extension
  for (const key in overrides) {
    registry[key] =
      typeof overrides[key] === 'function'
        ? overrides[key](registry)
        : overrides[key];
  }

  // Rebuild fragments with dependencies
  registry.seo = seo({ image: registry.image });
  registry.portableText = portableText({
    internalLink: registry.internalLink,
    customImage: registry.customImage,
    youtube: registry.youtube
  })

  // registry.column = localizeFragment(registry.column, locales);
  // registry.slide = localizeFragment(registry.slide, locales);

  // navigation
  registry.subMenu = nav.subMenu({
    navPage: registry.navPage,
    navLink: registry.navLink,
  });

  registry.menuLinks = nav.menuLinks({
    navPage: registry.navPage,
    navLink: registry.navLink,
    subMenu: registry.subMenu,
  });


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
