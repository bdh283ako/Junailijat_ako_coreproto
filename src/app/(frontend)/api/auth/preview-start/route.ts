import { cookies } from 'next/headers'
import { hasPreviewOAuthCsrf, isPreviewOAuthPost } from '@/lib/preview-oauth-server'
import {
  createGoogleAuthorizationUrl,
  previewEnvironment,
  previewHeaders,
  previewOAuthStore,
  trustedPreviewOrigin,
} from '@/lib/preview-google-oauth'

export async function POST(request: Request) {
  const headers = previewHeaders()
  const origin = trustedPreviewOrigin()
  if (!origin || !isPreviewOAuthPost(request, origin)) {
    return new Response(null, { status: 403, headers })
  }

  const body = (await request.json().catch(() => null)) as {
    secret?: unknown
    csrf?: unknown
  } | null
  const cookieStore = await cookies()
  const bootstrap = cookieStore.get('__Host-pv_bootstrap')?.value
  if (typeof body?.secret !== 'string' || !hasPreviewOAuthCsrf(bootstrap, body.csrf)) {
    return new Response(null, { status: 403, headers })
  }

  const environment = previewEnvironment()
  const transaction = environment ? previewOAuthStore.begin(body.secret) : null
  if (!environment || !transaction) {
    return new Response(null, { status: 503, headers })
  }

  headers.append(
    'set-cookie',
    `__Host-pv_handle=${body.secret}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=300`,
  )
  headers.append(
    'set-cookie',
    `__Host-pv_nonce=${transaction.nonce}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=300`,
  )
  headers.append(
    'set-cookie',
    '__Host-pv_bootstrap=; Max-Age=0; HttpOnly; Secure; Path=/; SameSite=Strict',
  )

  return Response.json(
    {
      authorizationUrl: createGoogleAuthorizationUrl({
        clientId: environment.clientId,
        redirectUri: environment.redirectUri,
        statePrefix: environment.statePrefix,
        nonce: transaction.nonce,
        verifier: transaction.verifier,
      }),
    },
    { headers },
  )
}
