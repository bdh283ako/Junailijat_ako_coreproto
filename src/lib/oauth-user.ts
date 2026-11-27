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

  // Sama sähköposti voi olla jo olemassa toisella providerId:llä
  // (esim. legacy-demo-siirron tili). Yhdistetään samaan käyttäjään
  // duplikaattitilin luomisen sijaan, jotta perhe/profiili ja
  // family-matches -rivit säilyvät ja käyttäjämätsi pysyy uniikkina.
  if (identity.email) {
    const normalizedEmail = identity.email.trim().toLowerCase()
    const byEmail = await payload.find({
      collection: 'users',
      where: { email: { equals: normalizedEmail } },
      limit: 1,
      overrideAccess: true,
    })
    const emailMatch = byEmail.docs[0]
    if (emailMatch) {
      return payload.update({
        collection: 'users',
        id: emailMatch.id,
        data,
        overrideAccess: true,
      })
    }
  }

  return payload.create({
    collection: 'users',
    data,
    overrideAccess: true,
  })
}
