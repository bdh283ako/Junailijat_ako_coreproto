'use client'

import React, { useEffect, useMemo, useState } from 'react'
import type { SavedLocation } from './GatherEvents'

export interface ChildProfile {
  id: string
  age: number
  gender: 'boy' | 'girl' | 'unspecified'
  tags: string[]
}

export interface AdultMember {
  id: string
  name: string
  role: 'Vanhempi' | 'Isovanhempi' | 'Läheinen'
}

export interface FamilyProfile {
  id: string
  familyName: string
  bio: string
  city: string
  district: string
  adults: AdultMember[]
  children: ChildProfile[]
  parentInterests: string[]
}

const CHILD_TAGS = [
  'Jalkapallo',
  'Uinti',
  'Musiikki',
  'Kuvataide',
  'Lukeminen',
  'Lautapelit',
  'Luonto & Retkeily',
  'Tanssi',
  'Koodaus & Pelit',
  'Leikkipuistot',
]

const PARENT_TAGS = [
  'Kahviseura',
  'Puistotreffit',
  'Vaunulenkit',
  'Juoksu & Kuntosali',
  'Kulttuuri & Museot',
  'Ruuanlaitto & Grillaus',
  'Lautapeli-illat',
  'Retkeily',
  'Juniorijalkapallo',
  'Kirppikset',
]

const MOCK_FAMILIES: FamilyProfile[] = [
  {
    id: 'fam-1',
    familyName: 'Korhosen perhe',
    bio: 'Etsitään viikonloppuisin ulkoilu- ja peliseuraa sekä vanhemmille juttuseuraa kahvikupin äärelle.',
    city: 'Espoo',
    district: 'Leppävaara',
    adults: [
      { id: 'a1', name: 'Mikko', role: 'Vanhempi' },
      { id: 'a2', name: 'Sanna', role: 'Vanhempi' },
      { id: 'a3', name: 'Liisa-mummi', role: 'Isovanhempi' },
    ],
    children: [
      { id: 'c1', age: 12, gender: 'boy', tags: ['Jalkapallo', 'Koodaus & Pelit'] },
      { id: 'c2', age: 8, gender: 'girl', tags: ['Uinti', 'Kuvataide', 'Leikkipuistot'] },
    ],
    parentInterests: ['Juniorijalkapallo', 'Kahviseura', 'Juoksu & Kuntosali', 'Retkeily'],
  },
  {
    id: 'fam-2',
    familyName: 'Mäkisen & Laineen uusioperhe',
    bio: 'Kulttuuria, museoita ja lautapelejä. Isoäiti usein mukana viikonloppumenossa!',
    city: 'Helsinki',
    district: 'Töölö',
    adults: [
      { id: 'a4', name: 'Laura', role: 'Vanhempi' },
      { id: 'a5', name: 'Kummitäti Noora', role: 'Läheinen' },
    ],
    children: [
      { id: 'c3', age: 10, gender: 'unspecified', tags: ['Lautapelit', 'Musiikki', 'Lukeminen'] },
    ],
    parentInterests: ['Kulttuuri & Museot', 'Lautapeli-illat', 'Kahviseura'],
  },
  {
    id: 'fam-3',
    familyName: 'Virtaset',
    bio: 'Aktiivista arkea kentän laidalla ja ulkoillen. Etsitään samanikäistä seuraa treeneihin ja retkille.',
    city: 'Kauniainen',
    district: 'Keskusta',
    adults: [
      { id: 'a6', name: 'Janne', role: 'Vanhempi' },
      { id: 'a7', name: 'Elina', role: 'Vanhempi' },
    ],
    children: [
      { id: 'c4', age: 13, gender: 'boy', tags: ['Jalkapallo', 'Luonto & Retkeily'] },
      { id: 'c5', age: 16, gender: 'girl', tags: ['Musiikki', 'Lukeminen'] },
    ],
    parentInterests: ['Juniorijalkapallo', 'Juoksu & Kuntosali', 'Ruuanlaitto & Grillaus'],
  },
]

const DEFAULT_MY_FAMILY: FamilyProfile = {
  id: 'my-family',
  familyName: 'Meidän perhe',
  bio: 'Moikka! Etsitään mukavaa seuraa tapahtumiin ja harrastuksiin.',
  city: 'Espoo',
  district: 'Espoo',
  adults: [{ id: 'me-1', name: 'Minä', role: 'Vanhempi' }],
  children: [{ id: 'child-1', age: 12, gender: 'boy', tags: ['Jalkapallo'] }],
  parentInterests: ['Kahviseura', 'Juniorijalkapallo', 'Juoksu & Kuntosali'],
}

