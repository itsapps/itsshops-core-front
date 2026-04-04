import type {
  CalculateResponse,
  CreatePaymentResponse,
  CheckoutCartItem,
  AddressInput,
  ErrorResponse,
} from '../shared/checkout-api'

const MAX_RETRIES = 3
const BASE_DELAY = 500

type PaymentCreateBody = {
  cart: { items: CheckoutCartItem[] }
  createPayment: boolean
  locale: string
  address?: {
    shipping: AddressInput
    billing?: AddressInput
    contactEmail: string
  }
  partialAddress?: { country: string }
  shippingMethodId?: string
  orderMetaId?: string
}

/**
 * Validation/business error — user can fix (bad input, stock exceeded, etc.)
 */
export class CheckoutValidationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, string>,
    public requestId?: string,
  ) {
    super(message)
    this.name = 'CheckoutValidationError'
  }
}

/**
 * IO/server error — user cannot fix (service down, 500, network failure).
 * Shows requestId so user can contact support.
 */
export class CheckoutIOError extends Error {
  constructor(
    message: string,
    public requestId?: string,
  ) {
    super(message)
    this.name = 'CheckoutIOError'
  }
}

function generateRequestId(): string {
  return crypto.randomUUID().replaceAll('-', '')
}

async function fetchWithRetry(
  url: string,
  body: PaymentCreateBody,
  retries = MAX_RETRIES,
): Promise<CalculateResponse | CreatePaymentResponse> {
  const requestId = generateRequestId()
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': requestId,
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        const err = data as ErrorResponse
        const serverRequestId = err.requestId ?? requestId

        if (response.status >= 500) {
          throw new CheckoutIOError(
            err.error?.message ?? 'Server error',
            serverRequestId,
          )
        }

        throw new CheckoutValidationError(
          err.error?.message ?? 'Request failed',
          err.error?.code ?? 'UNKNOWN',
          err.error?.details,
          serverRequestId,
        )
      }

      return data as CalculateResponse | CreatePaymentResponse
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry validation errors — user needs to fix
      if (error instanceof CheckoutValidationError) {
        throw error
      }

      // Retry IO/network errors
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, BASE_DELAY * Math.pow(2, attempt - 1)))
      }
    }
  }

  // All retries exhausted — IO error
  if (lastError instanceof CheckoutIOError) throw lastError
  throw new CheckoutIOError(lastError?.message ?? 'Request failed after retries', requestId)
}

export function calculatePayment(
  apiUrl: string,
  items: CheckoutCartItem[],
  locale: string,
  options: {
    country?: string
    shippingMethodId?: string
  } = {},
): Promise<CalculateResponse> {
  return fetchWithRetry(apiUrl, {
    cart: { items },
    createPayment: false,
    locale,
    ...(options.country && { partialAddress: { country: options.country } }),
    ...(options.shippingMethodId && { shippingMethodId: options.shippingMethodId }),
  }) as Promise<CalculateResponse>
}

export function createPayment(
  apiUrl: string,
  items: CheckoutCartItem[],
  locale: string,
  address: {
    shipping: AddressInput
    billing?: AddressInput
    contactEmail: string
  },
  options: {
    shippingMethodId?: string
    orderMetaId?: string
  } = {},
): Promise<CreatePaymentResponse> {
  return fetchWithRetry(apiUrl, {
    cart: { items },
    createPayment: true,
    locale,
    address,
    ...(options.shippingMethodId && { shippingMethodId: options.shippingMethodId }),
    ...(options.orderMetaId && { orderMetaId: options.orderMetaId }),
  }) as Promise<CreatePaymentResponse>
}
