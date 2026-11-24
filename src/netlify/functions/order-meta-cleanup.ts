/**
 * Deletes `orderMeta` documents (checkout snapshots written before payment) that were not updated
 * for `ORDER_META_RETENTION_DAYS`. Paid ones are already copied into their `order`; unpaid ones are
 * abandoned checkouts. The privacy policy states this period.
 *
 * Usage in customer project (netlify/functions/order_meta_cleanup.mts):
 *
 *   import type { Config } from '@netlify/functions'
 *   import { createOrderMetaCleanupHandler } from '@itsapps/itsshops-core-front/functions/order-meta-cleanup'
 *   export const config: Config = { schedule: '@daily' }
 *   export default createOrderMetaCleanupHandler()
 */
import { log } from '../utils/logger'
import { deleteOrderMetaUpdatedBefore } from '../services/sanity'
import { ORDER_META_RETENTION_DAYS } from '../../config/constants'

export function createOrderMetaCleanupHandler() {
  return async (): Promise<Response> => {
    const cutoff = new Date(Date.now() - ORDER_META_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
    try {
      const deleted = await deleteOrderMetaUpdatedBefore(cutoff)
      log.info('OrderMeta cleanup done', { cutoff, deleted })
      return new Response(null, { status: 200 })
    } catch (err) {
      log.error('OrderMeta cleanup failed', { cutoff, error: err instanceof Error ? err.message : String(err) })
      return new Response(null, { status: 500 })
    }
  }
}
