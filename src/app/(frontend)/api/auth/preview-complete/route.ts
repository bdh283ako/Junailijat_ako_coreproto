import { cookies } from 'next/headers'
import { isPreviewOAuthPost, readPreviewOAuthCallback } from '@/lib/preview-oauth-server'
import {
  clearPreviewFlowCookies,
  exchangeGoogleCode,
  previewEnvironment,
  previewHeaders,
  previewOAuthStore,
  trustedPreviewOrigin,
} from '@/lib/preview-google-oauth'

function terminalResponse(status: number, headers = previewHeaders()) {
  for (const cookie of clearPreviewFlowCookies) {
    headers.append('set-cookie', cookie)
  }
  return new Response(null, { status, headers })
}

export async function POST(request: Request) {
  const headers = previewHeaders()
  const origin = trustedPreviewOrigin()
  if (!origin || !isPreviewOAuthPost(request, origin)) {
    return new Response(null, { status: 403, headers })
  }

  const params = readPreviewOAuthCallback(await request.json().catch(() => null))
  if (!params) return terminalResponse(400, headers)

  const cookieStore = await cookies()
  const handle = cookieStore.get('__Host-pv_handle')?.value
  const popupNonce = cookieStore.get('__Host-pv_nonce')?.value
  const state = params.get('state')
  const stateParts = state?.split('.') ?? []
  const callbackPath =
    stateParts.length === 5 ? Buffer.from(stateParts[4], 'base64url').toString('utf8') : ''
  if (!handle || stateParts.length !== 5 || callbackPath !== '/api/auth/preview-callback') {
    return terminalResponse(400, headers)
  }

  const verifier = previewOAuthStore.takeCallback(handle, stateParts[3], popupNonce)
  if (!verifier) return terminalResponse(410, headers)

  try {
    if (params.get('error')) throw new Error('Google authorization was denied')
    const code = params.get('code')
    const environment = previewEnvironment()
    if (!code || !environment) {
      throw new Error('Preview OAuth environment is unavailable')
    }
    const claims = await exchangeGoogleCode({
      code,
      verifier,
      redirectUri: environment.redirectUri,
      clientId: environment.clientId,
      clientSecret: environment.clientSecret,
    })
    if (!previewOAuthStore.complete(handle, claims)) {
      throw new Error('Preview OAuth transaction expired')
    }
    return terminalResponse(204, headers)
  } catch (error) {
    previewOAuthStore.fail(handle)
    console.error('[preview-oauth]', error instanceof Error ? error.message : 'Sign-in failed')
    return terminalResponse(410, headers)
  }
}
