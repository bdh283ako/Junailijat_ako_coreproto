import 'server-only'

import config from '@payload-config'
import { getPayload } from 'payload'

type UserIdentity = {
  id: number
  email?: string | null
  name?: string | null
  familyProfile?: unknown
}

type FamilyProfileData = {
  familyName: string
  area: string
  childrenSummary?: string
  bio?: string
}

export type FamilyDirectoryEntry = FamilyProfileData & {
  id: string
  updatedAt: string
  likedByMe: boolean
  likedMe: boolean
  isMutualMatch: boolean
  passedByMe: boolean
  matchChannelId: string
}

export type FamilyLikeState = {
  likedByMe: boolean
  likedMe: boolean
  isMutualMatch: boolean
  matchChannelId: string
}

export type ParticipationInput = {
  eventId: string
  eventTitle: string
  participantEmail: string
  participantName: string
  status: 'going' | 'interested'
}

export type ChatMessageInput = {
  channelId: string
  channelTitle: string
  senderEmail: string
  senderName: string
  body: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function relationId(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (isRecord(value) && (typeof value.id === 'string' || typeof value.id === 'number')) {
    return String(value.id)
  }
  return null
}

function profileData(value: unknown): FamilyProfileData | null {
  if (!isRecord(value) || typeof value.familyName !== 'string' || typeof value.area !== 'string') {
    return null
  }
  return {
    familyName: value.familyName,
    area: value.area,
    ...(typeof value.childrenSummary === 'string' ? { childrenSummary: value.childrenSummary } : {}),
    ...(typeof value.bio === 'string' ? { bio: value.bio } : {}),
  }
}

function familyChannelId(firstId: string, secondId: string): string {
  return `family:${[firstId, secondId].sort().join('__')}`
}

type UserDoc = { id: number | string; email?: unknown; providerId?: unknown; familyProfile?: unknown }

function isMoreCanonicalUser(a: UserDoc, b: UserDoc): boolean {
  const aReal = typeof a.providerId === 'string' && !a.providerId.startsWith('legacy-demo:')
  const bReal = typeof b.providerId === 'string' && !b.providerId.startsWith('legacy-demo:')
  if (aReal !== bReal) return aReal
  const aProfile = profileData(a.familyProfile) ? 1 : 0
  const bProfile = profileData(b.familyProfile) ? 1 : 0
  if (aProfile !== bProfile) return aProfile > bProfile
  return Number(a.id) < Number(b.id)
}

async function findPair(payload: Awaited<ReturnType<typeof getPayload>>, fromId: number, toId: number) {
  const result = await payload.find({
    collection: 'family-matches',
    where: {
      and: [{ fromFamily: { equals: fromId } }, { toFamily: { equals: toId } }],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs[0] ?? null
}

export async function listFamiliesForUser(viewer: UserIdentity): Promise<FamilyDirectoryEntry[]> {
  const payload = await getPayload({ config })
  const [users, matches] = await Promise.all([
    payload.find({
      collection: 'users',
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'family-matches',
      where: {
        or: [
          { fromFamily: { equals: viewer.id } },
          { toFamily: { equals: viewer.id } },
        ],
      },
      limit: 2000,
      depth: 0,
      overrideAccess: true,
    }),
  ])
  const viewerId = String(viewer.id)
  const matchByPair = new Map<string, string>()
  for (const match of matches.docs) {
    const from = relationId(match.fromFamily)
    const to = relationId(match.toFamily)
    if (from && to) matchByPair.set(`${from}__${to}`, match.status)
  }

  // Yksi perhe (sähköposti) näkyy pakassa vain kerran, vaikka tietokannassa
  // olisi vahingossa duplikaattitilejä (esim. legacy-demo + Google).
  // Kanoninen tili: mieluiten oikea (ei legacy-demo) providerId, sitten
  // profiilin omaava, sitten pienin id.
  const canonicalByEmail = new Map<string, (typeof users.docs)[number]>()
  for (const user of users.docs) {
    const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : ''
    const key = email || `id:${String(user.id)}`
    const current = canonicalByEmail.get(key)
    if (!current || isMoreCanonicalUser(user, current)) canonicalByEmail.set(key, user)
  }
  const dedupedUsers = [...canonicalByEmail.values()]

  return dedupedUsers.flatMap((user) => {
    const targetId = String(user.id)
    const profile = profileData(user.familyProfile)
    if (targetId === viewerId || !profile) return []

    const outgoing = matchByPair.get(`${viewerId}__${targetId}`)
    const incoming = matchByPair.get(`${targetId}__${viewerId}`)
    const likedByMe = outgoing === 'liked' || outgoing === 'matched'
    const likedMe = incoming === 'liked' || incoming === 'matched'
    const isMutualMatch = outgoing === 'matched' && incoming === 'matched'

    return [
      {
        id: targetId,
        ...profile,
        updatedAt: user.updatedAt,
        likedByMe,
        likedMe,
        isMutualMatch,
        passedByMe: outgoing === 'passed',
        matchChannelId: familyChannelId(viewerId, targetId),
      },
    ]
  })
}

export async function toggleFamilyLike(
  viewer: UserIdentity,
  targetUserId: string,
): Promise<FamilyLikeState> {
  const payload = await getPayload({ config })
  const fromId = viewer.id
  const toId = Number(targetUserId)
  if (!Number.isSafeInteger(toId) || toId <= 0 || fromId === toId) {
    throw new Error('Tykkäyksen lähettäjän ja vastaanottajan tulee olla eri käyttäjiä.')
  }

  const target = await payload.findByID({
    collection: 'users',
    id: toId,
    depth: 0,
    overrideAccess: true,
  })
  if (!profileData(target.familyProfile)) {
    throw new Error('Tykkäyksen kohteen perheprofiilia ei löydy.')
  }

  const [outgoing, incoming] = await Promise.all([
    findPair(payload, fromId, toId),
    findPair(payload, toId, fromId),
  ])

  if (outgoing && (outgoing.status === 'liked' || outgoing.status === 'matched')) {
    await payload.delete({
      collection: 'family-matches',
      id: outgoing.id,
      overrideAccess: true,
    })
    if (incoming?.status === 'matched') {
      await payload.update({
        collection: 'family-matches',
        id: incoming.id,
        data: { status: 'liked' },
        overrideAccess: true,
      })
    }
  } else if (incoming && (incoming.status === 'liked' || incoming.status === 'matched')) {
    if (outgoing) {
      await payload.update({
        collection: 'family-matches',
        id: outgoing.id,
        data: { status: 'matched' },
        overrideAccess: true,
      })
    } else {
      await payload.create({
        collection: 'family-matches',
        data: { fromFamily: fromId, toFamily: toId, status: 'matched' },
        overrideAccess: true,
      })
    }
    if (incoming.status !== 'matched') {
      await payload.update({
        collection: 'family-matches',
        id: incoming.id,
        data: { status: 'matched' },
        overrideAccess: true,
      })
    }
  } else if (outgoing) {
    await payload.update({
      collection: 'family-matches',
      id: outgoing.id,
      data: { status: 'liked' },
      overrideAccess: true,
    })
  } else {
    await payload.create({
      collection: 'family-matches',
      data: { fromFamily: fromId, toFamily: toId, status: 'liked' },
      overrideAccess: true,
    })
  }

  const [nextOutgoing, nextIncoming] = await Promise.all([
    findPair(payload, fromId, toId),
    findPair(payload, toId, fromId),
  ])
  const likedByMe = nextOutgoing?.status === 'liked' || nextOutgoing?.status === 'matched'
  const likedMe = nextIncoming?.status === 'liked' || nextIncoming?.status === 'matched'
  return {
    likedByMe,
    likedMe,
    isMutualMatch: nextOutgoing?.status === 'matched' && nextIncoming?.status === 'matched',
    matchChannelId: familyChannelId(String(fromId), String(toId)),
  }
}

export async function setFamilyMatchAction(
  viewer: UserIdentity,
  targetUserId: string,
  action: 'liked' | 'passed',
) {
  const payload = await getPayload({ config })
  const fromId = viewer.id
  const toId = Number(targetUserId)
  if (!Number.isSafeInteger(toId) || toId <= 0 || fromId === toId) {
    throw new Error('Virheellinen perheprofiili.')
  }
  const target = await payload.findByID({
    collection: 'users',
    id: toId,
    depth: 0,
    overrideAccess: true,
  })
  if (!profileData(target.familyProfile)) throw new Error('Perheprofiilia ei löydy.')

  const [outgoing, incoming] = await Promise.all([
    findPair(payload, fromId, toId),
    findPair(payload, toId, fromId),
  ])
  if (action === 'passed') {
    if (outgoing) {
      await payload.update({
        collection: 'family-matches',
        id: outgoing.id,
        data: { status: 'passed' },
        overrideAccess: true,
      })
    } else {
      await payload.create({
        collection: 'family-matches',
        data: { fromFamily: fromId, toFamily: toId, status: 'passed' },
        overrideAccess: true,
      })
    }
    return { match: false }
  }

  const mutual = incoming?.status === 'liked' || incoming?.status === 'matched'
  const nextStatus = mutual ? 'matched' : 'liked'
  if (outgoing) {
    await payload.update({
      collection: 'family-matches',
      id: outgoing.id,
      data: { status: nextStatus },
      overrideAccess: true,
    })
  } else {
    await payload.create({
      collection: 'family-matches',
      data: { fromFamily: fromId, toFamily: toId, status: nextStatus },
      overrideAccess: true,
    })
  }
  if (mutual && incoming?.status !== 'matched' && incoming) {
    await payload.update({
      collection: 'family-matches',
      id: incoming.id,
      data: { status: 'matched' },
      overrideAccess: true,
    })
  }
  return { match: mutual }
}

export async function resetPassedMatches(viewer: UserIdentity) {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'family-matches',
    where: {
      and: [
        { fromFamily: { equals: viewer.id } },
        { status: { equals: 'passed' } },
      ],
    },
    limit: 2000,
    depth: 0,
    overrideAccess: true,
  })
  await Promise.all(
    result.docs.map((match) =>
      payload.delete({
        collection: 'family-matches',
        id: match.id,
        overrideAccess: true,
      }),
    ),
  )
  return result.docs.length
}

export async function getParticipationSummary(
  participantEmail: string,
  eventIds?: readonly string[],
) {
  const payload = await getPayload({ config })
  const normalizedEmail = participantEmail.trim().toLowerCase()
  const eventFilter = eventIds?.length ? [{ eventId: { in: [...eventIds] } }] : []
  const [own, allGoing] = await Promise.all([
    payload.find({
      collection: 'event-participations',
      where: {
        and: [
          { participantEmail: { equals: normalizedEmail } },
          ...eventFilter,
        ],
      },
      limit: 5000,
      sort: '-updatedAt',
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'event-participations',
      where: {
        and: [
          { status: { equals: 'going' } },
          ...eventFilter,
        ],
      },
      limit: 5000,
      depth: 0,
      overrideAccess: true,
    }),
  ])
  const countsByEventId: Record<string, number> = Object.create(null) as Record<string, number>
  for (const participation of allGoing.docs) {
    countsByEventId[participation.eventId] = (countsByEventId[participation.eventId] ?? 0) + 1
  }
  return {
    docs: own.docs,
    joinedEventIds: Array.from(
      new Set(
        own.docs
          .filter((participation) => participation.status === 'going')
          .map((participation) => participation.eventId),
      ),
    ),
    countsByEventId,
  }
}

export async function upsertParticipation(input: ParticipationInput) {
  const payload = await getPayload({ config })
  const existing = await payload.find({
    collection: 'event-participations',
    where: {
      and: [
        { eventId: { equals: input.eventId } },
        { participantEmail: { equals: input.participantEmail } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs[0]) {
    return {
      doc: await payload.update({
        collection: 'event-participations',
        id: existing.docs[0].id,
        data: input,
        overrideAccess: true,
      }),
      created: false,
    }
  }
  return {
    doc: await payload.create({
      collection: 'event-participations',
      data: input,
      overrideAccess: true,
    }),
    created: true,
  }
}

export async function removeParticipation(eventId: string, participantEmail: string) {
  const payload = await getPayload({ config })
  const existing = await payload.find({
    collection: 'event-participations',
    where: {
      and: [
        { eventId: { equals: eventId } },
        { participantEmail: { equals: participantEmail.trim().toLowerCase() } },
      ],
    },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  await Promise.all(
    existing.docs.map((doc) =>
      payload.delete({
        collection: 'event-participations',
        id: doc.id,
        overrideAccess: true,
      }),
    ),
  )
  return existing.docs.length
}

async function authorizedChannelIds(viewer: UserIdentity): Promise<Set<string>> {
  const payload = await getPayload({ config })
  const email = viewer.email?.trim().toLowerCase()
  const [matches, participations] = await Promise.all([
    payload.find({
      collection: 'family-matches',
      where: {
        and: [
          { status: { equals: 'matched' } },
          {
            or: [
              { fromFamily: { equals: viewer.id } },
              { toFamily: { equals: viewer.id } },
            ],
          },
        ],
      },
      limit: 2000,
      depth: 0,
      overrideAccess: true,
    }),
    email
      ? payload.find({
          collection: 'event-participations',
          where: {
            and: [
              { participantEmail: { equals: email } },
              { status: { equals: 'going' } },
            ],
          },
          limit: 5000,
          depth: 0,
          overrideAccess: true,
        })
      : Promise.resolve({ docs: [] }),
  ])
  const viewerId = String(viewer.id)
  const channels = new Set<string>()
  for (const match of matches.docs) {
    const from = relationId(match.fromFamily)
    const to = relationId(match.toFamily)
    if (!from || !to) continue
    const otherId = from === viewerId ? to : to === viewerId ? from : null
    if (otherId) channels.add(familyChannelId(viewerId, otherId))
  }
  for (const participation of participations.docs) {
    channels.add(`event:${participation.eventId}`)
  }
  return channels
}

export async function canAccessChatChannel(viewer: UserIdentity, channelId: string) {
  return (await authorizedChannelIds(viewer)).has(channelId)
}

export async function listChatMessages(channelId: string) {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'chat-messages',
    where: { channelId: { equals: channelId } },
    sort: 'createdAt',
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs
}

export async function listChatChannels(viewer: UserIdentity) {
  const payload = await getPayload({ config })
  const allowed = await authorizedChannelIds(viewer)
  if (allowed.size === 0) return []
  const result = await payload.find({
    collection: 'chat-messages',
    where: { channelId: { in: [...allowed] } },
    sort: '-createdAt',
    limit: 5000,
    depth: 0,
    overrideAccess: true,
  })
  const channels = new Map<
    string,
    {
      channelId: string
      channelTitle: string
      lastMessage: string
      lastSenderName: string
      lastSenderEmail: string
      lastMessageAt: string
      messageCount: number
    }
  >()
  for (const message of [...result.docs].reverse()) {
    const summary = channels.get(message.channelId)
    if (summary) {
      summary.lastMessage = message.body
      summary.lastSenderName = message.senderName
      summary.lastSenderEmail = message.senderEmail
      summary.lastMessageAt = message.createdAt
      summary.messageCount += 1
    } else {
      channels.set(message.channelId, {
        channelId: message.channelId,
        channelTitle: message.channelTitle,
        lastMessage: message.body,
        lastSenderName: message.senderName,
        lastSenderEmail: message.senderEmail,
        lastMessageAt: message.createdAt,
        messageCount: 1,
      })
    }
  }
  return Array.from(channels.values()).sort((a, b) =>
    b.lastMessageAt.localeCompare(a.lastMessageAt),
  )
}

export async function appendChatMessage(input: ChatMessageInput) {
  const payload = await getPayload({ config })
  return payload.create({
    collection: 'chat-messages',
    data: input,
    overrideAccess: true,
  })
}
