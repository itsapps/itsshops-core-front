export type PriceFormatOptions = {
  locale?: string
  currency: string
  /** When set, prices render as "12,00 <label>" instead of the Intl currency format. */
  currencyLabel?: string
}

/**
 * Returns a cents → display string formatter (cart, checkout, search, order thanks).
 * The Intl.NumberFormat instance is created once and reused.
 */
export function createPriceFormatter({ locale, currency, currencyLabel }: PriceFormatOptions): (cents: number) => string {
  if (currencyLabel) {
    const nf = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return (cents) => `${nf.format(cents / 100)} ${currencyLabel}`
  }
  const nf = new Intl.NumberFormat(locale, { style: 'currency', currency })
  return (cents) => nf.format(cents / 100)
}
