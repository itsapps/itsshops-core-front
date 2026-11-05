/**
 * `@itsapps/itsshops-core-front/functions/utils` — helpers for **customer** Netlify functions
 * (e.g. a customer-only form backend), so customers don't copy core code.
 *
 * Re-exports only: no new behaviour lives here. Importing it has no side effects — the Sanity
 * client is created on first use and needs `SANITY_PROJECT_ID` / `SANITY_DATASET` / `SANITY_TOKEN`.
 * `serverT` reads core's bundled translations only, not the customer's `translations` config.
 */
export { sanityClient, fetchEmailSettings } from '../services/sanity'
export { buildEmailShopSettings } from '../lib/email-settings'
export { renderSimpleEmail } from '../lib/simple-email'
export type { RenderSimpleEmailInput } from '../lib/simple-email'
export type { EmailShopSettings } from '../templates/email/types'
export { sendMail } from '../services/email'
export type { SendMailParams, SendMailResult } from '../services/email'
export { validateEmail } from '../../shared/validation'
export {
  normalizeEmail,
  prepareSubscription,
  confirmSubscription,
} from '../utils/newsletter-helper'
export { serverT } from '../utils/i18n'
export { success, badRequest, errorResponse, methodNotAllowed } from '../utils/response'
export { ErrorCode } from '../types/errors'
export { log } from '../utils/logger'
