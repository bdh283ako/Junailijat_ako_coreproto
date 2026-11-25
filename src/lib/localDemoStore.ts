import 'server-only'

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

export interface ParticipationDoc {
  id: string
  eventId: string
  eventTitle: string
  participantEmail: string
  participantName: string
  status: 'going' | 'interested'
  createdAt: string
  updatedAt: string
}

export interface ChatMessageDoc {
  id: string
  channelId: string
  channelTitle: string
  senderEmail: string
  senderName: string
  body: string
  createdAt: string
  updatedAt: string
}

export interface DemoFamilyProfile {
  email: string
  familyName: string
  area: string
  childrenSummary?: string
  bio?: string
  updatedAt: string
}

export interface DemoFamilyLike {
  fromEmail: string
  toEmail: string
  createdAt: string
}

export interface DemoFamilyForUser extends DemoFamilyProfile {
  likedByMe: boolean
  likedMe: boolean
  isMutualMatch: boolean
  matchChannelId: string
}

interface DemoStore {
  participations: ParticipationDoc[]
  messages: ChatMessageDoc[]
  families: DemoFamilyProfile[]
  familyLikes: DemoFamilyLike[]
}

export interface ListParticipationsOptions {
  eventIds?: readonly string[]
  participantEmail?: string
}

export interface ParticipationSummary {
  docs: ParticipationDoc[]
  joinedEventIds: string[]
  countsByEventId: Record<string, number>
}

export interface ParticipationInput {
  eventId: string
  eventTitle: string
  participantEmail: string
  participantName: string
  status: 'going' | 'interested'
}

export interface UpsertParticipationResult {
  doc: ParticipationDoc
  created: boolean
}

export interface ChatMessageInput {
  channelId: string
  channelTitle: string
  senderEmail: string
  senderName: string
  body: string
}

export interface ChatChannelSummary {
  channelId: string
  channelTitle: string
  lastMessage: string
  lastSenderName: string
  lastSenderEmail: string
  lastMessageAt: string
  messageCount: number
}

export interface DemoFamilyProfileInput {
  email: string
  familyName: string
  area: string
  childrenSummary?: string
  bio?: string
  updatedAt?: string
}

export interface DemoFamilyLikeState {
  likedByMe: boolean
  likedMe: boolean
  isMutualMatch: boolean
  matchChannelId: string
}

const exampleFamilies: DemoFamilyProfile[] = [
  {
    email: 'demo.makela@example.test',
    familyName: 'Mäkelän perhe',
    area: 'Espoo',
    childrenSummary: 'Lapset 4–6 v',
    bio: 'Lähdemme mielellämme puistoon ja tapahtumiin.',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    email: 'demo.lindholm@example.test',
    familyName: 'Lindholmin perhe',
    area: 'Helsinki',
    childrenSummary: 'Lapset 0–3 v',
    bio: 'Etsimme lähialueelta leikkiseuraa.',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
]

const dataDirectory = path.join(process.cwd(), 'data')
const storePath = path.join(dataDirectory, 'demo-store.json')
let operationQueue: Promise<void> = Promise.resolve()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isParticipationDoc(value: unknown): value is ParticipationDoc {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.eventId === 'string' &&
    typeof value.eventTitle === 'string' &&
    typeof value.participantEmail === 'string' &&
    typeof value.participantName === 'string' &&
    (value.status === 'going' || value.status === 'interested') &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  )
}

function isChatMessageDoc(value: unknown): value is ChatMessageDoc {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.channelId === 'string' &&
    typeof value.channelTitle === 'string' &&
    typeof value.senderEmail === 'string' &&
    typeof value.senderName === 'string' &&
    typeof value.body === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  )
}

function isDemoFamilyProfile(value: unknown): value is DemoFamilyProfile {
  return (
    isRecord(value) &&
    typeof value.email === 'string' &&
    typeof value.familyName === 'string' &&
    typeof value.area === 'string' &&
    (value.childrenSummary === undefined || typeof value.childrenSummary === 'string') &&
    (value.bio === undefined || typeof value.bio === 'string') &&
    typeof value.updatedAt === 'string'
  )
}

function isDemoFamilyLike(value: unknown): value is DemoFamilyLike {
  return (
    isRecord(value) &&
    typeof value.fromEmail === 'string' &&
    typeof value.toEmail === 'string' &&
    typeof value.createdAt === 'string'
  )
}

function isMissingFileError(error: unknown): boolean {
  return isRecord(error) && error.code === 'ENOENT'
}

