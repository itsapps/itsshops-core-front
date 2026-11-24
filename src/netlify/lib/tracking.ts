// Parcel tracking in the order mails: the order's `fulfillment.trackingCode` (the Studio field may
// hold several numbers, e.g. "123, 456") plus the shipping method's `trackingUrl` template
// (`https://…{code}…`), which turns each number into a link to the carrier's tracking page.

export type TrackingEntry = { code: string; url?: string }

/** The tracking numbers in a `trackingCode` value — split at commas, semicolons and whitespace. */
export function trackingCodes(raw: string | null | undefined): string[] {
  return (raw ?? '').split(/[\s,;]+/).filter(Boolean)
}

/**
 * Link for one tracking number: `{code}` in the template replaced by the URL-encoded number.
 * No link for a template that isn't `https://` or has no `{code}` placeholder.
 */
export function trackingLink(template: string | null | undefined, code: string): string | undefined {
  const t = template?.trim()
  if (!t || !t.startsWith('https://') || !t.includes('{code}')) return undefined
  return t.replaceAll('{code}', encodeURIComponent(code))
}

/** One entry per tracking number of a delivery order (none for pickup or without a number). */
export function trackingEntries(
  fulfillment: { methodType?: string; trackingCode?: string } | undefined,
  template: string | null | undefined,
): TrackingEntry[] {
  if (!fulfillment || fulfillment.methodType === 'pickup') return []
  return trackingCodes(fulfillment.trackingCode).map((code) => {
    const url = trackingLink(template, code)
    return url ? { code, url } : { code }
  })
}
