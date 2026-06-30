import {
  getSubscriberByEmail,
  getSubscriberByToken,
  createSubscriber,
  patchSubscriber,
  type NewsletterSubscriberStatus,
} from '../services/sanity'
import { log } from './logger'

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Prepare a (double opt-in) standalone subscription.
 *
 * - new / previously unsubscribed / still pending → ensure a `pending` record
 *   with a fresh token and signal the caller to send the confirmation email.
 * - already confirmed → no-op; the caller still returns a generic success so
 *   the endpoint never reveals whether an address is already subscribed.
 *
 * Returns the token to embed in the confirmation link when `send` is true.
 */
export async function prepareSubscription(
  rawEmail: string,
  locale: string,
): Promise<{ send: boolean; token: string }> {
  const email = normalizeEmail(rawEmail)
  const existing = await getSubscriberByEmail(email)

  if (existing?.status === 'confirmed') {
    return { send: false, token: existing.token }
  }

  const token = crypto.randomUUID()

  if (existing) {
    await patchSubscriber(existing._id, { status: 'pending', token, locale })
  } else {
    await createSubscriber({
      _type: 'newsletterSubscriber',
      email,
      locale,
      status: 'pending',
      source: 'standalone',
      token,
      createdAt: new Date().toISOString(),
    })
  }

  return { send: true, token }
}

/** Confirm a pending subscription via its token. Returns false if unknown/expired. */
export async function confirmSubscription(token: string): Promise<boolean> {
  const subscriber = await getSubscriberByToken(token)
  if (!subscriber) return false
  if (subscriber.status !== 'confirmed') {
    await patchSubscriber(subscriber._id, {
      status: 'confirmed',
      confirmedAt: new Date().toISOString(),
    })
  }
  return true
}

/** Unsubscribe via token. Returns false if the token is unknown. */
export async function unsubscribeByToken(token: string): Promise<boolean> {
  const subscriber = await getSubscriberByToken(token)
  if (!subscriber) return false
  if (subscriber.status !== 'unsubscribed') {
    await patchSubscriber(subscriber._id, { status: 'unsubscribed' })
  }
  return true
}

/**
 * Sync a registered user's newsletter opt-in into the subscriber list — the
 * single source of truth for "who receives the newsletter". Called from
 * `storeCustomer` after the account email is already confirmed, so opt-ins land
 * as `confirmed` without a second double-opt-in step. Failures are logged, not
 * thrown: the auth flow must not break on a newsletter write.
 *
 * Two independent concerns:
 *  - **Account link** (`supabaseId`): a factual association, written whenever an
 *    existing subscriber's email matches the account — regardless of `optIn`.
 *  - **Subscription status**: additive only. `optIn = true` subscribes/confirms;
 *    an unticked box (`optIn = false`) never subscribes *or* unsubscribes, so a
 *    standalone subscription (or one made before registering) is preserved.
 *    Unsubscribing happens only via the explicit unsubscribe link.
 */
export async function syncRegistrationOptIn(
  rawEmail: string,
  locale: string,
  supabaseId: string,
  optIn: boolean,
): Promise<void> {
  try {
    const email = normalizeEmail(rawEmail)
    const existing = await getSubscriberByEmail(email)

    if (existing) {
      const set: Partial<{ status: NewsletterSubscriberStatus; supabaseId: string; confirmedAt: string }> = {}
      // Link the account regardless of opt-in (factual association).
      if (existing.supabaseId !== supabaseId) set.supabaseId = supabaseId
      // Opt-in confirms; an unticked box never changes the status.
      if (optIn && existing.status !== 'confirmed') {
        set.status = 'confirmed'
        set.confirmedAt = new Date().toISOString()
      }
      if (Object.keys(set).length > 0) await patchSubscriber(existing._id, set)
      return
    }

    // No existing subscriber: only create one when they actually opted in.
    if (optIn) {
      await createSubscriber({
        _type: 'newsletterSubscriber',
        email,
        locale,
        status: 'confirmed',
        source: 'registration',
        token: crypto.randomUUID(),
        supabaseId,
        confirmedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      })
    }
  } catch (error) {
    log.error('syncRegistrationOptIn failed', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