async function readStore(): Promise<DemoStore> {
  await mkdir(dataDirectory, { recursive: true })

  let contents: string
  try {
    contents = await readFile(storePath, 'utf8')
  } catch (error) {
    if (isMissingFileError(error)) {
      return { participations: [], messages: [], families: [], familyLikes: [] }
    }
    throw error
  }

  const parsed: unknown = JSON.parse(contents)
  if (
    !isRecord(parsed) ||
    !Array.isArray(parsed.participations) ||
    !Array.isArray(parsed.messages) ||
    !parsed.participations.every(isParticipationDoc) ||
    !parsed.messages.every(isChatMessageDoc) ||
    (parsed.families !== undefined &&
      (!Array.isArray(parsed.families) || !parsed.families.every(isDemoFamilyProfile))) ||
    (parsed.familyLikes !== undefined &&
      (!Array.isArray(parsed.familyLikes) || !parsed.familyLikes.every(isDemoFamilyLike)))
  ) {
    throw new Error(`Local demo store has an invalid format: ${storePath}`)
  }

  return {
    participations: parsed.participations,
    messages: parsed.messages,
    families: parsed.families ?? [],
    familyLikes: parsed.familyLikes ?? [],
  }
}

async function writeStore(store: DemoStore): Promise<void> {
  await mkdir(dataDirectory, { recursive: true })
  const temporaryPath = path.join(dataDirectory, `demo-store.${process.pid}.${randomUUID()}.tmp`)

  try {
    await writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    })
    await rename(temporaryPath, storePath)
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined)
    throw error
  }
}

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = operationQueue.then(operation)
  operationQueue = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

