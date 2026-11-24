import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

type FamilyRelationId = string

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getFamilyRelationId(value: unknown): FamilyRelationId | null {
  if (typeof value === 'string' && value.trim().length > 0) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (isRecord(value)) return getFamilyRelationId(value.id)
  return null
}

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json()
    if (!isRecord(body)) {
      return NextResponse.json({ error: 'Virheellinen pyyntö' }, { status: 400 })
    }

    const fromFamilyId = getFamilyRelationId(body.fromFamilyId)
    const toFamilyId = getFamilyRelationId(body.toFamilyId)
    const action = body.action
    if (fromFamilyId === null || toFamilyId === null) {
      return NextResponse.json({ error: 'Virheellinen pyyntö' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })

    // 1. Jos käyttäjä ohittaa (swipe left), tallennetaan vain 'passed'
    if (action === 'passed') {
      const record = await payload.create({
        collection: 'family-matches',
        data: {
          fromFamily: fromFamilyId,
          toFamily: toFamilyId,
          status: 'passed',
        },
      })
      return NextResponse.json({ match: false, data: record })
    }

    // 2. Jos käyttäjä tykkää (swipe right), tarkistetaan onko vastapuoli jo tykännyt meistä
    const existingReverseLike = await payload.find({
      collection: 'family-matches',
      where: {
        and: [
          { fromFamily: { equals: toFamilyId } },
          { toFamily: { equals: fromFamilyId } },
          { status: { equals: 'liked' } },
        ],
      },
    })

    // 3. Jos vastatykkäys löytyy -> päivitetään se osumaksi ja luodaan vastinpari
    const reverseDoc = existingReverseLike.docs[0]
    if (reverseDoc) {
      await payload.update({
        collection: 'family-matches',
        id: reverseDoc.id,
        data: { status: 'matched' },
      })

      const newMatch = await payload.create({
        collection: 'family-matches',
        data: {
          fromFamily: fromFamilyId,
          toFamily: toFamilyId,
          status: 'matched',
        },
      })

      return NextResponse.json({ match: true, data: newMatch })
    }

    // 4. Jos vastatykkäystä ei vielä ole, tallennetaan yksisuuntainen 'liked'
    const newLike = await payload.create({
      collection: 'family-matches',
      data: {
        fromFamily: fromFamilyId,
        toFamily: toFamilyId,
        status: 'liked',
      },
    })

    return NextResponse.json({ match: false, data: newLike })
  } catch (error) {
    console.error('Match virhe:', error)
    return NextResponse.json({ error: 'Tallennus epäonnistui' }, { status: 500 })
  }
}