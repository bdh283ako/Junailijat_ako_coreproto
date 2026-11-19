import 'server-only'

import config from '@payload-config'
import { getPayload } from 'payload'

export type GoogleIdentity = {
  sub: string
  email?: string | null
  name?: string | null
  picture?: string | null
}

export async function findGoogleUser(providerId: string) {
  const payload = await getPayload({ config })
  const existing = await payload.find({
    collection: 'users',
    where: { providerId: { equals: providerId } },
    limit: 1,
    overrideAccess: true,
  })

  return existing.docs[0] ?? null
}

export async function syncGoogleUser(identity: GoogleIdentity) {
  const payload = await getPayload({ config })
  const existing = await findGoogleUser(identity.sub)

  const data = {
    providerId: identity.sub,
    email: identity.email || undefined,
    name: identity.name || undefined,
    avatarUrl: identity.picture || undefined,
  }

  if (existing) {
    return payload.update({
      collection: 'users',
      id: existing.id,
      data,
      overrideAccess: true,
    })
  }

  return payload.create({
    collection: 'users',
    data,
    overrideAccess: true,
  })
}
