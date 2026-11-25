import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { getParticipationSummary, removeParticipation, upsertParticipation } from '@/lib/postgres-app-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return noStore({ error: 'Kirjautuminen vaaditaan.' }, 401)
    if (!user.email) return noStore({ error: 'Google-tililtä puuttuu sähköpostiosoite.' }, 400)

    const eventIdsParam = request.nextUrl.searchParams.get('eventIds')
    const eventIds = eventIdsParam
      ? eventIdsParam.split(',').map((id) => id.trim()).filter(Boolean).slice(0, 100)
      : undefined
    const summary = await getParticipationSummary(user.email, eventIds)
    return noStore(summary)
  } catch (error) {
    console.error('GET /api/participations error:', error)
    return noStore({ error: 'Osallistumisten haku epäonnistui.' }, 500)
  }
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return noStore({ error: 'Pyynnön JSON-runko ei kelpaa.' }, 400)
  }
  const eventId = isRecord(body) && typeof body.eventId === 'string' ? body.eventId.trim() : ''
  const eventTitle =
    isRecord(body) && typeof body.eventTitle === 'string' ? body.eventTitle.trim() : ''
  if (!eventId || eventId.length > 300 || !eventTitle || eventTitle.length > 300) {
    return noStore({ error: 'Tapahtuman tiedot eivät kelpaa.' }, 400)
  }

  try {
    const user = await getCurrentUser()
    if (!user) return noStore({ error: 'Kirjautuminen vaaditaan.' }, 401)
    if (!user.email) return noStore({ error: 'Google-tililtä puuttuu sähköpostiosoite.' }, 400)

    const status = isRecord(body) && body.status === 'interested' ? 'interested' : 'going'
    const result = await upsertParticipation({
      eventId,
      eventTitle,
      participantEmail: user.email.trim().toLowerCase(),
      participantName: user.name?.trim() || user.email.split('@')[0],
      status,
    })
    const summary = await getParticipationSummary(user.email)
    return noStore(
      {
        doc: result.doc,
        joinedEventIds: summary.joinedEventIds,
        countsByEventId: summary.countsByEventId,
      },
      result.created ? 201 : 200,
    )
  } catch (error) {
    console.error('POST /api/participations error:', error)
    return noStore({ error: 'Osallistumisen tallennus epäonnistui.' }, 500)
  }
}

export async function DELETE(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get('eventId')?.trim() ?? ''
  if (!eventId || eventId.length > 300) {
    return noStore({ error: 'Tapahtumatunniste ei kelpaa.' }, 400)
  }

  try {
    const user = await getCurrentUser()
    if (!user) return noStore({ error: 'Kirjautuminen vaaditaan.' }, 401)
    if (!user.email) return noStore({ error: 'Google-tililtä puuttuu sähköpostiosoite.' }, 400)

    const deletedCount = await removeParticipation(eventId, user.email)
    const summary = await getParticipationSummary(user.email)
    return noStore({
      deletedCount,
      joinedEventIds: summary.joinedEventIds,
      countsByEventId: summary.countsByEventId,
    })
  } catch (error) {
    console.error('DELETE /api/participations error:', error)
    return noStore({ error: 'Osallistumisen poisto epäonnistui.' }, 500)
  }
}
