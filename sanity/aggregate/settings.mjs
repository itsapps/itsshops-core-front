export function buildSetting(
  s,
  locale,
  fragments,
  remove,
  country,
  localizers,
  imageUrls,
  imageSeo,
  buildHook
) {
  const {
    getLocalizedValue,
  } = localizers;
  const setting = {
    siteTitle: getLocalizedValue(s, "siteTitle", locale) || "Kein Titel",
    siteDescription: getLocalizedValue(s, "siteDescription", locale) || "Keine Beschreibung",
    siteShortDescription: getLocalizedValue(s, "siteShortDescription", locale) || "Keine Kurzbeschreibung",
    companyName: getLocalizedValue(s, "companyName", locale) || "Kein Firmenname",
    companyOwner: s.companyOwner || '',
    companyPhone: s.companyPhone || '',
    companyStreet: s.companyStreet || 'Demostraße 1',
    companyZip: s.companyZip || '12345',
    companyCity: getLocalizedValue(s, "companyCity", locale) || "Stadt",
    companyCountry: getLocalizedValue(country, "title", locale) || "Land",
    companyCountryCode: country.value,
    companyState: s.companyState || 'Bundesland',
    companyEmail: s.companyEmail || 'demo@email.com',
    homeId: s.homeId,
    privacyId: s.privacyId,
    mainMenuIds: (s.mainMenuIds || []),
    footerMenuIds: (s.footerMenuIds || []),
    gtmID: s.gtmID || '',

    ...!('shopId' in remove) && {shopId: s.shopId},
  }

  return {
    ...setting,
    ...buildHook && buildHook(s, { locale, localizers })
  }
}