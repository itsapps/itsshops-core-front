export const formatDate = (dateString, locale, dateStyle, timeStyle) => {
  const options = {
    dateStyle: dateStyle || 'long',
    ...timeStyle && {timeStyle},
  }
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(locale, options).format(date);
};

/**
 * @param {number} number 
 * @param {string} locale 
 * @returns {string}
 */
export const localizeMoney = (number, locale) => {
  return localizeNumber(number, locale, {
    style: "currency",
    currency: "EUR",
    currencyDisplay: 'symbol',
  });
};

/**
 * @param {number} number 
 * @param {string} locale
 * @param {Intl.NumberFormatOptions} options
 * @returns {string}
 */
export const localizeNumber = (number, locale, options={}) => {
  return (number).toLocaleString(locale, options);
};

/**
 * Get a localized value from an object attribute for a given locale.
 * Falls back to defaultLocale, or any other available locale if needed.
 *
 * @param {Object<string, any>} obj - The object containing the attribute
 * @param {string} attribute - The attribute name to fetch from the object
 * @param {string} locale - Desired locale code (e.g., "de", "en")
 * @param {string} [defaultLocale="de"] - Fallback locale if desired locale is missing
 * @returns {any | null} The localized string, or null if not found
 */
export const getLocalizedValue = (obj, attribute, locale, defaultLocale, supportedLocales) => {
  if (! obj) {
    return null;
  }
  const item = obj[attribute];
  if (! item) {
    return null;
  }
  // console.log("attr: " + attribute + " locale: " + locale + " obj: " + JSON.stringify(obj));
  if (locale in item) {
    return item[locale];
  } else if (defaultLocale in item) {
    return item[defaultLocale];
  } else {
    // find in other locales
    for (const key of supportedLocales) {
      if (key !== locale && key !== defaultLocale && item[key]) {
        return item[key];
      }
    }
  }
  return null;
}

/**
 * Get a localized object from a dictionary of locales.
 * Falls back to the defaultLocale, or any other available locale if needed.
 *
 * @param {Object<string, any>} obj - An object whose keys are locale codes (e.g., "de", "en") and values are objects
 * @param {string} locale - Desired locale code
 * @param {string} [defaultLocale="de"] - Fallback locale if the desired locale is missing
 * @returns {any | null} The localized object, or null if none found
 */
export const getLocalizedObject = (obj, locale, defaultLocale, supportedLocales) => {
  if (locale in obj && obj[locale]) {
    return obj[locale];
  } else if (defaultLocale in obj && obj[defaultLocale]) {
    return obj[defaultLocale];
  } else {
    // find in other locales
    for (const key of supportedLocales) {
      if (key !== locale && key !== defaultLocale && obj[key]) {
        return obj[key];
      }
    }
  }
  return null;
}

/**
 * Return a localized image object with `alt` and `title` for a given locale.
 *
 * @param {Object<string, any>} image - The original image object, may include fields like `alt`, `title`, `url`, etc.
 * @param {string} locale - Desired locale code (e.g., "de", "en")
 * @param {string} [defaultLocale="de"] - Fallback locale if desired locale is missing
 * @returns {Object<string, any>} The image object with localized `alt` and `title`
 */
export const getLocalizedImage = (image, locale, defaultLocale, supportedLocales) => {
  if (! image) {
    return undefined;
  }
  return {
    ...image,
    alt: getLocalizedValue(image, "alt", locale, defaultLocale, supportedLocales),
    title: getLocalizedValue(image, "title", locale, defaultLocale, supportedLocales),
  }
}