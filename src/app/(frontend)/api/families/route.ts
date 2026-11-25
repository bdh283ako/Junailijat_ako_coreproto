import { NextRequest, NextResponse } from 'next/server'
import {
  listFamiliesForUser,
  toggleFamilyLike,
  upsertFamilyProfile,
  type DemoFamilyProfileInput,
} from '@/lib/localDemoStore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Perheiden tallennus epäonnistui.'
}

export async function GET(request: NextRequest) {
  const viewerEmail = request.nextUrl.searchParams.get('viewerEmail')?.trim()
  if (!viewerEmail || !viewerEmail.includes('@')) {
    return NextResponse.json({ error: 'viewerEmail on pakollinen.' }, { status: 400 })
  }

  try {
    const families = await listFamiliesForUser(viewerEmail)
    return NextResponse.json({ families })
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Pyynnön JSON-runko ei kelpaa.' }, { status: 400 })
  }
  if (!isRecord(body) || typeof body.action !== 'string') {
    return NextResponse.json({ error: 'Toiminto puuttuu.' }, { status: 400 })
  }

  if (body.action === 'upsertProfile') {
    const input = body.profile
    if (
      !isRecord(input) ||
      !isNonEmptyString(input.email) ||
      !input.email.includes('@') ||
      !isNonEmptyString(input.familyName) ||
      !isNonEmptyString(input.area) ||
      (input.childrenSummary !== undefined && typeof input.childrenSummary !== 'string') ||
      (input.bio !== undefined && typeof input.bio !== 'string')
    ) {
      return NextResponse.json({ error: 'Perheprofiilin tiedot eivät kelpaa.' }, { status: 400 })
    }

    const profile: DemoFamilyProfileInput = {
      email: input.email,
      familyName: input.familyName,
      area: input.area,
      ...(typeof input.childrenSummary === 'string'
        ? { childrenSummary: input.childrenSummary }
        : {}),
      ...(typeof input.bio === 'string' ? { bio: input.bio } : {}),
    }
    try {
      const savedProfile = await upsertFamilyProfile(profile)
      return NextResponse.json({ profile: savedProfile })
    } catch (error) {
      return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
    }
  }

  if (body.action === 'toggleLike') {
    if (
      !isNonEmptyString(body.fromEmail) ||
      !body.fromEmail.includes('@') ||
      !isNonEmptyString(body.toEmail) ||
      !body.toEmail.includes('@')
    ) {
      return NextResponse.json({ error: 'Tykkäyksen sähköpostiosoitteet eivät kelpaa.' }, { status: 400 })
    }
    try {
      const like = await toggleFamilyLike(body.fromEmail, body.toEmail)
      return NextResponse.json({ like })
    } catch (error) {
      return NextResponse.json({ error: errorMessage(error) }, { status: 400 })
    }
  }

  return NextResponse.json({ error: 'Tuntematon toiminto.' }, { status: 400 })
}
