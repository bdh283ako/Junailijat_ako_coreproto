import { newPreviewOAuthSecret } from '@/lib/preview-oauth-server'
import { previewHeaders } from '@/lib/preview-google-oauth'

export function GET(request: Request) {
  const headers = previewHeaders()
  if (new URL(request.url).search) {
    return new Response(null, { status: 400, headers })
  }
  headers.append(
    'set-cookie',
    `__Host-pv_bootstrap=${newPreviewOAuthSecret()}; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=300`,
  )
  headers.set('location', '/api/auth/preview-signin/bridge')
  return new Response(null, { status: 303, headers })
}
