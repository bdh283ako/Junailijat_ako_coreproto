import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/current-user'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function profileRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
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

    return noStore({
      ok: true,
      userId: String(user.id),
      instanceId: 'postgresql',
      document: {
        userId: String(user.id),
        instanceId: 'postgresql',
        updatedAt: user.updatedAt,
        profile: isRecord(user.familyProfile) ? user.familyProfile : null,
      },
    })
  } catch (error) {
    console.error('GET /api/family-profile error:', error)
    return noStore({ error: 'Perheprofiilin haku epäonnistui.' }, 500)
  }
}

export async function PUT(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return noStore({ error: 'Pyynnön JSON-runko ei kelpaa.' }, 400)
  }
  if (!isRecord(body) || !isRecord(body.profile)) {
    return noStore({ error: 'Profiilin täytyy olla JSON-objekti.' }, 400)
  }

  let serialized: string
  try {
    serialized = JSON.stringify(body.profile)
  } catch {
    return noStore({ error: 'Profiilia ei voitu käsitellä.' }, 400)
  }
  if (serialized.length > 64_000) {
    return noStore({ error: 'Profiili ylittää sallitun koon.' }, 413)
  }

  try {
    const user = await getCurrentUser()
    if (!user) return noStore({ error: 'Kirjautuminen vaaditaan.' }, 401)

    const payload = await getPayload({ config })
    const saved = await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        familyProfile: {
          ...profileRecord(user.familyProfile),
          ...body.profile,
        },
      },
      overrideAccess: true,
    })

    const document = {
      userId: String(saved.id),
      instanceId: 'postgresql',
      updatedAt: saved.updatedAt,
      profile: isRecord(saved.familyProfile) ? saved.familyProfile : {},
    }
    return noStore({ ok: true, userId: String(saved.id), instanceId: 'postgresql', document }, 200)
  } catch (error) {
    console.error('PUT /api/family-profile error:', error)
    return noStore({ error: 'Perheprofiilin tallennus epäonnistui.' }, 500)
  }
}
