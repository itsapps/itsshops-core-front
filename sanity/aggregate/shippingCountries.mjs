export function buildShippingCountries(
  s,
  locale,
  fragments,
  remove,
  getSupportedCountry,
  localizers,
  imageUrls,
  imageSeo,
  buildHook
) {
  const {
    getLocalizedValue,
  } = localizers;

  const country = getSupportedCountry(s.code);
  const shippingCountry = {
    title: getLocalizedValue(country, "title", locale),
    code: s.code,
    rates: (s.rates || []).map(r => {
      return {
        title: getLocalizedValue(r, "title", locale),
        amount: r.amount
      }
    }),
  }

  return {
    ...shippingCountry,
    ...buildHook && buildHook(s, { locale, localizers })
  }
}