import { slugifyString, getUniqueSlug } from "../../utils/slugify.mjs";

export function buildMenu(
  m,
  locale,
  index,
  fragments,
  remove,
  pageMapLocalized,
  localeUtils,
  translate,
  imageUrls,
  imageSeo,
  buildMenu,
  buildFragment,
) {
  const {
    getLocalizedValue,
    getLocalizedObject,
    getLocalizedImage,
    localizeMoney,
  } = localeUtils;
  
  const menu = {
    _id: m._id,
    title: getLocalizedValue(m, "title", locale),
    items: (m.items || []).map(i => {
      if (i._type == "navPage") {
        return {
          isSubMenu: false,
          title: getLocalizedValue(i, "title", locale),
          url: pageMapLocalized[locale][i.pageId].permalink,
          ...buildFragment && buildFragment(i, locale, localeUtils),
        }
        // return {
        //   isSubMenu: false,
        //   title: getLocalizedValue(i, "title", locale),
        //   url: pageMapLocalized[locale][i.pageId].permalink,
        //   leftImage: i.images?.left,
        //   rightImage: i.images?.right,
        //   imagePosition: i.images?.imagePosition || 'center',
        // }
      }
      else if (i._type == "navLink") {
        return {
          isSubMenu: false,
          title: getLocalizedValue(i, "title", locale),
          url: i.url,
        }
      }
      else if (i._type == "subMenu") {
        return {
          isSubMenu: true,
          title: getLocalizedValue(i, "title", locale),
          items: (i.items || []).map(ii => {
            if (ii._type == "navPage") {
              return {
                isSubMenu: false,
                title: getLocalizedValue(ii, "title", locale),
                url: pageMapLocalized[locale][ii.pageId].permalink,
                ...buildFragment && buildFragment(i, locale, localeUtils),
              }
            }
            else if (ii._type == "navLink") {
              return {
                isSubMenu: false,
                title: getLocalizedValue(ii, "title", locale),
                url: ii.url,
              }
            }
          })
        }
      }
    })
  }

  return {
    ...menu,
    ...buildMenu && buildMenu(m, { locale, localeUtils, translate })
  }
}