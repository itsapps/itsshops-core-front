// core-front/sanity/moduleRegistry.mjs

export function createModuleRegistry({ fragments = {}, overrides = {} } = {}) {
  // Base modules
  const defaultModules = {
    hero: `
      _key,
      headline,
      "image": select(defined(image.asset) => image {${fragments.localeImage}}, null),
      "backgroundImage": select(defined(backgroundImage.asset) => backgroundImage {${fragments.localeImage}}, null),
      actions[]{ ${fragments.action} }
    `,
    multiColumns: `
      _type == 'multiColumns' => {
      _key,
      headline,
      "backgroundImage": select(defined(backgroundImage.asset) => backgroundImage {${fragments.localeImage}}, null),
      columns[]{ _key, ${fragments.column} }
    `,
    youtube: ({ fragments }) => `
      _type == 'youtube' => {
        _key,
        ${fragments.youtube}
      }
    `,
    productSection: ({ fragments }) => `
      _type == 'productSection' => {
        _key,
        headline,
        "categoryIds": categories[]._ref,
        totalProducts
      }
    `,
    carousel: ({ fragments }) => `
      _type == 'carousel' => {
        _key,
        slides[] { ${fragments.slides} },
        autoplay,
        autoplayDelay,
        loop,
        fade
      }
    `,
    categorySection: ({ fragments }) => `
      _type == 'categorySection' => {
        _key,
        headline,
        "categoryId": category->_id
      }
    `,
  };

  const modules = {...defaultModules, ...overrides}

  return {
    get(name) {
      if (!modules[name]) throw new Error(`Module ${name} not found in registry`)
      return modules[name]
    },
    getAll(names = []) {
      return names.map((name) => this.get(name))
    }
  }

  // Apply customer overrides
  // for (const key in overrides) {
  //   registry[key] =
  //     typeof overrides[key] === "function"
  //       ? overrides[key](registry)
  //       : overrides[key];
  // }

  // return {
  //   get(name, args) {
  //     if (!registry[name]) throw new Error(`Unknown module: ${name}`);
  //     return registry[name](args || {});
  //   },
  // };
}
