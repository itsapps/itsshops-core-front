export type Locale = 'de' | 'en'

export interface ITSi18nDictValue<T = string> {
  [key: string]: T | undefined
}

// export type ITSi18nArray<T = string> = ITSi18nEntry<T>[]
export type LocalizedStringArray = Array<{ language: string; value?: string }> | undefined

export type PermalinkTranslations = {
  product?:     string
  category?:    string
  blog?:        string
  checkout?:    string
  orderThanks?: string
  account?:     string
  register?:    string
  recover?:     string
  login?:       string
}

/** Fixed (non-configurable) auth page path segments, keyed by locale. */
export type UserPaths = {
  userLogin:               string
  userRegistration:        string
  userRegistrationSuccess: string
  userConfirm:             string
  userConfirmSuccess:      string
  userRecover:             string
  userRecoverSuccess:      string
  userReset:               string
  userResetSuccess:        string
  userOrders:              string
}