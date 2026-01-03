
export const ProductTypes = Object.freeze({
  SANITY_PRODUCT: 1,
  SANITY_PRODUCT_VARIANT: 2,
  SANITY_PRODUCT_BUNDLE: 3,
});

export const isVariantProduct = (productType) => {
  return productType == ProductTypes.SANITY_PRODUCT_VARIANT;
}

export const isSanityProduct = (productType) => {
  return productType == ProductTypes.SANITY_PRODUCT || productType == ProductTypes.SANITY_PRODUCT_VARIANT || productType == ProductTypes.SANITY_PRODUCT_BUNDLE;
}
export const isSanityVariant = (productType) => {
  return productType == ProductTypes.SANITY_PRODUCT_VARIANT;
}

export const isBundleProduct = (productType) => {
  return productType == ProductTypes.SANITY_PRODUCT_BUNDLE;
}