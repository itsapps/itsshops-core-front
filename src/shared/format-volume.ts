/**
 * Format a volume stored in ml to a locale-aware display string in `unit` ("l", "cl" or "ml"):
 * 750 → "0,75l". Shared by the build (`formatVolume` filter) and the checkout functions (order
 * subtitles), so both write the same text.
 */
export function formatVolumeMl(ml: number, unit: string, locale = 'de'): string {
  let value: number
  switch (unit) {
    case 'l':  value = ml / 1000; break
    case 'cl': value = ml / 10;   break
    default:   value = ml
  }
  return `${new Intl.NumberFormat(locale).format(value)}${unit}`
}
