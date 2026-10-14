export const sanityApiVersion = 'v2025-05-25';

/**
 * Days an `orderMeta` (checkout snapshot written before payment) is kept after its last update.
 * Deleted by the scheduled `order-meta-cleanup` function; stated in the privacy policy.
 */
export const ORDER_META_RETENTION_DAYS = 30
