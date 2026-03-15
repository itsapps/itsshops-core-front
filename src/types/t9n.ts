export type TranslatorParams = Record<string, string | number | boolean>

export type TranslatorFunction = (
  key: string,
  params?: TranslatorParams,
  locale?: string,
) => string