export function listParticipations(
  options: ListParticipationsOptions = {},
): Promise<ParticipationDoc[]> {
  return serialize(async () => {
    const store = await readStore()
    const eventIds = options.eventIds ? new Set(options.eventIds) : null
    const participantEmail = options.participantEmail?.trim().toLowerCase()

    return store.participations
      .filter(
        (participation) =>
          (!eventIds || eventIds.has(participation.eventId)) &&
          (!participantEmail ||
            participation.participantEmail.trim().toLowerCase() === participantEmail),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  })
}

export function getParticipationSummary(
  options: ListParticipationsOptions = {},
): Promise<ParticipationSummary> {
  return serialize(async () => {
    const store = await readStore()
    const eventIds = options.eventIds ? new Set(options.eventIds) : null
    const participantEmail = options.participantEmail?.trim().toLowerCase()
    const docs = store.participations
      .filter(
        (participation) =>
          (!eventIds || eventIds.has(participation.eventId)) &&
          (!participantEmail ||
            participation.participantEmail.trim().toLowerCase() === participantEmail),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

    const counts = new Map<string, number>()
    for (const participation of store.participations) {
      if (
        participation.status !== 'going' ||
        (eventIds !== null && !eventIds.has(participation.eventId))
      ) {
        continue
      }
      counts.set(participation.eventId, (counts.get(participation.eventId) ?? 0) + 1)
    }

    const joinedEventIds = participantEmail
      ? Array.from(
          new Set(
            docs
              .filter((participation) => participation.status === 'going')
              .map((participation) => participation.eventId),
          ),
        )
      : []

    return {
      docs,
      joinedEventIds,
      countsByEventId: Object.fromEntries(counts),
    }
  })
}

export function upsertParticipation(input: ParticipationInput): Promise<UpsertParticipationResult> {
  return serialize(async () => {
    const store = await readStore()
    const normalizedEmail = input.participantEmail.trim().toLowerCase()
    const now = new Date().toISOString()
    const existingIndex = store.participations.findIndex(
      (participation) =>
        participation.eventId === input.eventId &&
        participation.participantEmail.trim().toLowerCase() === normalizedEmail,
    )

    if (existingIndex >= 0) {
      const doc: ParticipationDoc = {
        ...store.participations[existingIndex],
        ...input,
        participantEmail: normalizedEmail,
        updatedAt: now,
      }
      store.participations[existingIndex] = doc
      await writeStore(store)
      return { doc, created: false }
    }

    const doc: ParticipationDoc = {
      id: randomUUID(),
      ...input,
      participantEmail: normalizedEmail,
      createdAt: now,
      updatedAt: now,
    }
    store.participations.push(doc)
    await writeStore(store)
    return { doc, created: true }
  })
}

export function removeParticipation(eventId: string, participantEmail: string): Promise<number> {
  return serialize(async () => {
    const store = await readStore()
    const normalizedEmail = participantEmail.trim().toLowerCase()
    const remaining = store.participations.filter(
      (participation) =>
        !(
          participation.eventId === eventId &&
          participation.participantEmail.trim().toLowerCase() === normalizedEmail
        ),
    )
    const deletedCount = store.participations.length - remaining.length

    if (deletedCount > 0) {
      store.participations = remaining
      await writeStore(store)
    }
    return deletedCount
  })
}

export function listChannelMessages(channelId: string): Promise<ChatMessageDoc[]> {
  return serialize(async () => {
    const store = await readStore()
    return store.messages
      .filter((message) => message.channelId === channelId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-200)
  })
}

export function listChannelsSummary(): Promise<ChatChannelSummary[]> {
  return serialize(async () => {
    const store = await readStore()
    const channels = new Map<string, ChatChannelSummary>()

    for (const message of [...store.messages].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    )) {
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
  })
}

export function appendChatMessage(input: ChatMessageInput): Promise<ChatMessageDoc> {
  return serialize(async () => {
    const store = await readStore()
    const now = new Date().toISOString()
    const message: ChatMessageDoc = {
      id: randomUUID(),
      ...input,
      senderEmail: input.senderEmail.trim().toLowerCase(),
      createdAt: now,
      updatedAt: now,
    }
    store.messages.push(message)
    await writeStore(store)
    return message
  })
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function matchChannelId(firstEmail: string, secondEmail: string): string {
  const [first, second] = [normalizeEmail(firstEmail), normalizeEmail(secondEmail)].sort()
  return `family:${first}__${second}`
}

function ensureExampleFamilies(store: DemoStore): boolean {
  if (store.families.length === 0) {
    store.families = exampleFamilies.map((family) => ({ ...family }))
    return true
  }
  return false
}

export function upsertFamilyProfile(input: DemoFamilyProfileInput): Promise<DemoFamilyProfile> {
  return serialize(async () => {
    const store = await readStore()
    ensureExampleFamilies(store)
    const email = normalizeEmail(input.email)
    const profile: DemoFamilyProfile = {
      email,
      familyName: input.familyName.trim(),
      area: input.area.trim(),
      ...(input.childrenSummary?.trim() ? { childrenSummary: input.childrenSummary.trim() } : {}),
      ...(input.bio?.trim() ? { bio: input.bio.trim() } : {}),
      updatedAt: new Date().toISOString(),
    }
    const existingIndex = store.families.findIndex((family) => family.email === email)
    if (existingIndex < 0) {
      store.families.push(profile)
    } else {
      store.families[existingIndex] = profile
    }
    await writeStore(store)
    return profile
  })
}

export function listFamiliesForUser(viewerEmail: string): Promise<DemoFamilyForUser[]> {
  return serialize(async () => {
    const store = await readStore()
    const seededExamples = ensureExampleFamilies(store)
    const viewer = normalizeEmail(viewerEmail)
    const families = store.families
      .filter((family) => family.email !== viewer)
      .map((family) => {
        const likedByMe = store.familyLikes.some(
          (like) => like.fromEmail === viewer && like.toEmail === family.email,
        )
        const likedMe = store.familyLikes.some(
          (like) => like.fromEmail === family.email && like.toEmail === viewer,
        )
        return {
          ...family,
          likedByMe,
          likedMe,
          isMutualMatch: likedByMe && likedMe,
          matchChannelId: matchChannelId(viewer, family.email),
        }
      })
    if (seededExamples) await writeStore(store)
    return families
  })
}

export function toggleFamilyLike(fromEmail: string, toEmail: string): Promise<DemoFamilyLikeState> {
  return serialize(async () => {
    const store = await readStore()
    ensureExampleFamilies(store)
    const from = normalizeEmail(fromEmail)
    const to = normalizeEmail(toEmail)
    if (!from || !to || from === to) {
      throw new Error('Tykkäyksen lähettäjän ja vastaanottajan tulee olla eri käyttäjiä.')
    }
    if (!store.families.some((family) => family.email === from)) {
      throw new Error('Tykkäyksen lähettäjän perheprofiilia ei löydy.')
    }
    if (!store.families.some((family) => family.email === to)) {
      throw new Error('Tykkäyksen kohteen perheprofiilia ei löydy.')
    }

    const existingIndex = store.familyLikes.findIndex(
      (like) => like.fromEmail === from && like.toEmail === to,
    )
    if (existingIndex >= 0) {
      store.familyLikes.splice(existingIndex, 1)
    } else {
      store.familyLikes.push({
        fromEmail: from,
        toEmail: to,
        createdAt: new Date().toISOString(),
      })
    }

    const likedByMe = store.familyLikes.some(
      (like) => like.fromEmail === from && like.toEmail === to,
    )
    const likedMe = store.familyLikes.some((like) => like.fromEmail === to && like.toEmail === from)
    await writeStore(store)
    return {
      likedByMe,
      likedMe,
      isMutualMatch: likedByMe && likedMe,
      matchChannelId: matchChannelId(from, to),
    }
  })
}
