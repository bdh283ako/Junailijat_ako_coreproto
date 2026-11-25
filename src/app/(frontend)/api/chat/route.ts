import { NextRequest, NextResponse } from 'next/server'
import {
  appendChatMessage,
  listChannelMessages,
  listChannelsSummary,
} from '@/lib/localDemoStore'

export const runtime = 'nodejs'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const channelId = searchParams.get('channelId')?.trim()

    if (channelId) {
      const messages = await listChannelMessages(channelId)
      return NextResponse.json({ messages })
    }

    const channels = await listChannelsSummary()
    return NextResponse.json({ channels })
  } catch (error) {
    console.error('GET /api/chat error:', error)
    return NextResponse.json({ error: 'Keskustelujen haku epäonnistui' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    const channelId =
      isRecord(body) && typeof body.channelId === 'string' ? body.channelId.trim() : ''
    const channelTitle =
      isRecord(body) && typeof body.channelTitle === 'string' ? body.channelTitle.trim() : ''
    const senderEmail =
      isRecord(body) && typeof body.senderEmail === 'string'
        ? body.senderEmail.trim().toLowerCase()
        : ''
    const senderName =
      isRecord(body) && typeof body.senderName === 'string' ? body.senderName.trim() : ''
    const messageBody = isRecord(body) && typeof body.body === 'string' ? body.body.trim() : ''

    if (!channelId || !channelTitle || !senderEmail || !senderName || !messageBody) {
      return NextResponse.json(
        {
          error: 'Pakolliset kentät: channelId, channelTitle, senderEmail, senderName, body',
        },
        { status: 400 },
      )
    }

    const message = await appendChatMessage({
      channelId,
      channelTitle,
      senderEmail,
      senderName,
      body: messageBody,
    })
    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    console.error('POST /api/chat error:', error)
    return NextResponse.json({ error: 'Viestin lähetys epäonnistui' }, { status: 500 })
  }
}
