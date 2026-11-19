import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const KARO_FEED_URL = 'https://eventpulsebyjunailijat.ai.studio/api/events/feed.jsonld'

export async function GET() {
  try {
    const res = await fetch(KARO_FEED_URL, {
      cache: 'no-store',
      headers: {
        Accept: 'application/ld+json, application/json',
      },
    })

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Karon feedi vastasi tilakoodilla ${res.status}` },
        { status: res.status },
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('GET /api/events proxy failed:', error)
    return NextResponse.json(
      { ok: false, error: 'Yhteys Karon tapahtumafeediin epäonnistui' },
      { status: 502 },
    )
  }
}