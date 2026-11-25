import { NextRequest, NextResponse } from 'next/server'
import {
  listParticipations,
  removeParticipation,
  upsertParticipation,
} from '@/lib/localDemoStore'

export const runtime = 'nodejs'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const eventIdsParam = searchParams.get('eventIds')
    const participantEmail = searchParams.get('participantEmail')?.trim().toLowerCase()
    const eventIds = eventIdsParam
      ? eventIdsParam
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : undefined

    const docs = await listParticipations({ eventIds, participantEmail })
    return NextResponse.json({ docs })
  } catch (error) {
    console.error('GET /api/participations error:', error)
    return NextResponse.json({ error: 'Osallistumisten haku epäonnistui' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    const eventId = isRecord(body) && typeof body.eventId === 'string' ? body.eventId.trim() : ''
    const eventTitle =
      isRecord(body) && typeof body.eventTitle === 'string' ? body.eventTitle.trim() : ''
    const participantEmail =
      isRecord(body) && typeof body.participantEmail === 'string'
        ? body.participantEmail.trim().toLowerCase()
        : ''
    const participantName =
      isRecord(body) && typeof body.participantName === 'string'
        ? body.participantName.trim()
        : ''
    const status =
      isRecord(body) && body.status === 'interested' ? 'interested' : 'going'

    if (!eventId || !eventTitle || !participantEmail || !participantName) {
      return NextResponse.json(
        {
          error:
            'Pakolliset kentät: eventId, eventTitle, participantEmail, participantName',
        },
        { status: 400 },
      )
    }

    const result = await upsertParticipation({
      eventId,
      eventTitle,
      participantEmail,
      participantName,
      status,
    })
    return NextResponse.json({ doc: result.doc }, { status: result.created ? 201 : 200 })
  } catch (error) {
    console.error('POST /api/participations error:', error)
    return NextResponse.json({ error: 'Osallistumisen tallennus epäonnistui' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const eventId = searchParams.get('eventId')?.trim() || ''
    const participantEmail = searchParams.get('participantEmail')?.trim().toLowerCase() || ''

    if (!eventId || !participantEmail) {
      return NextResponse.json(
        { error: 'Pakolliset parametrit: eventId, participantEmail' },
        { status: 400 },
      )
    }

    const deletedCount = await removeParticipation(eventId, participantEmail)
    return NextResponse.json({ deletedCount })
  } catch (error) {
    console.error('DELETE /api/participations error:', error)
    return NextResponse.json({ error: 'Osallistumisen poisto epäonnistui' }, { status: 500 })
  }
}
