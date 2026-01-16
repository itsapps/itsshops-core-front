export type BrowserTranslations = Record<string, Record<string, string>>;
export type BrowserTranslationTemplateParams = Record<string, string | number>;

export const createTranslator = (translations: BrowserTranslations) => {
  /**
   * Translate a key using the provided translations and locale.
   * Supports dynamic template variables in the form {{variableName}}.
   */
  const locale = document.documentElement.lang;
  const t = (key: string, params: BrowserTranslationTemplateParams = {}): string => {
    const dict = translations[locale];
    if (!dict) {
      throw new Error(`No translations found for locale: ${locale}`);
    }

    const template = dict[key];
    if (!template) {
      throw new Error(`Missing translation key: ${key} for locale: ${locale}`);
    }

    return template.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
      if (params[varName] === undefined) {
        throw new Error(`Missing template parameter: ${varName} for key: ${key}`);
      }
      return String(params[varName]);
    });
  };

  return t;
};