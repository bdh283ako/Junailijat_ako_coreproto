import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export interface StoredFamilyProfileRecord {
  userId: string
  instanceId: string
  updatedAt: string
  profile: Record<string, unknown>
}

declare global {
  // Säilytetään demoprofiilit palvelinprosessin yli dev- ja preview-ajossa
  var __perhePiiriDemoProfiles: Map<string, StoredFamilyProfileRecord> | undefined
}

const profileStore =
  globalThis.__perhePiiriDemoProfiles ??
  (globalThis.__perhePiiriDemoProfiles = new Map<string, StoredFamilyProfileRecord>())

const INSTANCE_ID =
  process.env.DEMO_INSTANCE_ID?.trim() ||
  process.env.VERCEL_REGION?.trim() ||
  'figma-demo-local'

function sanitizeUserId(raw: string | null | undefined): string {
  const cleaned = (raw ?? '').trim().toLowerCase()
  if (!cleaned) return 'demo_user'
  return cleaned.replace(/[^a-z0-9_@-]+/g, '_').slice(0, 80) || 'demo_user'
}

export async function GET(req: NextRequest) {
  const userId = sanitizeUserId(req.nextUrl.searchParams.get('userId'))
  const existing = profileStore.get(userId)

  if (!existing) {
    return NextResponse.json(
      {
        ok: true,
        userId,
        instanceId: INSTANCE_ID,
        document: null,
      },
      { status: 200 },
    )
  }

  return NextResponse.json(
    {
      ok: true,
      userId,
      instanceId: existing.instanceId,
      document: existing,
    },
    { status: 200 },
  )
}

export async function PUT(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Virheellinen JSON-runko.' },
      { status: 400 },
    )
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json(
      { ok: false, error: 'Pyynnön rungon täytyy olla objekti.' },
      { status: 400 },
    )
  }

  const payload = body as {
    userId?: unknown
    profile?: unknown
  }

  const userId = sanitizeUserId(
    typeof payload.userId === 'string' ? payload.userId : undefined,
  )

  if (!payload.profile || typeof payload.profile !== 'object' || Array.isArray(payload.profile)) {
    return NextResponse.json(
      { ok: false, error: 'Puuttuva tai virheellinen profile-objekti.' },
      { status: 400 },
    )
  }

  const updatedAt = new Date().toISOString()
  const previous = profileStore.get(userId)

  const nextRecord: StoredFamilyProfileRecord = {
    userId,
    instanceId: INSTANCE_ID,
    updatedAt,
    profile: {
      ...(previous?.profile ?? {}),
      ...(payload.profile as Record<string, unknown>),
    },
  }

  profileStore.set(userId, nextRecord)

  return NextResponse.json(
    {
      ok: true,
      userId,
      instanceId: INSTANCE_ID,
      document: nextRecord,
    },
    { status: 201 },
  )
}