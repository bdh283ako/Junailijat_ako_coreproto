import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { resetPassedMatches, setFamilyMatchAction } from '@/lib/postgres-app-data'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Virheellinen pyyntö.' }, { status: 400 })
  }
  if (!isRecord(body)) {
    return NextResponse.json({ error: 'Virheellinen pyyntö.' }, { status: 400 })
  }

  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Kirjautuminen vaaditaan.' }, { status: 401 })
    if (body.action === 'reset-passed') {
      return NextResponse.json({ resetCount: await resetPassedMatches(user) })
    }
    if (
      typeof body.toFamilyId !== 'string' ||
      (body.action !== 'liked' && body.action !== 'passed')
    ) {
      return NextResponse.json({ error: 'Virheellinen pyyntö.' }, { status: 400 })
    }
    const result = await setFamilyMatchAction(user, body.toFamilyId, body.action)
    return NextResponse.json(result)
  } catch (error) {
    console.error('POST /api/match error:', error)
    return NextResponse.json({ error: 'Osuman tallennus epäonnistui.' }, { status: 400 })
  }
}
