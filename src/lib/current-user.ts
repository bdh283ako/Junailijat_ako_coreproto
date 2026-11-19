import 'server-only'

import { auth } from '@/auth'
import { findGoogleUser } from '@/lib/oauth-user'

export async function getCurrentUser() {
  const session = await auth()
  if (!session?.user.providerId) return null
  return findGoogleUser(session.user.providerId)
}
