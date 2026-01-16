
export function buildMenu(
  m,
  locale,
  index,
  fragments,
  remove,
  localizedReferenceMaps,
  localizers,
  imageUrls,
  imageSeo,
  buildHook,
  buildFragment,
) {
  const {
    getLocalizedValue,
  } = localizers;
  
  const menu = {
    _id: m._id,
    title: getLocalizedValue(m, "title", locale),
    items: (m.items || []).map(i => {
      if (i._type == "navPage") {
        return {
          isSubMenu: false,
          title: getLocalizedValue(i, "title", locale),
          url: localizedReferenceMaps[locale].page[i.pageId].permalink,
          ...buildFragment && buildFragment(i, locale, localizers),
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
                url: localizedReferenceMaps[locale].page[ii.pageId].permalink,
                ...buildFragment && buildFragment(i, locale, localizers),
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
    ...buildHook && buildHook(m, { locale, localizers })
  }
}