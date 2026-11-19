import { encode } from 'next-auth/jwt'
import { isPreviewOAuthPost } from '@/lib/preview-oauth-server'
import { previewHeaders, previewOAuthStore, trustedPreviewOrigin } from '@/lib/preview-google-oauth'
import { SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/session-cookie'

export async function POST(request: Request) {
  const headers = previewHeaders()
  const origin = trustedPreviewOrigin()
  if (!origin || !isPreviewOAuthPost(request, origin)) {
    return new Response(null, { status: 403, headers })
  }
  const body = (await request.json().catch(() => null)) as {
    secret?: unknown
  } | null
  if (typeof body?.secret !== 'string') {
    return new Response(null, { status: 400, headers })
  }

  const result = previewOAuthStore.consume(body.secret)
  if (result.status !== 'complete') {
    return new Response(null, {
      status: result.status === 'pending' ? 202 : 410,
      headers,
    })
  }
  if (!process.env.AUTH_SECRET) {
    return new Response(null, { status: 503, headers })
  }

  const token = await encode({
    token: result.result,
    secret: process.env.AUTH_SECRET,
    salt: SESSION_COOKIE,
    maxAge: SESSION_MAX_AGE,
  })
  headers.append(
    'set-cookie',
    [
      `${SESSION_COOKIE}=${token}`,
      `Max-Age=${SESSION_MAX_AGE}`,
      'Path=/',
      'HttpOnly',
      'Secure',
      'SameSite=None',
      'Partitioned',
    ].join('; '),
  )
  return new Response(null, { status: 204, headers })
}
