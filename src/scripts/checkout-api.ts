import type {
  CalculateResponse,
  CreatePaymentResponse,
  CheckoutCartItem,
  AddressInput,
  ErrorResponse,
} from './checkout-types'

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

export class CheckoutApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, string>,
    public statusCode?: number,
  ) {
    super(message)
    this.name = 'CheckoutApiError'
  }
}

async function fetchWithRetry(
  url: string,
  body: PaymentCreateBody,
  retries = MAX_RETRIES,
): Promise<CalculateResponse | CreatePaymentResponse> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        const err = data as ErrorResponse
        throw new CheckoutApiError(
          err.error?.message ?? 'Request failed',
          err.error?.code ?? 'UNKNOWN',
          err.error?.details,
          response.status,
        )
      }

      return data as CalculateResponse | CreatePaymentResponse
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry client errors (4xx) or known API errors
      if (error instanceof CheckoutApiError && error.statusCode && error.statusCode < 500) {
        throw error
      }

      // Retry on network/server errors
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, BASE_DELAY * Math.pow(2, attempt - 1)))
      }
    }
  }

  throw lastError ?? new Error('Request failed after retries')
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
