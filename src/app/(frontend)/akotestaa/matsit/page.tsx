'use client'

import React, { useState, useEffect } from 'react'

interface FamilyProfile {
  id: string
  name: string
  location: string
  distanceKm: number
  childrenAges: string
  interests: string[]
  bio: string
  sharedEvent?: string
  preLikedUs?: boolean // Määrittää demossa, onko tämä perhe jo tykännyt meistä
}

interface MatchRecord {
  targetFamily: FamilyProfile
  status: 'liked' | 'passed' | 'matched'
  timestamp: string
}

const DEMO_FAMILIES: FamilyProfile[] = [
  {
    id: 'fam-201',
    name: 'Virtasen perhe',
    location: 'Tapiola, Espoo',
    distanceKm: 3.2,
    childrenAges: '6v ja 9v',
    interests: ['Ulkoilu', 'Lautapelit', 'Juniorijalkapallo'],
    bio: 'Etsitään viikonloppuisin peliseuraa ja samanhenkisiä perheitä mukaan puistoretkille sekä kentän laidalle.',
    sharedEvent: 'Lasten lauantaidisko @ Kulttuurikeskus',
    preLikedUs: true,
  },
  {
    id: 'fam-202',
    name: 'Mäkisen perhe',
    location: 'Leppävaara, Espoo',
    distanceKm: 5.8,
    childrenAges: '8v ja 11v',
    interests: ['Tiedekeskukset', 'Pyöräily', 'Kokkailu'],
    bio: 'Kiinnostaa erityisesti Heureka-reissut, museot ja yhteiset pyörälenkit rantaraitilla.',
    sharedEvent: 'Perheiden koodauspaja @ Oodi',
    preLikedUs: false,
  },
  {
    id: 'fam-203',
    name: 'Korhosen perhe',
    location: 'Kauniainen',
    distanceKm: 2.1,
    childrenAges: '7v ja 10v',
    interests: ['Luistelu', 'Metsäretket', 'Nuotioruoka'],
    bio: 'Kaivataan seuraa Kasavuoren ja Nuuksion nuotioretkille sekä talvisin tekojään laidalle.',
    sharedEvent: 'Koko perheen ulkoilupäivä @ Oittaa',
    preLikedUs: true,
  },
  {
    id: 'fam-204',
    name: 'Niemisen perhe',
    location: 'Matinkylä, Espoo',
    distanceKm: 6.4,
    childrenAges: '5v ja 8v',
    interests: ['Uimahalli', 'Askartelu', 'Kirjastot'],
    bio: 'Rauhallista menoa, askartelupajoja ja viikonloppuaamujen uimahallireissuja.',
    preLikedUs: false,
  },
]

const STORAGE_KEY = 'ako_proto_family_matches_v1'

