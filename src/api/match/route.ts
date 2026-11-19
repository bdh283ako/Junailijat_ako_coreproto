import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function POST(req: Request) {
  try {
    const { fromFamilyId, toFamilyId, action } = await req.json()
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
    if (existingReverseLike.docs.length > 0) {
      const reverseDoc = existingReverseLike.docs[0]

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