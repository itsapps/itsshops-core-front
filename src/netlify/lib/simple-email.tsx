/**
 * Renders core's shared plain email (`SimpleEmail` inside the shop's `EmailLayout`) to HTML, for
 * mails built in **customer** functions (exported via `./functions/utils`), so they look like
 * core's own newsletter / account / withdrawal mails. Same context as `newsletter-notifier.tsx`:
 * `serverT` (core translations) for the layout's own strings, the shop settings for header/footer.
 */
import * as React from 'react'
import { render } from '@react-email/render'

import { SimpleEmail } from '../templates/email/SimpleEmail'
import type { EmailContext, EmailShopSettings, SimpleEmailProps } from '../templates/email/types'
import { formatPrice, serverT } from '../utils/i18n'

export type RenderSimpleEmailInput = Omit<SimpleEmailProps, 'ctx'> & {
  locale: string
  /** From `buildEmailShopSettings(await fetchEmailSettings(locale), baseUrl)`. */
  settings: EmailShopSettings
}

export async function renderSimpleEmail({
  locale,
  settings,
  ...props
}: RenderSimpleEmailInput): Promise<string> {
  const ctx: EmailContext = {
    locale,
    t: (key, params) => serverT(locale, key, params),
    formatPrice: (cents) => formatPrice(cents, locale),
    settings,
  }
  return render(<SimpleEmail ctx={ctx} {...props} />)
}
