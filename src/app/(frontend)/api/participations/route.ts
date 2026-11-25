import { NextRequest, NextResponse } from 'next/server'
import {
  getParticipationSummary,
  removeParticipation,
  upsertParticipation,
} from '@/lib/localDemoStore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const eventIdsParam = searchParams.get('eventIds')
    const participantEmail = searchParams.get('participantEmail')?.trim().toLowerCase()
    const eventIds = eventIdsParam ? eventIdsParam.split(',').filter(Boolean) : undefined

    const summary = await getParticipationSummary({ eventIds, participantEmail })
    return noStoreJson(summary)
  } catch (error) {
    console.error('GET /api/participations error:', error)
    return noStoreJson({ error: 'Osallistumisten haku epäonnistui' }, 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    const eventId = isRecord(body) && typeof body.eventId === 'string' ? body.eventId : ''
    const eventTitle =
      isRecord(body) && typeof body.eventTitle === 'string' ? body.eventTitle.trim() : ''
    const participantEmail =
      isRecord(body) && typeof body.participantEmail === 'string'
        ? body.participantEmail.trim().toLowerCase()
        : ''
    const participantName =
      isRecord(body) && typeof body.participantName === 'string' ? body.participantName.trim() : ''
    const status = isRecord(body) && body.status === 'interested' ? 'interested' : 'going'

    if (!eventId.trim() || !eventTitle || !participantEmail || !participantName) {
      return noStoreJson(
        {
          error: 'Pakolliset kentät: eventId, eventTitle, participantEmail, participantName',
        },
        400,
      )
    }

    const result = await upsertParticipation({
      eventId,
      eventTitle,
      participantEmail,
      participantName,
      status,
    })
    const summary = await getParticipationSummary({ participantEmail })
    return noStoreJson(
      {
        doc: result.doc,
        joinedEventIds: summary.joinedEventIds,
        countsByEventId: summary.countsByEventId,
      },
      result.created ? 201 : 200,
    )
  } catch (error) {
    console.error('POST /api/participations error:', error)
    return noStoreJson({ error: 'Osallistumisen tallennus epäonnistui' }, 500)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const eventId = searchParams.get('eventId') ?? ''
    const participantEmail = searchParams.get('participantEmail')?.trim().toLowerCase() || ''

    if (!eventId.trim() || !participantEmail) {
      return noStoreJson({ error: 'Pakolliset parametrit: eventId, participantEmail' }, 400)
    }

    const deletedCount = await removeParticipation(eventId, participantEmail)
    const summary = await getParticipationSummary({ participantEmail })
    return noStoreJson({
      deletedCount,
      joinedEventIds: summary.joinedEventIds,
      countsByEventId: summary.countsByEventId,
    })
  } catch (error) {
    console.error('DELETE /api/participations error:', error)
    return noStoreJson({ error: 'Osallistumisen poisto epäonnistui' }, 500)
  }
}
