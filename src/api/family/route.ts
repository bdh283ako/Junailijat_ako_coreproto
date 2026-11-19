import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')?.trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ error: 'Missing email' }, { status: 400 })
  }

  try {
    const payload = await getPayload({ config: configPromise })
    const res = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      overrideAccess: true,
    })
    const user = res.docs[0] as any

    return NextResponse.json({
      found: Boolean(user),
      familyProfile: user?.familyProfile || null,
      savedLocation: user?.savedLocation || null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      action,
      email,
      providerId,
      name,
      familyProfile,
      savedLocation,
      targetEmail,
      role,
      inviterName,
      inviterEmail,
    } = body

    const cleanEmail = email?.trim().toLowerCase()
    const payload = await getPayload({ config: configPromise })

    if (action === 'save') {
      if (!cleanEmail) {
        return NextResponse.json({ savedToDb: false, reason: 'Missing email' })
      }

      const res = await payload.find({
        collection: 'users',
        where: { email: { equals: cleanEmail } },
        limit: 1,
        overrideAccess: true,
      })
      const existingUser = res.docs[0]

      const updateData: Record<string, any> = {}
      if (familyProfile !== undefined) updateData.familyProfile = familyProfile
      if (savedLocation !== undefined) updateData.savedLocation = savedLocation

      if (existingUser) {
        await payload.update({
          collection: 'users',
          id: existingUser.id,
          data: updateData as any,
          overrideAccess: true,
        })
      } else {
        await payload.create({
          collection: 'users',
          data: {
            providerId: providerId || `email:${cleanEmail}`,
            email: cleanEmail,
            name: name || cleanEmail.split('@')[0],
            ...updateData,
          } as any,
          overrideAccess: true,
        })
      }

      return NextResponse.json({ savedToDb: true })
    }

    if (action === 'invite') {
      const cleanTarget = targetEmail?.trim().toLowerCase()
      if (!cleanTarget) {
        return NextResponse.json({ found: false, message: 'Sähköpostiosoite puuttuu.' })
      }

      const targetRes = await payload.find({
        collection: 'users',
        where: { email: { equals: cleanTarget } },
        limit: 1,
        overrideAccess: true,
      })
      const targetUser = targetRes.docs[0] as any

      if (!targetUser) {
        return NextResponse.json({
          found: false,
          message: `Käyttäjää (${cleanTarget}) ei löytynyt vielä rekisteröityneiden joukosta. Lisätty odottavana kutsuna.`,
        })
      }

      const targetProfile = targetUser.familyProfile || {
        id: `fam-${targetUser.id}`,
        familyName: 'Meidän perhe',
        bio: '',
        city: 'Espoo',
        district: 'Espoo',
        adults: [
          {
            id: `a-${targetUser.id}`,
            name: targetUser.name || cleanTarget.split('@')[0],
            email: cleanTarget,
            role: 'Vanhempi',
            status: 'accepted',
          },
        ],
        children: [],
        parentInterests: [],
        pendingInvites: [],
      }

      const existingInvites = Array.isArray(targetProfile.pendingInvites)
        ? targetProfile.pendingInvites
        : []

      const updatedTargetProfile = {
        ...targetProfile,
        pendingInvites: [
          ...existingInvites.filter((i: any) => i.fromEmail !== cleanEmail),
          {
            fromEmail: cleanEmail,
            fromName: inviterName || cleanEmail,
            role: role || 'Vanhempi',
            sentAt: new Date().toISOString(),
          },
        ],
      }

      await payload.update({
        collection: 'users',
        id: targetUser.id,
        data: { familyProfile: updatedTargetProfile } as any,
        overrideAccess: true,
      })

      return NextResponse.json({
        found: true,
        targetName: targetUser.name || cleanTarget.split('@')[0],
        message: `Käyttäjä (${targetUser.name || cleanTarget}) löytyi kannasta! Kutsu lähetetty odottamaan hyväksyntää.`,
      })
    }

    if (action === 'accept') {
      const fromEmail = inviterEmail?.trim().toLowerCase()
      const [meRes, inviterRes] = await Promise.all([
        payload.find({
          collection: 'users',
          where: { email: { equals: cleanEmail } },
          limit: 1,
          overrideAccess: true,
        }),
        payload.find({
          collection: 'users',
          where: { email: { equals: fromEmail } },
          limit: 1,
          overrideAccess: true,
        }),
      ])

      const meUser = meRes.docs[0] as any
      const inviterUser = inviterRes.docs[0] as any

      if (inviterUser?.familyProfile) {
        const inviterProf = inviterUser.familyProfile
        const updatedAdults = (inviterProf.adults || []).map((a: any) =>
          a.email?.toLowerCase() === cleanEmail ? { ...a, status: 'accepted' } : a,
        )
        const mergedProfile = {
          ...inviterProf,
          adults: updatedAdults,
          pendingInvites: [],
        }

        await payload.update({
          collection: 'users',
          id: inviterUser.id,
          data: { familyProfile: mergedProfile } as any,
          overrideAccess: true,
        })

        if (meUser) {
          await payload.update({
            collection: 'users',
            id: meUser.id,
            data: { familyProfile: mergedProfile } as any,
            overrideAccess: true,
          })
        }

        return NextResponse.json({ accepted: true, familyProfile: mergedProfile })
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
// TIEDOSTON LOPPU