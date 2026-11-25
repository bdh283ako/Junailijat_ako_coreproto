import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import {
  appendChatMessage,
  canAccessChatChannel,
  listChatChannels,
  listChatMessages,
} from '@/lib/postgres-app-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return noStore({ error: 'Kirjautuminen vaaditaan.' }, 401)

    const channelId = request.nextUrl.searchParams.get('channelId')?.trim()
    if (channelId) {
      if (channelId.length > 300) return noStore({ error: 'Kanavatunniste ei kelpaa.' }, 400)
      if (!(await canAccessChatChannel(user, channelId))) {
        return noStore({ error: 'Sinulla ei ole pääsyä tähän keskusteluun.' }, 403)
      }
      return noStore({ messages: await listChatMessages(channelId) })
    }

    return noStore({ channels: await listChatChannels(user) })
  } catch (error) {
    console.error('GET /api/chat error:', error)
    return noStore({ error: 'Keskustelujen haku epäonnistui.' }, 500)
  }
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return noStore({ error: 'Pyynnön JSON-runko ei kelpaa.' }, 400)
  }
  if (!isRecord(body)) return noStore({ error: 'Pyynnön runko ei kelpaa.' }, 400)

  const channelId = typeof body.channelId === 'string' ? body.channelId.trim() : ''
  const channelTitle = typeof body.channelTitle === 'string' ? body.channelTitle.trim() : ''
  const messageBody = typeof body.body === 'string' ? body.body.trim() : ''
  if (
    !channelId ||
    channelId.length > 300 ||
    !channelTitle ||
    channelTitle.length > 160 ||
    !messageBody ||
    messageBody.length > 2000
  ) {
    return noStore({ error: 'Viestin tiedot eivät kelpaa.' }, 400)
  }

  try {
    const user = await getCurrentUser()
    if (!user) return noStore({ error: 'Kirjautuminen vaaditaan.' }, 401)
    if (!user.email) return noStore({ error: 'Google-tililtä puuttuu sähköpostiosoite.' }, 400)
    if (!(await canAccessChatChannel(user, channelId))) {
      return noStore({ error: 'Sinulla ei ole pääsyä tähän keskusteluun.' }, 403)
    }

    const message = await appendChatMessage({
      channelId,
      channelTitle,
      senderEmail: user.email.trim().toLowerCase(),
      senderName: user.name?.trim() || user.email.split('@')[0],
      body: messageBody,
    })
    return noStore({ message }, 201)
  } catch (error) {
    console.error('POST /api/chat error:', error)
    return noStore({ error: 'Viestin lähetys epäonnistui.' }, 500)
  }
}