export function FamilyMatcher({ userLocation }: { userLocation: SavedLocation }) {
  const [activeTab, setActiveTab] = useState<'match' | 'profile'>('match')
  const [myFamily, setMyFamily] = useState<FamilyProfile>(DEFAULT_MY_FAMILY)
  const [matches, setMatches] = useState<string[]>([])
  const [passed, setPassed] = useState<string[]>([])

  // Lapsen lisäyslomakkeen tila
  const [newChildAge, setNewChildAge] = useState<string>('8')
  const [newChildGender, setNewChildGender] = useState<'boy' | 'girl' | 'unspecified'>('boy')
  const [newChildTags, setNewChildTags] = useState<string[]>([])

  // Aikuisen / läheisen lisäyslomakkeen tila
  const [newAdultName, setNewAdultName] = useState('')
  const [newAdultRole, setNewAdultRole] = useState<'Vanhempi' | 'Isovanhempi' | 'Läheinen'>('Vanhempi')

  useEffect(() => {
    const saved = localStorage.getItem('gather_family_profile_v1')
    if (saved) {
      try {
        setMyFamily(JSON.parse(saved))
      } catch {}
    }
    const savedMatches = localStorage.getItem('gather_family_matches_v1')
    if (savedMatches) {
      try {
        setMatches(JSON.parse(savedMatches))
      } catch {}
    }
  }, [])

  const saveFamily = (updated: FamilyProfile) => {
    setMyFamily(updated)
    localStorage.setItem('gather_family_profile_v1', JSON.stringify(updated))
  }

  const toggleParentInterest = (tag: string) => {
    const exists = myFamily.parentInterests.includes(tag)
    const next = exists
      ? myFamily.parentInterests.filter((t) => t !== tag)
      : [...myFamily.parentInterests, tag]
    saveFamily({ ...myFamily, parentInterests: next })
  }

  const handleAddAdult = () => {
    if (!newAdultName.trim()) return
    const nextAdults: AdultMember[] = [
      ...myFamily.adults,
      { id: `adult-${Date.now()}`, name: newAdultName.trim(), role: newAdultRole },
    ]
    saveFamily({ ...myFamily, adults: nextAdults })
    setNewAdultName('')
  }

  const handleRemoveAdult = (id: string) => {
    if (myFamily.adults.length <= 1) return
    saveFamily({ ...myFamily, adults: myFamily.adults.filter((a) => a.id !== id) })
  }

  const handleAddChild = () => {
    const parsedAge = Number(newChildAge)
    if (!Number.isFinite(parsedAge) || parsedAge < 0 || parsedAge > 18) return
    const nextChildren: ChildProfile[] = [
      ...myFamily.children,
      {
        id: `child-${Date.now()}`,
        age: parsedAge,
        gender: newChildGender,
        tags: newChildTags,
      },
    ]
    saveFamily({ ...myFamily, children: nextChildren })
    setNewChildTags([])
  }

  const handleRemoveChild = (id: string) => {
    saveFamily({ ...myFamily, children: myFamily.children.filter((c) => c.id !== id) })
  }

  // Lasketaan yhteensopivuuspisteet muiden perheiden kanssa
  const scoredCandidates = useMemo(() => {
    const myChildTags = new Set(myFamily.children.flatMap((c) => c.tags))
    const myAges = myFamily.children.map((c) => c.age)

    return MOCK_FAMILIES.filter((f) => !passed.includes(f.id)).map((candidate) => {
      const sharedParentTags = candidate.parentInterests.filter((t) =>
        myFamily.parentInterests.includes(t),
      )
      const candidateChildTags = candidate.children.flatMap((c) => c.tags)
      const sharedChildTags = Array.from(new Set(candidateChildTags.filter((t) => myChildTags.has(t))))

      // Tarkistetaan onko samanikäisiä lapsia (±2 vuotta)
      let ageMatchBonus = 0
      candidate.children.forEach((cc) => {
        if (myAges.some((ma) => Math.abs(ma - cc.age) <= 2)) ageMatchBonus = 25
      })

      const score = Math.min(
        98,
        45 + sharedParentTags.length * 12 + sharedChildTags.length * 15 + ageMatchBonus,
      )

      return {
        family: candidate,
        score,
        sharedParentTags,
        sharedChildTags,
        isMatched: matches.includes(candidate.id),
      }
    })
  }, [myFamily, passed, matches])

  const handleMatch = (id: string) => {
    const next = Array.from(new Set([...matches, id]))
    setMatches(next)
    localStorage.setItem('gather_family_matches_v1', JSON.stringify(next))
  }

  const genderLabel = (g: 'boy' | 'girl' | 'unspecified') =>
    g === 'boy' ? 'Poika' : g === 'girl' ? 'Tyttö' : 'Ei määritelty'

  return (
    <section className="json-feed-section" id="perhe-match" style={{ paddingTop: '1.5rem' }}>
      <div className="json-feed-heading">
        <div>
          <p className="eyebrow">Perheverkosto · Match & Harrastukset</p>
          <h2>Löydä sopivaa perheseuraa ({userLocation.city})</h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className={activeTab === 'match' ? 'button primary' : 'button'}
            onClick={() => setActiveTab('match')}
          >
            🔥 Selaa perheitä ({scoredCandidates.length})
          </button>
          <button
            type="button"
            className={activeTab === 'profile' ? 'button primary' : 'button'}
            onClick={() => setActiveTab('profile')}
          >
            👨‍👩‍👧‍👦 Meidän perhe ({myFamily.adults.length} aikuista, {myFamily.children.length} lasta)
          </button>
        </div>
      </div>

      {activeTab === 'profile' ? (
        <div
          style={{
            background: '#fff',
            borderRadius: 20,
            padding: 24,
            border: '1px solid rgba(0,0,0,0.08)',
            display: 'grid',
            gap: 24,
          }}
        >
          {/* A) Perheen aikuiset & lähisukulaiset */}
          <div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: 18 }}>
              1. Perheen aikuiset & lähisukulaiset
            </h3>
            <p style={{ margin: '0 0 12px 0', fontSize: 13, color: '#64748b' }}>
              Kokoa perheesi vanhemmista, isovanhemmista ja kummeista.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {myFamily.adults.map((a) => (
                <span
                  key={a.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px',
                    borderRadius: 999,
                    background: '#f1f5f9',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  👤 {a.name} <small style={{ color: '#475569' }}>({a.role})</small>
                  {myFamily.adults.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAdult(a.id)}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  )}
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Lisää nimi (esim. Mummi tai Puoliso)"
                value={newAdultName}
                onChange={(e) => setNewAdultName(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
              />
              <select
                value={newAdultRole}
                onChange={(e) => setNewAdultRole(e.target.value as any)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
              >
                <option value="Vanhempi">Vanhempi</option>
                <option value="Isovanhempi">Isovanhempi</option>
                <option value="Läheinen">Läheinen / Kummi</option>
              </select>
              <button type="button" className="button" onClick={handleAddAdult}>
                + Lisää perheenjäsen
              </button>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: 0 }} />

          {/* C) Lapset: ikä (pakollinen), sukupuoli ja harrastustagit */}
          <div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: 18 }}>2. Lapset & kiinnostuksen kohteet</h3>
            <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
              {myFamily.children.map((c, idx) => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    background: '#f8fafc',
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div>
                    <strong>
                      Lapsi #{idx + 1}: {c.age} v
                    </strong>{' '}
                    · <span>{genderLabel(c.gender)}</span>
                    {c.tags.length > 0 && (
                      <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {c.tags.map((t) => (
                          <span
                            key={t}
                            style={{
                              fontSize: 11,
                              padding: '2px 8px',
                              borderRadius: 999,
                              background: '#dcfce7',
                              color: '#166534',
                              fontWeight: 600,
                            }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveChild(c.id)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#b91c1c',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Poista
                  </button>
                </div>
              ))}
            </div>

            <div
              style={{
                background: '#f8fafc',
                padding: 16,
                borderRadius: 12,
                border: '1px dashed #cbd5e1',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
                Lisää lapsi perheprofiiliin
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <label style={{ fontSize: 13 }}>
                  Ikä (pakollinen):{' '}
                  <input
                    type="number"
                    min={0}
                    max={18}
                    required
                    value={newChildAge}
                    onChange={(e) => setNewChildAge(e.target.value)}
                    style={{
                      width: 65,
                      padding: '6px 8px',
                      borderRadius: 6,
                      border: '1px solid #94a3b8',
                    }}
                  />
                </label>
                <label style={{ fontSize: 13 }}>
                  Sukupuoli:{' '}
                  <select
                    value={newChildGender}
                    onChange={(e) => setNewChildGender(e.target.value as any)}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #94a3b8' }}
                  >
                    <option value="boy">Poika</option>
                    <option value="girl">Tyttö</option>
                    <option value="unspecified">Ei halua kertoa</option>
                  </select>
                </label>
              </div>

              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                Lapsen harrastukset / kiinnostukset:
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {CHILD_TAGS.map((tag) => {
                  const selected = newChildTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setNewChildTags((prev) =>
                          prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
                        )
                      }
                      style={{
                        padding: '5px 10px',
                        borderRadius: 999,
                        fontSize: 12,
                        border: selected ? '1px solid #166534' : '1px solid #cbd5e1',
                        background: selected ? '#166534' : '#ffffff',
                        color: selected ? '#ffffff' : '#1e293b',
                        cursor: 'pointer',
                      }}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>

              <button type="button" className="button primary" onClick={handleAddChild}>
                + Tallenna lapsi
              </button>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: 0 }} />

          {/* C) Vanhempien "Nyt kiinnostaa" -tagit */}
          <div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: 18 }}>
              3. Vanhempia & aikuisia kiinnostaa nyt
            </h3>
            <p style={{ margin: '0 0 12px 0', fontSize: 13, color: '#64748b' }}>
              Valitse tagit, joiden perusteella teille ehdotetaan muita perheitä ja tapahtumia.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PARENT_TAGS.map((tag) => {
                const active = myFamily.parentInterests.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleParentInterest(tag)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 999,
                      fontSize: 13,
                      fontWeight: 600,
                      border: active ? '1px solid #166534' : '1px solid #cbd5e1',
                      background: active ? '#166534' : '#fff',
                      color: active ? '#fff' : '#0f172a',
                      cursor: 'pointer',
                    }}
                  >
                    {active ? `✓ ${tag}` : `+ ${tag}`}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        /* B) Matchaus-korttinäkymä */
        <div className="feed-grid">
          {scoredCandidates.map(({ family, score, sharedParentTags, sharedChildTags, isMatched }) => (
            <div
              key={family.id}
              className="feed-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: 20,
                background: '#fff',
                borderRadius: 20,
                border: isMatched ? '2px solid #166534' : '1px solid rgba(0,0,0,0.08)',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#557263' }}>
                    📍 {family.district}, {family.city}
                  </span>
                  <span
                    style={{
                      background: '#dcfce7',
                      color: '#166534',
                      padding: '4px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {score} % Match
                  </span>
                </div>

                <strong style={{ fontSize: 18, display: 'block', marginBottom: 6 }}>
                  {family.familyName}
                </strong>
                <p style={{ fontSize: 13, color: '#475569', margin: '0 0 12px 0' }}>{family.bio}</p>

                <div style={{ fontSize: 12, marginBottom: 8 }}>
                  <strong>👨‍👩‍👧 Aikuiset:</strong>{' '}
                  {family.adults.map((a) => `${a.name} (${a.role})`).join(', ')}
                </div>

                <div style={{ fontSize: 12, marginBottom: 12 }}>
                  <strong>🧒 Lapset:</strong>{' '}
                  {family.children
                    .map((c) => `${c.age} v (${genderLabel(c.gender)}: ${c.tags.join(', ')})`)
                    .join(' · ')}
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                  {family.parentInterests.map((tag) => {
                    const isShared = sharedParentTags.includes(tag) || sharedChildTags.includes(tag)
                    return (
                      <span
                        key={tag}
                        style={{
                          fontSize: 11,
                          padding: '3px 9px',
                          borderRadius: 999,
                          background: isShared ? '#fef9c3' : '#f1f5f9',
                          color: isShared ? '#854d0e' : '#475569',
                          fontWeight: isShared ? 700 : 500,
                        }}
                      >
                        {isShared ? `★ ${tag}` : tag}
                      </span>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {isMatched ? (
                  <div
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: 10,
                      background: '#dcfce7',
                      color: '#166534',
                      textAlign: 'center',
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    💚 Match! Ehdotetaan yhteistä tapahtumaa...
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setPassed((p) => [...p, family.id])}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: 10,
                        border: '1px solid #cbd5e1',
                        background: '#fff',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      ✕ Ohita
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMatch(family.id)}
                      style={{
                        flex: 2,
                        padding: '10px',
                        borderRadius: 10,
                        border: 'none',
                        background: '#166534',
                        color: '#fff',
                        cursor: 'pointer',
                        fontWeight: 700,
                      }}
                    >
                      💚 Verkostoidu
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}