export default function AkoTestaaMatsitPage() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [records, setRecords] = useState<MatchRecord[]>([])
  const [matchBanner, setMatchBanner] = useState<FamilyProfile | null>(null)
  const [forceAllMatches, setForceAllMatches] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [backendStatus, setBackendStatus] = useState<'idle' | 'ok' | 'local-fallback'>('idle')

  const loggedInFamilyId = 'fam-101' // Oma testiperhe
  const currentTarget = DEMO_FAMILIES[currentIndex]

  // Ladataan aiemmat testivalinnat selaimen muistista sivun avautuessa
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed: MatchRecord[] = JSON.parse(saved)
        setRecords(parsed)
        setCurrentIndex(parsed.length)
      }
    } catch {
      // Ohitetaan lukuongelmat
    }
  }, [])

  const saveRecords = (nextRecords: MatchRecord[]) => {
    setRecords(nextRecords)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords))
    } catch {
      // Ohitetaan tallennusongelmat
    }
  }

  const handleSwipe = async (action: 'liked' | 'passed') => {
    if (!currentTarget || isSubmitting) return
    setIsSubmitting(true)
    setMatchBanner(null)

    let isMatch = false

    try {
      // 1. Yritetään kutsua oikeaa Payload CMS / Next.js API-reittiä (/api/match)
      const res = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromFamilyId: loggedInFamilyId,
          toFamilyId: currentTarget.id,
          action,
        }),
      }).catch(() => null)

      if (res && res.ok) {
        const data = await res.json()
        isMatch = Boolean(data.match)
        setBackendStatus('ok')
      } else {
        // 2. Jos API-reitti ei ole vielä ajossa, käytetään demolippua (preLikedUs tai pakotettu match)
        setBackendStatus('local-fallback')
        if (action === 'liked' && (currentTarget.preLikedUs || forceAllMatches)) {
          isMatch = true
        }
      }
    } finally {
      const finalStatus: MatchRecord['status'] =
        action === 'passed' ? 'passed' : isMatch ? 'matched' : 'liked'

      const newEntry: MatchRecord = {
        targetFamily: currentTarget,
        status: finalStatus,
        timestamp: new Date().toLocaleTimeString('fi-FI', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      }

      const updated = [newEntry, ...records]
      saveRecords(updated)

      if (isMatch) {
        setMatchBanner(currentTarget)
      }

      setIsSubmitting(false)
      setCurrentIndex((prev) => prev + 1)
    }
  }

  const resetDemo = () => {
    localStorage.removeItem(STORAGE_KEY)
    setRecords([])
    setCurrentIndex(0)
    setMatchBanner(null)
    setBackendStatus('idle')
  }

  const matchedFamilies = records.filter((r) => r.status === 'matched')

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* YLÄNAVIGAATIO (/akotestaa-ympäristölle) */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono text-xs font-semibold">
              ako-coreproto
            </span>
            <span className="text-sm font-semibold tracking-tight">
              Gather // Perhemätsäys Demo
            </span>
          </div>

          <nav className="flex items-center gap-5 text-xs sm:text-sm">
            <a
              href="/"
              className="text-slate-300 hover:text-white transition-colors"
            >
              ← GatherEvents (Pääsivu)
            </a>
            <a
              href="/akotestaa/kartta"
              className="text-amber-300 hover:text-amber-200 transition-colors"
            >
              🗺️ /akotestaa/kartta
            </a>
            <a
              href="/akotestaa/matsit"
              className="text-emerald-400 font-bold underline underline-offset-4"
            >
              🤝 /akotestaa/matsit
            </a>
          </nav>
        </div>
      </header>

      {/* KEHITYS- JA DEMOKONTROLLIPANEELI */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-900">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span>
              <strong>Tila:</strong> Kortti {Math.min(currentIndex + 1, DEMO_FAMILIES.length)} /{' '}
              {DEMO_FAMILIES.length}
            </span>
            <span className="text-amber-400">|</span>
            <span>
              <strong>Tallennus:</strong>{' '}
              {backendStatus === 'ok'
                ? '🟢 Payload API (/api/match)'
                : backendStatus === 'local-fallback'
                ? '🟡 LocalStorage + Demo-vastatykkäys'
                : '⚪ Valmiina'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={forceAllMatches}
                onChange={(e) => setForceAllMatches(e.target.checked)}
                className="rounded border-amber-400"
              />
              Pakota jokaisesta tykkäyksestä Match
            </label>
            <button
              onClick={resetDemo}
              className="px-2.5 py-1 bg-amber-200/70 hover:bg-amber-300 text-amber-950 rounded font-semibold transition-colors"
            >
              Nollaa demokierros
            </button>
          </div>
        </div>
      </div>

      {/* PÄÄSISÄLTÖ: Vasemmalla Tinder-kortti, oikealla osumat ja kantatilanne */}
      <main className="max-w-5xl mx-auto w-full px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
        {/* VASEMman PUOLEN KORTTINÄKYMÄ (7 saraketta) */}
        <section className="lg:col-span-7 flex flex-col">
          {/* Osumabanneri */}
          {matchBanner && (
            <div className="mb-5 p-4 bg-emerald-600 text-white rounded-2xl shadow-md flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider font-bold text-emerald-100">
                  It&apos;s a Family Match!
                </div>
                <div className="text-base font-bold mt-0.5">
                  🎉 {matchBanner.name} haluaa myös verkostoitua teidän kanssanne!
                </div>
              </div>
              <button
                onClick={() => setMatchBanner(null)}
                className="text-xs bg-emerald-700 hover:bg-emerald-800 px-3 py-1.5 rounded-lg font-semibold"
              >
                Sulje
              </button>
            </div>
          )}

          {currentTarget ? (
            <div className="bg-white rounded-3xl shadow-md border border-slate-200 overflow-hidden flex flex-col justify-between">
              {/* Kortin yläosa */}
              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap justify-between items-start gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                        {currentTarget.name}
                      </h1>
                      {currentTarget.preLikedUs && (
                        <span
                          title="Tämä perhe on jo tykännyt teistä demokannassa"
                          className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium"
                        >
                          Tykkäsi jo teistä
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      📍 {currentTarget.location} ({currentTarget.distanceKm} km päässä)
                    </p>
                  </div>

                  <span className="text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-3.5 py-1.5 rounded-full">
                    👧👦 Lapset: {currentTarget.childrenAges}
                  </span>
                </div>

                {/* Yhteinen tapahtumanosto */}
                {currentTarget.sharedEvent && (
                  <div className="mt-5 p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center justify-between gap-2">
                    <div className="text-xs text-blue-900">
                      <span className="font-semibold">📅 Menossa samaan tapahtumaan:</span>{' '}
                      {currentTarget.sharedEvent}
                    </div>
                    <span className="text-[11px] bg-blue-600 text-white px-2 py-0.5 rounded font-semibold shrink-0">
                      Yhteinen kiinnostus
                    </span>
                  </div>
                )}

                {/* Perheen kuvaus */}
                <p className="mt-5 text-slate-700 text-base leading-relaxed">
                  {currentTarget.bio}
                </p>

                {/* Kiinnostuksen kohteet */}
                <div className="mt-6">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Perheen kiinnostuksen kohteet
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {currentTarget.interests.map((interest) => (
                      <span
                        key={interest}
                        className="text-xs bg-slate-100 text-slate-800 px-3 py-1.5 rounded-lg font-medium"
                      >
                        #{interest}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Toimintopainikkeet */}
              <div className="bg-slate-50 px-6 py-5 border-t border-slate-200 grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleSwipe('passed')}
                  disabled={isSubmitting}
                  className="py-3.5 px-4 rounded-2xl border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  ✕ Ohita
                </button>
                <button
                  onClick={() => handleSwipe('liked')}
                  disabled={isSubmitting}
                  className="py-3.5 px-4 rounded-2xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-sm transition-colors disabled:opacity-50"
                >
                  💚 Verkostoidu
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center shadow-sm">
              <div className="text-4xl mb-3">✨</div>
              <h2 className="text-xl font-bold text-slate-900">
                Kaikki lähialueen perheet käyty läpi!
              </h2>
              <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
                Voit tarkastella syntyneitä perheosumia oikeanpuoleisesta paneelista tai nollata
                demokierroksen testataksesi uudelleen.
              </p>
              <button
                onClick={resetDemo}
                className="mt-6 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800"
              >
                Palauta korttipakka alkuun
              </button>
            </div>
          )}
        </section>

        {/* OIKEAN PUOLEN PANEELI: Syntyneet osumat ja tietokantaloki (5 saraketta) */}
        <aside className="lg:col-span-5 flex flex-col gap-6">
          {/* 1. Syntyneet perhemätsit */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-900">
                Syntyneet perheosumat ({matchedFamilies.length})
              </h2>
              <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full font-semibold">
                status: matched
              </span>
            </div>

            {matchedFamilies.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center border border-dashed border-slate-200 rounded-xl">
                Ei vielä osumia. Paina &quot;Verkostoidu&quot; perheen kohdalla!
              </p>
            ) : (
              <ul className="space-y-3">
                {matchedFamilies.map((item, idx) => (
                  <li
                    key={`${item.targetFamily.id}-${idx}`}
                    className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold text-sm text-slate-900">
                        {item.targetFamily.name}
                      </div>
                      <div className="text-xs text-slate-600">
                        {item.targetFamily.location} • Lapset {item.targetFamily.childrenAges}
                      </div>
                    </div>
                    <span className="text-xs font-semibold bg-emerald-600 text-white px-2.5 py-1 rounded-lg">
                      Viestittele
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 2. Tietokantaloki (Mitä kantaan on tallennettu) */}
          <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 shadow-sm font-mono text-xs">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
              <span className="font-bold text-emerald-400">
                Collection: family-matches
              </span>
              <span className="text-slate-400">{records.length} riviä</span>
            </div>

            {records.length === 0 ? (
              <div className="text-slate-500 py-3">
                // Odottaa ensimmäistä pyyhkäisyä...
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {records.map((rec, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded bg-slate-800/90 border border-slate-700 flex flex-col gap-1"
                  >
                    <div className="flex justify-between">
                      <span className="text-slate-300">
                        {loggedInFamilyId} → {rec.targetFamily.id}
                      </span>
                      <span
                        className={
                          rec.status === 'matched'
                            ? 'text-emerald-400 font-bold'
                            : rec.status === 'liked'
                            ? 'text-blue-400'
                            : 'text-slate-400'
                        }
                      >
                        [{rec.status.toUpperCase()}]
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex justify-between">
                      <span>{rec.targetFamily.name}</span>
                      <span>{rec.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  )
}