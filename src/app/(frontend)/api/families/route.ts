import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { listFamiliesForUser, toggleFamilyLike } from '@/lib/postgres-app-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function GET() {
  try {
    const viewer = await getCurrentUser()
    if (!viewer) return NextResponse.json({ error: 'Kirjautuminen vaaditaan.' }, { status: 401 })
    const families = await listFamiliesForUser(viewer)
    return NextResponse.json({ families }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('GET /api/families error:', error)
    return NextResponse.json({ error: 'Perheiden haku epäonnistui.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Pyynnön JSON-runko ei kelpaa.' }, { status: 400 })
  }
  if (!isRecord(body) || body.action !== 'toggleLike' || typeof body.targetUserId !== 'string') {
    return NextResponse.json({ error: 'Tykkäyksen kohde puuttuu.' }, { status: 400 })
  }

  try {
    const viewer = await getCurrentUser()
    if (!viewer) return NextResponse.json({ error: 'Kirjautuminen vaaditaan.' }, { status: 401 })
    const like = await toggleFamilyLike(viewer, body.targetUserId)
    return NextResponse.json({ like })
  } catch (error) {
    console.error('POST /api/families error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Tykkäyksen tallennus epäonnistui.' },
      { status: 400 },
    )
  }
}
