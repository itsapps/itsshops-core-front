export const endOfNextYear = `${new Date().getFullYear() + 1}-12-31`;

export const createSchemaOrg = (localizedReferenceMaps, baseUrl, languageMap, imageSchema) => new SchemaOrg(localizedReferenceMaps, baseUrl, languageMap, imageSchema);
export class SchemaOrg {
  context = {"@context": "https://schema.org/"};
  
  constructor(localizedReferenceMaps, baseUrl, languageMap, imageSchema) {
    this.localizedReferenceMaps = localizedReferenceMaps
    this.baseUrl = baseUrl
    this.languageMap = languageMap
    this.imageSchema = imageSchema
  }

  getSiteSettings(locale) {
    return this.localizedReferenceMaps[locale].siteSettings
  }

  getIsPartOf(name) {
    return {
      "@type": "WebSite",
      name,
      url: this.baseUrl
    }
  }

  getWebsiteSchema(locale, permalink, pageTitle) {
    const siteSettings = this.getSiteSettings(locale)
    return {
      ...this.context,
      "@graph": [
        {
          "@type": "WebSite",
          "@id": `${this.baseUrl}#website`,
          url: this.baseUrl,
          name: siteSettings.siteTitle,
        },
        {
          "@type": "WebPage",
          // "@id": `${this.baseUrl}#website`,
          url: `${this.baseUrl}${permalink}`,
          name: pageTitle,
          // description: [].concat(page.title, siteSettings.siteTitle).join(" | "),
          inLanguage: this.languageMap[locale].localeCode,
          isPartOf: {
            "@id": `${this.baseUrl}#website`
          }
        },
      ]
    }
  }

  getOnlineStoreSchema(locale) {
    const siteSettings = this.getSiteSettings(locale)
    const referenceMaps = this.localizedReferenceMaps[locale]
    const shippingCountries = referenceMaps.shippingCountries

    return {
      ...this.context,
      "@type": "OnlineStore",
      name: siteSettings.siteTitle,
      description: siteSettings.siteDescription,
      url: this.baseUrl,
      // logo: this.baseUrl + siteSettings.logo.url
      address: {
        "@type": "PostalAddress",
        addressCountry: 'AT',
        addressLocality: siteSettings.companyCity,
        postalCode: siteSettings.companyZip,
        streetAddress: siteSettings.companyStreet,
        addressRegion: siteSettings.companyState
      },
      contactPoint: {
        contactType: "Customer Service",
        email: siteSettings.companyEmail
      },
      hasShippingService: {
        "@type": "ShippingService",
        name: shippingCountries.map(c => c.title).join(", "),
        fulfillmentType: "FulfillmentTypeDelivery",
        shippingConditions: shippingCountries.map(country => {
          return country.rates.map(rate => {
            return {
              "@type": "ShippingConditions",
              shippingOrigin: {
                "@type": "DefinedRegion",
                addressCountry: "AT"
              },
              shippingDestination: {
                "@type": "DefinedRegion",
                name: country.title,
                addressCountry: country.code
              },
              shippingRate: {
                "@type": "MonetaryAmount",
                name: rate.title,
                value: `${rate.amount / 100}`,
                currency: "EUR"
              }
            }  
          })
        }).flat()
      }
    }  
  }

  getProductBase(product) {
    const locale = product.locale
    const referenceMaps = this.localizedReferenceMaps[locale]
    const offerProducts = (product.otherVariantIds ? [...product.otherVariantIds, product._id] : [product._id]).map(variantId => referenceMaps.product[variantId]).filter(Boolean);

    return {
      "@type": "Product",
      name: product.titleWithOptions,
      url: `${this.baseUrl}${product.permalink}`,
      ...product.images.length > 0 && { image: this.imageSchema(product.images[0]) },
      offers: offerProducts.map(v => {
        return {
          "@type": "Offer",
          url: `${this.baseUrl}${v.permalink}`,
          name: v.optionsString || v.title,
          sku: v.productNumber,
          priceCurrency: "EUR",
          price: `${v.price / 100}`,
          priceValidUntil: endOfNextYear,
          availability: v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
        }
      })
    }
  }
  getProductSchema(product) {
    const locale = product.locale
    const referenceMaps = this.localizedReferenceMaps[locale]
    const manufacturer = product.manufacturerId ? referenceMaps.manufacturer[product.manufacturerId] : undefined;
    const tags = (product.tagIds || []).map(tagId => referenceMaps.tag[tagId]);
    const categories = (product.categoryIds || []).map(categoryId => referenceMaps.category[categoryId]);
    const offerProducts = (product.otherVariantIds ? [...product.otherVariantIds, product._id] : [product._id]).map(variantId => referenceMaps.product[variantId]).filter(Boolean);

    return {
      ...this.context,
      "@type": "Product",
      name: product.titleWithOptions,
      sku: product.productNumber,
      url: `${this.baseUrl}${product.permalink}`,
      ...product.images.length > 0 && { image: this.imageSchema(product.images[0]) },
      ...product.shareDescription && { description: product.shareDescription },
      ...manufacturer && {
        brand: {
          "@type": "Brand",
          name: manufacturer.title
        }
      },
      ...product.seoKeywords && { keywords: product.seoKeywords },
      ...tags.length > 0 && {
        additionalProperty: tags.map(tag => ({
          "@type": "PropertyValue",
          name: "Tag",
          value: tag.title
        }))
      },
      ...categories.length > 0 && { categories: categories.map(category => category.title) },
      offers: offerProducts.map(v => {
        return {
          "@type": "Offer",
          url: `${this.baseUrl}${v.permalink}`,
          name: v.optionsString || v.title,
          sku: v.productNumber,
          priceCurrency: "EUR",
          price: `${v.price / 100}`,
          priceValidUntil: endOfNextYear,
          availability: v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
        }
      })
    }
  }
  getCategorySchema(category) {
    const locale = category.locale
    const referenceMaps = this.localizedReferenceMaps[locale]

    return {
      ...this.context,
      "@type": "ItemList",
      name: category.shareTitle,
      ...category.shareDescription && { description: category.shareDescription },
      numberOfItems: category.productIds.length,
      itemListElement: category.productIds.map((pId, i) => {
        const p = referenceMaps.product[pId]
        return this.getProductBase(p)
      })
    }
  }

  getPageSchema(page) {
    const locale = page.locale
    const siteSettings = this.getSiteSettings(locale)

    return {
      ...this.context,
      "@type": "WebPage",
      "url": `${this.baseUrl}${page.permalink}`,
      ...page.images.length > 0 && { image: this.imageSchema(page.images[0]) },
      description: page.shareDescription ?? siteSettings.siteDescription,
      "inLanguage": this.languageMap[locale].localeCode,
      name: page.title,
      isPartOf: this.getIsPartOf(siteSettings.siteTitle),
    }
  }

  getPostSchema(post) {
    const locale = post.locale
    const siteSettings = this.getSiteSettings(locale)
    return {
      ...this.context,
      "@type": "BlogPosting",
      url: `${this.baseUrl}${post.permalink}`,
      ...post.image && { image: this.imageSchema(post.image) },
      description: post.shareDescription ?? siteSettings.siteDescription,
      headline: post.title,
      author: siteSettings.companyName,
      inLanguage: this.languageMap[locale].localeCode,
      name: post.title,
      isPartOf: this.getIsPartOf(siteSettings.siteTitle),
    }
  }
}
