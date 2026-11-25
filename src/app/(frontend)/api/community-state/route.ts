import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/current-user'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validString(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.length <= maximum
}

function isCommunityState(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false
  if (
    !Array.isArray(value.threads) ||
    value.threads.length > 200 ||
    !isRecord(value.eventMessagesById) ||
    Object.keys(value.eventMessagesById).length > 100 ||
    !validString(value.nicknameInput, 80) ||
    typeof value.useNicknameInBoard !== 'boolean' ||
    !validString(value.anonLabelInput, 80)
  ) {
    return false
  }

  const validReplies = (replies: unknown) =>
    Array.isArray(replies) &&
    replies.length <= 100 &&
    replies.every(
      (reply) =>
        isRecord(reply) &&
        validString(reply.id, 100) &&
        validString(reply.authorId, 100) &&
        validString(reply.displayAuthor, 120) &&
        typeof reply.isAnonymousNickname === 'boolean' &&
        validString(reply.body, 4000) &&
        validString(reply.createdAt, 100),
    )
  const validThreads = value.threads.every(
    (thread) =>
      isRecord(thread) &&
      validString(thread.id, 100) &&
      validString(thread.roomId, 100) &&
      validString(thread.title, 240) &&
      validString(thread.authorId, 100) &&
      validString(thread.displayAuthor, 120) &&
      typeof thread.isAnonymousNickname === 'boolean' &&
      validString(thread.body, 4000) &&
      validString(thread.createdAt, 100) &&
      validReplies(thread.replies),
  )
  const validMessages = Object.values(value.eventMessagesById).every(
    (messages) =>
      Array.isArray(messages) &&
      messages.length <= 500 &&
      messages.every(
        (message) =>
          isRecord(message) &&
          validString(message.id, 100) &&
          validString(message.eventId, 100) &&
          validString(message.authorFamilyId, 100) &&
          validString(message.authorNickname, 120) &&
          validString(message.authorRealName, 120) &&
          validString(message.body, 4000) &&
          validString(message.createdAt, 100),
      ),
  )
  return validThreads && validMessages
}

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return noStore({ error: 'Kirjautuminen vaaditaan.' }, 401)
    return noStore({ state: user.communityState ?? null })
  } catch (error) {
    console.error('GET /api/community-state error:', error)
    return noStore({ error: 'Yhteisötilan haku epäonnistui.' }, 500)
  }
}

export async function PUT(request: NextRequest) {
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > 128_000) {
    return noStore({ error: 'Yhteisötila ylittää sallitun koon.' }, 413)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return noStore({ error: 'Pyynnön JSON-runko ei kelpaa.' }, 400)
  }
  if (!isRecord(body) || !isCommunityState(body.state)) {
    return noStore({ error: 'Yhteisötilan tiedot eivät kelpaa.' }, 400)
  }

  if (JSON.stringify(body.state).length > 128_000) {
    return noStore({ error: 'Yhteisötila ylittää sallitun koon.' }, 413)
  }

  try {
    const user = await getCurrentUser()
    if (!user) return noStore({ error: 'Kirjautuminen vaaditaan.' }, 401)
    const payload = await getPayload({ config })
    const updated = await payload.update({
      collection: 'users',
      id: user.id,
      data: { communityState: body.state },
      overrideAccess: true,
    })
    return noStore({ state: updated.communityState, updatedAt: updated.updatedAt })
  } catch (error) {
    console.error('PUT /api/community-state error:', error)
    return noStore({ error: 'Yhteisötilan tallennus epäonnistui.' }, 500)
  }
}
