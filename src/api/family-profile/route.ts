import { NextRequest, NextResponse } from 'next/server'
import {
  deleteFamilyProfileDoc,
  findFamilyProfileDoc,
  upsertFamilyProfileDoc,
  UserProfileState,
} from '@/lib/localMongoStore'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const doc = await findFamilyProfileDoc()
    return NextResponse.json({ ok: true, document: doc })
  } catch (error) {
    console.error('GET /api/family-profile failed:', error)
    return NextResponse.json(
      { ok: false, error: 'Tiedostopohjaisen Mongo-kannan luku epäonnistui' },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as { profile?: UserProfileState }
    if (!body?.profile) {
      return NextResponse.json(
        { ok: false, error: 'Profiilidata puuttuu pyynnöstä' },
        { status: 400 },
      )
    }

    const doc = await upsertFamilyProfileDoc(body.profile)
    return NextResponse.json({ ok: true, document: doc })
  } catch (error) {
    console.error('PUT /api/family-profile failed:', error)
    return NextResponse.json(
      { ok: false, error: 'Tiedostopohjaisen Mongo-kannan tallennus epäonnistui' },
      { status: 500 },
    )
  }
}

export async function DELETE() {
  try {
    await deleteFamilyProfileDoc()
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/family-profile failed:', error)
    return NextResponse.json(
      { ok: false, error: 'Tiedostopohjaisen Mongo-kannan tyhjennys epäonnistui' },
      { status: 500 },
    )
  }
}