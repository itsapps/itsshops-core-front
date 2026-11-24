import { ErrorCode } from '../types/errors'

const JSON_HEADERS = { 'content-type': 'application/json' } as const

export function success<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS })
}

export function validationError(
  code: ErrorCode,
  message: string,
  requestId?: string,
  details?: Record<string, string>,
): Response {
  const body = {
    error: { code, message, ...details && { details } },
    ...requestId && { requestId },
  }
  return new Response(JSON.stringify(body), { status: 400, headers: JSON_HEADERS })
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  requestId?: string,
  status = 500,
): Response {
  const body = {
    error: { code, message },
    ...requestId && { requestId },
  }
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

export function methodNotAllowed(): Response {
  return errorResponse(ErrorCode.INVALID_INPUT, 'Method not allowed', undefined, 405)
}

export function badRequest(message: string): Response {
  return errorResponse(ErrorCode.INVALID_INPUT, message, undefined, 400)
}

export function unauthorized(code: ErrorCode, message: string, requestId?: string): Response {
  return errorResponse(code, message, requestId, 401)
}
