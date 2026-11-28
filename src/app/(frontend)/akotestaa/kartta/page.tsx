'use client'

import React, { useEffect, useRef, useState } from 'react'
import { PKS_AREAS } from '../shellproto/pksAreas'

interface MatchedFamilyPin {
  id: string
  name: string
  location: string
  childrenAges: string
  sharedEvent?: string
  coords: [number, number]
}

interface EventPin {
  id: string
  title: string
  venue: string
  time: string
  coords: [number, number]
}

// Pääkaupunkiseudun oletusrajaus: Kirkkonummen itäreuna -> Vantaa / Länsi-Sipoo
const PKS_BOUNDS_COORDS: [[number, number], [number, number]] = [
  [60.115, 24.52], // Lounais (SW)
  [60.325, 25.18], // Koillinen (NE)
]

// Kiinteät koordinaatit demoperheille Espoon ja Kauniaisten alueella
const FAMILY_COORDINATES: Record<string, [number, number]> = {
  'fam-201': [60.1756, 24.8053], // Virtasen perhe (Tapiola)
  'fam-202': [60.2189, 24.8124], // Mäkisen perhe (Leppävaara)
  'fam-203': [60.2114, 24.7265], // Korhosen perhe (Kauniainen)
  'fam-204': [60.1598, 24.7384], // Niemisen perhe (Matinkylä)
  bdh283:
    PKS_AREAS.find((area) => area.city === 'Espoo' && area.name === 'Leppävaara')?.coords ??
    [60.2188, 24.8124],
}

// Tapahtumien sijainnit (samat otsikot kuin /akotestaa/matsit-sivulla)
const DEMO_EVENTS: EventPin[] = [
  {
    id: 'evt-301',
    title: 'Lasten lauantaidisko @ Kulttuurikeskus',
    venue: 'Espoon kulttuurikeskus, Tapiola',
    time: 'La klo 14:00–16:30',
    coords: [60.1773, 24.8042],
  },
  {
    id: 'evt-302',
    title: 'Koko perheen ulkoilupäivä @ Oittaa',
    venue: 'Oittaan ulkoilualue, Espoo',
    time: 'Su klo 11:00–15:00',
    coords: [60.2392, 24.6565],
  },
  {
    id: 'evt-303',
    title: 'Perheiden koodauspaja @ Oodi',
    venue: 'Keskustakirjasto Oodi, Helsinki',
    time: 'La klo 12:00–14:00',
    coords: [60.1741, 24.9382],
  },
]

const STORAGE_KEY = 'ako_proto_family_matches_v1'

