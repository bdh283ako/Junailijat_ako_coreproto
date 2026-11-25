import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'

export function GET(request: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin
  const logoutRedirect = new URL('/', origin).toString()
  redirect(`/api/admins/logout?redirect=${encodeURIComponent(logoutRedirect)}`)
}
