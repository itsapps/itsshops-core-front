// Auth + CORS helpers for server-to-server endpoints called from the Sanity
// studio (e.g. refund, send mail). Uses a shared secret in `x-server-secret`
// and an origin allowlist driven by SERVER_FUNCTIONS_ALLOWED_ORIGINS
// (comma-separated). Both env vars are required at runtime; missing values
// fail closed.

const ALLOWED_HEADERS = 'content-type, x-server-secret, x-request-id'
const ALLOWED_METHODS = 'POST, OPTIONS'

function allowedOrigin(requestOrigin: string | null): string {
  if (!requestOrigin) return 'null'
  const allowlist = (process.env.SERVER_FUNCTIONS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean)
  return allowlist.includes(requestOrigin) ? requestOrigin : 'null'
}

export function corsHeaders(request: Request): Record<string, string> {
  const origin = allowedOrigin(request.headers.get('origin'))
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': ALLOWED_HEADERS,
    'access-control-allow-methods': ALLOWED_METHODS,
    'access-control-max-age': '86400',
    vary: 'origin',
  }
}

export function preflightResponse(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) })
}

export function withCors(response: Response, request: Request): Response {
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(corsHeaders(request))) {
    headers.set(key, value)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

// Returns null if the request is authorized; otherwise an error Response
// with the appropriate CORS headers already applied.
export function requireServerSecret(request: Request): Response | null {
  const expected = process.env.SERVER_FUNCTIONS_SECRET
  if (!expected) {
    return withCors(
      new Response(
        JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Server secret not configured' } }),
        { status: 500, headers: { 'content-type': 'application/json' } },
      ),
      request,
    )
  }
  const provided = request.headers.get('x-server-secret')
  if (provided !== expected) {
    return withCors(
      new Response(
        JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Invalid or missing server secret' } }),
        { status: 401, headers: { 'content-type': 'application/json' } },
      ),
      request,
    )
  }
  return null
}