export default function KarttaTestiPage() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const familyLayerRef = useRef<any>(null)
  const eventLayerRef = useRef<any>(null)

  const familyMarkerMapRef = useRef<Record<string, any>>({})
  const eventMarkerMapRef = useRef<Record<string, any>>({})

  const [status, setStatus] = useState('Pääkaupunkiseutu (Helsinki, Espoo, Vantaa)')
  const [matchedPins, setMatchedPins] = useState<MatchedFamilyPin[]>([])

  // 1. Luetaan syntyneet perheosumat localStoragesta
  const loadMatchesFromStorage = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        setMatchedPins([])
        return
      }
      const records = JSON.parse(raw)
      const matches: MatchedFamilyPin[] = []
      const seenIds = new Set<string>()

      for (const rec of records) {
        if (rec.status === 'matched' && rec.targetFamily?.id) {
          const famId = rec.targetFamily.id
          if (!seenIds.has(famId)) {
            seenIds.add(famId)
            matches.push({
              id: famId,
              name: rec.targetFamily.name,
              location: rec.targetFamily.location,
              childrenAges: rec.targetFamily.childrenAges,
              sharedEvent: rec.targetFamily.sharedEvent,
              coords: FAMILY_COORDINATES[famId] || [60.2055, 24.6559],
            })
          }
        }
      }
      setMatchedPins(matches)
    } catch (e) {
      console.error('Virhe mätsien luvussa kartalle:', e)
    }
  }

  // 2. Piirretään sekä tapahtumat (siniset) että mätsätyt perheet (vihreät)
  const renderMapLayers = () => {
    const L = (window as any).L
    if (!L || !mapInstance.current) return

    if (!eventLayerRef.current) {
      eventLayerRef.current = L.layerGroup().addTo(mapInstance.current)
    } else {
      eventLayerRef.current.clearLayers()
    }

    if (!familyLayerRef.current) {
      familyLayerRef.current = L.layerGroup().addTo(mapInstance.current)
    } else {
      familyLayerRef.current.clearLayers()
    }

    eventMarkerMapRef.current = {}
    familyMarkerMapRef.current = {}

    // A) Tapahtumat sinisillä ympyrämarkkereilla
    DEMO_EVENTS.forEach((evt) => {
      const interestedMatches = matchedPins.filter((f) => f.sharedEvent === evt.title)

      const evtMarker = L.circleMarker(evt.coords, {
        radius: 11,
        fillColor: '#2563eb',
        color: '#ffffff',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.95,
      }).addTo(eventLayerRef.current)

      const matchedNamesHtml =
        interestedMatches.length > 0
          ? `<div style="margin-top: 6px; padding: 5px 7px; background: #ecfdf5; border: 1px solid #6ee7b7; border-radius: 6px; font-size: 11px; color: #065f46;">
               🤝 <strong>Mätsätyt perheet mukana:</strong><br/>
               ${interestedMatches.map((m) => m.name).join(', ')}
             </div>`
          : `<div style="margin-top: 6px; font-size: 11px; color: #64748b;">
               Ei vielä mätsättyjä perheitä tässä tapahtumassa.
             </div>`

      const evtPopupHtml = `
        <div style="font-family: sans-serif; min-width: 200px; padding: 2px;">
          <div style="font-size: 11px; font-weight: 700; color: #2563eb; text-transform: uppercase;">
            📅 Tapahtuma
          </div>
          <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 2px;">
            ${evt.title}
          </div>
          <div style="font-size: 12px; color: #475569; margin-top: 2px;">
            📍 ${evt.venue}<br/>🕒 ${evt.time}
          </div>
          ${matchedNamesHtml}
        </div>
      `

      evtMarker.bindPopup(evtPopupHtml)
      eventMarkerMapRef.current[evt.id] = evtMarker
    })

    // B) Mätsätyt perheet vihreillä ympyrämarkkereilla
    matchedPins.forEach((fam) => {
      const famMarker = L.circleMarker(fam.coords, {
        radius: 12,
        fillColor: '#059669',
        color: '#ffffff',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.95,
      }).addTo(familyLayerRef.current)

      const famPopupHtml = `
        <div style="font-family: sans-serif; min-width: 190px; padding: 2px;">
          <div style="font-size: 11px; font-weight: 700; color: #059669; text-transform: uppercase;">
            🤝 Perheosuma (Matched)
          </div>
          <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-top: 2px;">
            ${fam.name}
          </div>
          <div style="font-size: 12px; color: #475569; margin-top: 2px;">
            📍 ${fam.location} • Lapset: ${fam.childrenAges}
          </div>
          ${
            fam.sharedEvent
              ? `<div style="margin-top: 6px; padding: 4px 6px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; font-size: 11px; color: #1e40af;">
                   📅 <strong>Menossa tapahtumaan:</strong><br/>${fam.sharedEvent}
                 </div>`
              : ''
          }
        </div>
      `

      famMarker.bindPopup(famPopupHtml)
      familyMarkerMapRef.current[fam.id] = famMarker
    })
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    loadMatchesFromStorage()

    const initMap = () => {
      const L = (window as any).L
      if (!L || !mapRef.current || mapInstance.current) return

      // 1. Sallitaan portaaton neljänneszoomaus, jotta PKS-rajaus istuu tarkasti ruutuun
      mapInstance.current = L.map(mapRef.current, {
        zoomSnap: 0.25,
        zoomDelta: 0.5,
      })

      // 2. Rajataan oletusnäkymä kattamaan Helsinki, Espoo, Vantaa sekä reunamilta Kirkkonummi & Sipoo
      const pksBounds = L.latLngBounds(PKS_BOUNDS_COORDS[0], PKS_BOUNDS_COORDS[1])
      mapInstance.current.fitBounds(pksBounds, { padding: [20, 20] })

      // 3. Lisätään Esrin avoin karttataso
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles © Esri — Source: Esri, OpenStreetMap contributors',
          maxZoom: 19,
        },
      ).addTo(mapInstance.current)

      L.marker([60.2055, 24.6559])
        .addTo(mapInstance.current)
        .bindPopup('<strong>Oma oletussijainti:</strong> Espoon keskus')

      renderMapLayers()
    }

    if ((window as any).L) {
      initMap()
      return
    }

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    const existingScript = document.getElementById('leaflet-js') as HTMLScriptElement | null
    if (existingScript) {
      existingScript.addEventListener('load', initMap)
      return
    }

    const script = document.createElement('script')
    script.id = 'leaflet-js'
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.async = true
    script.onload = initMap
    document.body.appendChild(script)
  }, [])

  // Päivitetään karttatasot aina kun mätsätyt perheet latautuvat
  useEffect(() => {
    renderMapLayers()
  }, [matchedPins])

  const focusFamilyOnMap = (fam: MatchedFamilyPin) => {
    if (!mapInstance.current) return
    mapInstance.current.setView(fam.coords, 14)
    const marker = familyMarkerMapRef.current[fam.id]
    if (marker) marker.openPopup()
    setStatus(`Perheosuma: ${fam.name} (${fam.location})`)
  }

  const focusEventOnMap = (evt: EventPin) => {
    if (!mapInstance.current) return
    mapInstance.current.setView(evt.coords, 14)
    const marker = eventMarkerMapRef.current[evt.id]
    if (marker) marker.openPopup()
    setStatus(`Tapahtuma: ${evt.title}`)
  }

  const locateMe = () => {
    if (!navigator.geolocation || !mapInstance.current) return
    setStatus('Paikannetaan...')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setStatus(`Oma sijainti: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
        mapInstance.current.setView([latitude, longitude], 14)

        const L = (window as any).L
        if (L) {
          L.marker([latitude, longitude])
            .addTo(mapInstance.current)
            .bindPopup('Oma nykyinen sijaintisi')
            .openPopup()
        }
      },
      () => setStatus('Paikannus estetty'),
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* YLÄNAVIGAATIO */}
      <header className="bg-slate-900 text-white border-b border-slate-800 shrink-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono text-xs font-semibold">
              ako-coreproto
            </span>
            <span className="text-sm font-semibold tracking-tight">
              Gather // Tapahtuma- ja perhekartta
            </span>
          </div>

          <nav className="flex items-center gap-5 text-xs sm:text-sm">
            <a href="/" className="text-slate-300 hover:text-white transition-colors">
              ← GatherEvents (Pääsivu)
            </a>
            <a
              href="/akotestaa/kartta"
              className="text-amber-300 font-bold underline underline-offset-4"
            >
              🗺️ /akotestaa/kartta
            </a>
            <a
              href="/akotestaa/matsit"
              className="text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              🤝 /akotestaa/matsit ({matchedPins.length})
            </a>
          </nav>
        </div>
      </header>

      <div
        role="note"
        className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900"
      >
        Demokartta: synteettiset perheet ja selaimeen tallennetut demomätsit eivät ole
        PostgreSQL-käyttäjätietoja.
      </div>

      {/* KARTTA-ALUE */}
      <div style={{ position: 'relative', flex: 1, width: '100%' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

        {/* ALAPANEELI: Tapahtumat, Mätsätyt perheet ja Paikannus/Palautus */}
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: 16,
            right: 16,
            zIndex: 1000,
            background: '#ffffff',
            padding: 16,
            borderRadius: 14,
            boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {/* Rivi 1: Tapahtumat (siniset) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              borderBottom: '1px solid #f1f5f9',
              paddingBottom: 8,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1e3a8a' }}>
              🔵 Tapahtumat ({DEMO_EVENTS.length}):
            </span>
            {DEMO_EVENTS.map((evt) => (
              <button
                key={evt.id}
                type="button"
                onClick={() => focusEventOnMap(evt)}
                style={{
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #93c5fd',
                  padding: '4px 10px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                📅 {evt.title.split('@')[1]?.trim() || evt.title}
              </button>
            ))}
          </div>

          {/* Rivi 2: Mätsätyt perheet (vihreät) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: 8,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: '#064e3b' }}>
              🟢 Perheosumat ({matchedPins.length}):
            </span>
            {matchedPins.length === 0 ? (
              <a
                href="/akotestaa/matsit"
                style={{ fontSize: 12, color: '#059669', textDecoration: 'underline' }}
              >
                Ei vielä osumia — käy mätsäämässä perheitä /akotestaa/matsit-sivulla →
              </a>
            ) : (
              matchedPins.map((fam) => (
                <button
                  key={fam.id}
                  type="button"
                  onClick={() => focusFamilyOnMap(fam)}
                  style={{
                    background: '#ecfdf5',
                    color: '#065f46',
                    border: '1px solid #6ee7b7',
                    padding: '4px 10px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  🤝 {fam.name} ({fam.location.split(',')[0]})
                </button>
              ))
            )}
          </div>

          {/* Rivi 3: Status ja GPS-paikannus */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <span style={{ fontSize: 13, color: '#334155', fontWeight: 500 }}>{status}</span>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={locateMe}
                style={{
                  background: '#166534',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Paikanna minut
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
