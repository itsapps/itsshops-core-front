import { resolveFields } from './resolveFields.mjs';

const BASE_FIELDS = {
  siteTitle: 'siteTitle',
  siteDescription: 'siteDescription',
  siteShortDescription: 'siteShortDescription',
  companyName: 'companyName',
  companyOwner: 'companyOwner',
  companyPhone: 'companyPhone',
  companyStreet: 'companyStreet',
  companyZip: 'companyZip',
  companyCity: 'companyCity',
  companyCountry: 'companyCountry',
  companyState: 'companyState',
  companyEmail: 'companyEmail',
  homeId: '"homeId": home->_id',
  privacyId: '"privacyId": privacy->_id',
  mainMenuIds: '"mainMenuIds": mainMenus[]._ref',
  footerMenuIds: '"footerMenuIds": footerMenus[]._ref',
  gtmID: 'gtmID',
};
const OPTIONAL_FIELDS = {
  shopId: '"shopId": shop->_id',
};

export function buildSettingsQuery({fragments, options}) {
  const fields = resolveFields(
    BASE_FIELDS,
    OPTIONAL_FIELDS,
    options.queryOptions ?? {},
    { fragments }
  );
  
  return `
    *[_type == "generalSettings"][0] {
      ${fields.join(',')}
    }
  `;
}