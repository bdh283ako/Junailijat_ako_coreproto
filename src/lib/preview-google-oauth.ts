import 'server-only'

import { createHash } from 'node:crypto'
import type { JWT } from 'next-auth/jwt'
import { syncGoogleUser } from '@/lib/oauth-user'
import { createPreviewOAuthStore } from '@/lib/preview-oauth-server'

declare global {
  var gatherPreviewOAuthStore: ReturnType<typeof createPreviewOAuthStore<JWT>> | undefined
}

export const previewOAuthStore =
  globalThis.gatherPreviewOAuthStore ?? createPreviewOAuthStore<JWT>()

globalThis.gatherPreviewOAuthStore = previewOAuthStore

export const previewHeaders = () =>
  new Headers({
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
  })

export function trustedPreviewOrigin(): string | null {
  const value = process.env.NEXT_PUBLIC_SITE_URL
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

export function previewEnvironment() {
  const redirectUri = process.env.FIGMA_PREVIEW_OAUTH_REDIRECT_URI
  const statePrefix = process.env.FIGMA_PREVIEW_OAUTH_STATE_PREFIX
  const clientId = process.env.AUTH_GOOGLE_ID
  const clientSecret = process.env.AUTH_GOOGLE_SECRET
  if (!redirectUri || !statePrefix || !clientId || !clientSecret) return null

  try {
    const payload = JSON.parse(
      Buffer.from(statePrefix.split('.')[1] ?? '', 'base64url').toString('utf8'),
    ) as { exp?: unknown }
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now() + 5 * 60_000) {
      return null
    }
  } catch {
    return null
  }

  return { redirectUri, statePrefix, clientId, clientSecret }
}

export function createGoogleAuthorizationUrl({
  clientId,
  redirectUri,
  statePrefix,
  nonce,
  verifier,
}: {
  clientId: string
  redirectUri: string
  statePrefix: string
  nonce: string
  verifier: string
}) {
  const callbackPath = Buffer.from('/api/auth/preview-callback').toString('base64url')
  const state = [statePrefix, nonce, callbackPath].join('.')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString()
  return url.toString()
}

export async function exchangeGoogleCode({
  code,
  verifier,
  redirectUri,
  clientId,
  clientSecret,
}: {
  code: string
  verifier: string
  redirectUri: string
  clientId: string
  clientSecret: string
}): Promise<JWT> {
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
    cache: 'no-store',
  })
  const token = (await tokenResponse.json().catch(() => null)) as {
    access_token?: unknown
  } | null
  if (!tokenResponse.ok || typeof token?.access_token !== 'string') {
    throw new Error('Google token exchange failed')
  }

  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { authorization: `Bearer ${token.access_token}` },
    cache: 'no-store',
  })
  const profile = (await profileResponse.json().catch(() => null)) as {
    sub?: unknown
    email?: unknown
    name?: unknown
    picture?: unknown
  } | null
  if (!profileResponse.ok || typeof profile?.sub !== 'string') {
    throw new Error('Google identity lookup failed')
  }

  const identity = {
    sub: profile.sub,
    email: typeof profile.email === 'string' ? profile.email : null,
    name: typeof profile.name === 'string' ? profile.name : null,
    picture: typeof profile.picture === 'string' ? profile.picture : null,
  }
  const user = await syncGoogleUser(identity)
  return {
    sub: String(user.id),
    payloadUserId: String(user.id),
    providerId: identity.sub,
    name: identity.name,
    email: identity.email,
    picture: identity.picture,
  }
}

export const clearPreviewFlowCookies = [
  '__Host-pv_handle=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax',
  '__Host-pv_nonce=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax',
]
