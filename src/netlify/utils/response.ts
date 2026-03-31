import { ErrorCode, type ErrorResponse } from '../types/errors'

const JSON_HEADERS = { 'content-type': 'application/json' } as const

export function success<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS })
}

export function validationError(
  code: ErrorCode,
  message: string,
  details?: Record<string, string>,
): Response {
  const body: ErrorResponse = { error: { code, message, ...(details && { details }) } }
  return new Response(JSON.stringify(body), { status: 400, headers: JSON_HEADERS })
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  status = 500,
): Response {
  const body: ErrorResponse = { error: { code, message } }
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

export function methodNotAllowed(): Response {
  return errorResponse(ErrorCode.INVALID_INPUT, 'Method not allowed', 405)
}

export function badRequest(message: string): Response {
  return errorResponse(ErrorCode.INVALID_INPUT, message, 400)
}
