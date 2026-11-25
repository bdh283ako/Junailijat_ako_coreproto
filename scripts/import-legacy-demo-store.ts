import { readFile } from 'node:fs/promises'
import path from 'node:path'
import config from '../src/payload.config'
import { getPayload } from 'payload'

type LegacyParticipation = {
  eventId: string
  eventTitle: string
  participantEmail: string
  participantName: string
  status: 'going' | 'interested'
}

type LegacyMessage = {
  id: string
  channelId: string
  channelTitle: string
  senderEmail: string
  senderName: string
  body: string
}

type LegacyFamily = {
  email: string
  familyName: string
  area: string
  childrenSummary?: string
  bio?: string
}

type LegacyLike = {
  fromEmail: string
  toEmail: string
}

type LegacyStore = {
  participations: LegacyParticipation[]
  messages: LegacyMessage[]
  families: LegacyFamily[]
  familyLikes: LegacyLike[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Legacy demo data contains an invalid ${key} field.`)
  }
  return value
}

function parseStore(value: unknown): LegacyStore {
  if (!isRecord(value)) throw new Error('Legacy demo data must be a JSON object.')
  const participations = value.participations
  const messages = value.messages
  const families = value.families ?? []
  const familyLikes = value.familyLikes ?? []
  if (
    !Array.isArray(participations) ||
    !Array.isArray(messages) ||
    !Array.isArray(families) ||
    !Array.isArray(familyLikes)
  ) {
    throw new Error('Legacy demo data has an invalid collection structure.')
  }

  return {
    participations: participations.map((item) => {
      if (!isRecord(item) || (item.status !== 'going' && item.status !== 'interested')) {
        throw new Error('Legacy demo data contains an invalid participation.')
      }
      return {
        eventId: requiredString(item, 'eventId'),
        eventTitle: requiredString(item, 'eventTitle'),
        participantEmail: requiredString(item, 'participantEmail').trim().toLowerCase(),
        participantName: requiredString(item, 'participantName'),
        status: item.status,
      }
    }),
    messages: messages.map((item) => {
      if (!isRecord(item)) throw new Error('Legacy demo data contains an invalid chat message.')
      return {
        id: requiredString(item, 'id'),
        channelId: requiredString(item, 'channelId'),
        channelTitle: requiredString(item, 'channelTitle'),
        senderEmail: requiredString(item, 'senderEmail').trim().toLowerCase(),
        senderName: requiredString(item, 'senderName'),
        body: requiredString(item, 'body'),
      }
    }),
    families: families.map((item) => {
      if (!isRecord(item)) throw new Error('Legacy demo data contains an invalid family profile.')
      const family: LegacyFamily = {
        email: requiredString(item, 'email').trim().toLowerCase(),
        familyName: requiredString(item, 'familyName'),
        area: requiredString(item, 'area'),
      }
      if (typeof item.childrenSummary === 'string') family.childrenSummary = item.childrenSummary
      if (typeof item.bio === 'string') family.bio = item.bio
      return family
    }),
    familyLikes: familyLikes.map((item) => {
      if (!isRecord(item)) throw new Error('Legacy demo data contains an invalid family like.')
      return {
        fromEmail: requiredString(item, 'fromEmail').trim().toLowerCase(),
        toEmail: requiredString(item, 'toEmail').trim().toLowerCase(),
      }
    }),
  }
}

async function main() {
  const sourcePath = path.resolve(process.cwd(), 'data', 'demo-store.json')
  let source: string
  try {
    source = await readFile(sourcePath, 'utf8')
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') {
      console.info('No legacy demo-store.json found; nothing to import.')
      return
    }
    throw error
  }

  const store = parseStore(JSON.parse(source) as unknown)
  const payload = await getPayload({ config })
  const counts = {
    demoProfiles: 0,
    participationsCreated: 0,
    participationsUpdated: 0,
    messagesCreated: 0,
    matchesCreated: 0,
    matchesUpdated: 0,
  }

  const userIds = new Map<string, number>()
  for (const family of store.families) {
    const providerId = `legacy-demo:${family.email}`
    const existing = await payload.find({
      collection: 'users',
      where: { providerId: { equals: providerId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const data = {
      providerId,
      email: family.email,
      name: family.familyName,
      familyProfile: {
        familyName: family.familyName,
        area: family.area,
        ...(family.childrenSummary ? { childrenSummary: family.childrenSummary } : {}),
        ...(family.bio ? { bio: family.bio } : {}),
      },
      isDemo: true,
    }
    const user = existing.docs[0]
      ? await payload.update({
          collection: 'users',
          id: existing.docs[0].id,
          data,
          overrideAccess: true,
        })
      : await payload.create({ collection: 'users', data, overrideAccess: true })
    userIds.set(family.email, user.id)
    counts.demoProfiles += 1
  }

  for (const like of store.familyLikes) {
    const fromFamily = userIds.get(like.fromEmail)
    const toFamily = userIds.get(like.toEmail)
    if (fromFamily === undefined || toFamily === undefined || fromFamily === toFamily) continue

    const [existing, reverse] = await Promise.all([
      payload.find({
        collection: 'family-matches',
        where: {
          and: [{ fromFamily: { equals: fromFamily } }, { toFamily: { equals: toFamily } }],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'family-matches',
        where: {
          and: [{ fromFamily: { equals: toFamily } }, { toFamily: { equals: fromFamily } }],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      }),
    ])
    const reverseDoc = reverse.docs[0]
    const status = reverseDoc ? 'matched' : 'liked'
    const current = existing.docs[0]
    if (current) {
      if (current.status !== status) {
        await payload.update({
          collection: 'family-matches',
          id: current.id,
          data: { status },
          overrideAccess: true,
        })
        counts.matchesUpdated += 1
      }
    } else {
      await payload.create({
        collection: 'family-matches',
        data: { fromFamily, toFamily, status },
        overrideAccess: true,
      })
      counts.matchesCreated += 1
    }
    if (reverseDoc && reverseDoc.status !== 'matched') {
      await payload.update({
        collection: 'family-matches',
        id: reverseDoc.id,
        data: { status: 'matched' },
        overrideAccess: true,
      })
      counts.matchesUpdated += 1
    }
  }

  for (const participation of store.participations) {
    const existing = await payload.find({
      collection: 'event-participations',
      where: {
        and: [
          { eventId: { equals: participation.eventId } },
          { participantEmail: { equals: participation.participantEmail } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs[0]) {
      await payload.update({
        collection: 'event-participations',
        id: existing.docs[0].id,
        data: participation,
        overrideAccess: true,
      })
      counts.participationsUpdated += 1
    } else {
      await payload.create({
        collection: 'event-participations',
        data: participation,
        overrideAccess: true,
      })
      counts.participationsCreated += 1
    }
  }

  for (const message of store.messages) {
    const existing = await payload.find({
      collection: 'chat-messages',
      where: { legacyId: { equals: message.id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs[0]) continue
    await payload.create({
      collection: 'chat-messages',
      data: {
        legacyId: message.id,
        channelId: message.channelId,
        channelTitle: message.channelTitle,
        senderEmail: message.senderEmail,
        senderName: message.senderName,
        body: message.body,
      },
      overrideAccess: true,
    })
    counts.messagesCreated += 1
  }

  console.info('Legacy demo data import finished:', counts)
  console.info('The source file was retained for verification:', sourcePath)
}

main().then(
  () => {
    process.exit(0)
  },
  (error: unknown) => {
    console.error('Legacy demo data import failed:', error)
    process.exit(1)
  },
)
