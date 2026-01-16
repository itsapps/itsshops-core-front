export function localeFieldQuery(key, locales) {
  const query = `"${key}": {
    ${locales.map(locale => `"${locale}": ${key}[_key == "${locale}"][0].value`).join(',')}
  }`;

  return query
}