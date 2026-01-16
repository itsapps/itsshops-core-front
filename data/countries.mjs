const countryOptions = [
  { title: { en: 'Austria', de: 'Österreich' }, value: 'AT', isDefault: true },
  { title: { en: 'Germany', de: 'Deutschland' }, value: 'DE' },
  { title: { en: 'Switzerland', de: 'Schweiz' }, value: 'CH' },
  { title: { en: 'Italy', de: 'Italien' }, value: 'IT' },
  { title: { en: 'Belgium', de: 'Belgien' }, value: 'BE' },
  { title: { en: 'Denmark', de: 'Dänemark' }, value: 'DK' },
  { title: { en: 'Spain', de: 'Spanien' }, value: 'ES' },
  { title: { en: 'Finland', de: 'Finnland' }, value: 'FI' },
  { title: { en: 'France', de: 'Frankreich' }, value: 'FR' },
  { title: { en: 'United Kingdom', de: 'Großbritannien' }, value: 'GB' },
  { title: { en: 'Ireland', de: 'Irland' }, value: 'IE' },
  { title: { en: 'Netherlands', de: 'Niederlande' }, value: 'NL' },
  { title: { en: 'Norway', de: 'Norwegen' }, value: 'NO' },
  { title: { en: 'Poland', de: 'Polen' }, value: 'PL' },
  { title: { en: 'Portugal', de: 'Portugal' }, value: 'PT' },
  { title: { en: 'Sweden', de: 'Schweden' }, value: 'SE' },
]
export const defaultCountry = countryOptions.find(c => c.isDefault) || countryOptions[0]
export const getSupportedCountry = (code, throwError=true) => {
  const supportedCountry = countryOptions.find(c => c.value === code);
  if (!supportedCountry && throwError) {
    throw new Error(`Shipping country ${code} not supported`);
  }
  return supportedCountry;
}