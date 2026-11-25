'use client'

import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { authSession } from '@/lib/app-session-browser'

const FEED_URL = 'https://eventpulsebyjunailijat.ai.studio/api/events/feed.jsonld'
const EVENTPULSE_ORIGIN = 'https://eventpulsebyjunailijat.ai.studio'

export interface SavedLocation {
  address: string
  city: string
  district: string
  lat: number
  lng: number
}

const DEFAULT_LOCATION: SavedLocation = {
  address: 'Espoo',
  city: 'Espoo',
  district: 'Espoo',
  lat: 60.2055,
  lng: 24.6559,
}

type EventFeedItem = {
  '@id': string
  name: string
  description: string
  startDate: string
  isAccessibleForFree?: boolean
  typicalAgeRange?: string
  keywords?: string[]
  url: string
  location?: {
    name?: string
    address?: { addressLocality?: string; addressRegion?: string; streetAddress?: string }
  }
  organizer?: { name?: string }
}

interface ChildProfile {
  id: string
  age: number
  gender: 'boy' | 'girl' | 'unspecified'
  tags: string[]
}

interface AdultMember {
  id: string
  name: string
  role: 'Vanhempi' | 'Isovanhempi' | 'Läheinen'
}

interface FamilyProfile {
  id: string
  familyName: string
  bio: string
  city: string
  district: string
  adults: AdultMember[]
  children: ChildProfile[]
  parentInterests: string[]
}

const KNOWN_PLACES: Record<string, [number, number]> = {
  'töölön kirkko': [60.1797, 24.9213],
  'temppeliaukion kirkko': [60.173, 24.9252],
  'meilahden kirkko': [60.1912, 24.9041],
  fokus: [60.1988, 24.9304],
  tripla: [60.1988, 24.9304],
  taivallahden: [60.1755, 24.9135],
  töölö: [60.178, 24.92],
  sello: [60.2183, 24.8124],
  tapiola: [60.176, 24.8047],
  'iso omena': [60.1618, 24.7384],
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
    familyName: 'Mäkisen & Laineen perhe',
    bio: 'Kulttuuria, museoita ja lautapelejä. Isoäiti ja kummi usein mukana viikonloppumenossa!',
    city: 'Helsinki',
    district: 'Töölö',
    adults: [
      { id: 'a4', name: 'Laura', role: 'Vanhempi' },
      { id: 'a5', name: 'Noora-kummi', role: 'Läheinen' },
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
  bio: 'Etsitään mukavaa seuraa tapahtumiin ja harrastuksiin.',
  city: 'Espoo',
  district: 'Espoo',
  adults: [{ id: 'me-1', name: 'Minä', role: 'Vanhempi' }],
  children: [{ id: 'child-1', age: 12, gender: 'boy', tags: ['Jalkapallo'] }],
  parentInterests: ['Kahviseura', 'Juniorijalkapallo', 'Juoksu & Kuntosali'],
}

function formatEventDate(value: string) {
  const date = new Date(value)
  return {
    day: new Intl.DateTimeFormat('fi-FI', { day: '2-digit' }).format(date),
    month: new Intl.DateTimeFormat('fi-FI', { month: 'short' })
      .format(date)
      .replace('.', '')
      .toUpperCase(),
    long: new Intl.DateTimeFormat('fi-FI', {
      weekday: 'short',
      day: 'numeric',
      month: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date),
  }
}

// PÄÄEXPORT HETI YLHÄÄLLÄ
export function GatherEvents() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [userLocation, setUserLocation] = useState<SavedLocation>(DEFAULT_LOCATION)

  return (
    <div className="site-shell">
      <header className="header" style={{ position: 'relative', zIndex: 100000 }}>
        <a className="brand" href="/" aria-label="Gather etusivu">
          gather<span>.</span>
        </a>
        <nav className={menuOpen ? 'nav open' : 'nav'} aria-label="Päänavigaatio">
          <a className="active" href="#kartta" onClick={() => setMenuOpen(false)}>
            Kartta & Alue
          </a>
          <a href="#perhe-match" onClick={() => setMenuOpen(false)}>
            Perhe-Match
          </a>
          <a href="#json-tapahtumat" onClick={() => setMenuOpen(false)}>
            Tapahtumat
          </a>
          <a href="#tapahtumat" onClick={() => setMenuOpen(false)}>
            Kalenteri
          </a>
        </nav>
        <div className="header-actions" style={{ position: 'relative', zIndex: 100001 }}>
          <UserProfileMenu onLocationChange={setUserLocation} />
          <button
            className="icon-button menu-button"
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Valikko"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </header>

      <div
        role="note"
        className="mx-auto mt-3 w-full max-w-7xl rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      >
        Demotila: kotialue, demo-profiili ja mätsäysvalinnat tallentuvat vain tähän selaimeen, eivät
        PostgreSQL:ään. Älä syötä oikeaa kotiosoitetta tai muita henkilötietoja.
      </div>

      <main>
        <JsonEventFeed userLocation={userLocation} />
        <FamilyMatcher userLocation={userLocation} />
        <section className="events-embed-section" id="tapahtumat">
          <div className="embed-heading">
            <div>
              <p className="eyebrow">EventPulse · Koko kalenteri</p>
              <h2>EventPulse-tapahtumakalenteri</h2>
            </div>
          </div>
          <div className="embed-frame">
            <iframe
              src={`${EVENTPULSE_ORIGIN}/embed/events?lang=fi&theme=light`}
              title="EventPulse Events"
              width="100%"
              height={900}
              style={{ height: '900px', border: 'none' }}
              loading="lazy"
            />
          </div>
        </section>
      </main>
    </div>
  )
}

export default GatherEvents

function UserProfileMenu({ onLocationChange }: { onLocationChange: (loc: SavedLocation) => void }) {
  const session = useSyncExternalStore(
    authSession.subscribe,
    authSession.getSnapshot,
    authSession.getServerSnapshot,
  ) as any

  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SavedLocation[]>([])
  const [saved, setSaved] = useState<SavedLocation | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'Oma profiili'

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    const raw = localStorage.getItem('gather_user_location')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        setSaved(parsed)
        setQuery(parsed.address)
        onLocationChange(parsed)
      } catch {}
    }
  }, [onLocationChange])

  useEffect(() => {
    if (query.trim().length < 3 || saved?.address === query) {
      setSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&bbox=19.0,59.5,31.6,70.1&lat=60.2055&lon=24.6559`,
        )
        const data = await res.json()
        const list: SavedLocation[] = (data.features || []).map((f: any) => {
          const p = f.properties
          const street = [p.street, p.housenumber].filter(Boolean).join(' ')
          const city = p.city || p.town || p.municipality || 'Espoo'
          const district = p.district || p.suburb || p.name || street || city
          const address = [p.name !== street ? p.name : '', street, city].filter(Boolean).join(', ')
          return {
            address: address || `${district}, ${city}`,
            city,
            district,
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
          }
        })
        setSuggestions(list)
      } catch {
        setSuggestions([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, saved])

  const selectLoc = (loc: SavedLocation) => {
    setSaved(loc)
    setQuery(loc.address)
    setSuggestions([])
    localStorage.setItem('gather_user_location', JSON.stringify(loc))
    onLocationChange(loc)
    setIsOpen(false)
  }

  const handleSignOut = async () => {
    try {
      if (typeof (authSession as any).signOut === 'function') await (authSession as any).signOut()
      else if (typeof (authSession as any).logout === 'function')
        await (authSession as any).logout()
      else {
        await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
        window.location.href = '/'
      }
    } catch {
      window.location.href = '/'
    }
  }

  return (
    <div ref={menuRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        className="button"
        style={{ borderRadius: 999, padding: '8px 14px', background: '#fff', fontWeight: 600 }}
      >
        👤 {userName} · {saved ? saved.city : 'Aseta alue'} {isOpen ? '▲' : '▼'}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: 320,
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 12px 32px rgba(0,0,0,0.16)',
            border: '1px solid #e2e8f0',
            padding: 16,
            zIndex: 9999,
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{userName}</div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            Kotiosoite tai kaupunginosa
          </label>
          <input
            name="street-address"
            type="text"
            autoComplete="street-address"
            placeholder="Esim. Leppävaara tai Ajomiehenkuja..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              if (saved) setSaved(null)
            }}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid #94a3b8',
            }}
          />
          {suggestions.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => selectLoc(item)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px',
                border: 'none',
                borderBottom: '1px solid #f1f5f9',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              📍 {item.address}
            </button>
          ))}
          {saved && (
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: '#166534',
                background: '#f0fdf4',
                padding: '6px 8px',
                borderRadius: 6,
              }}
            >
              ✓ Alue: <strong>{saved.city}</strong>
            </div>
          )}
          <hr style={{ margin: '12px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />
          <button
            type="button"
            onClick={handleSignOut}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #fecaca',
              background: '#fef2f2',
              color: '#b91c1c',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Kirjaudu ulos
          </button>
        </div>
      )}
    </div>
  )
}

function findFallbackCoords(text: string): [number, number] | null {
  const lower = text.toLocaleLowerCase('fi')
  for (const [key, coords] of Object.entries(KNOWN_PLACES)) {
    if (lower.includes(key)) return coords
  }
  return null
}

function DefaultAddressMap({
  userLocation,
  events,
}: {
  userLocation: SavedLocation
  events: EventFeedItem[]
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const layerRef = useRef<any>(null)
  const [ready, setReady] = useState(false)
  const [plottedCount, setPlottedCount] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if ((window as any).L) {
      setReady(true)
      return
    }
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.async = true
    script.onload = () => setReady(true)
    document.body.appendChild(script)
  }, [])

  useEffect(() => {
    if (!ready || !mapRef.current) return
    const L = (window as any).L
    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current).setView([userLocation.lat, userLocation.lng], 12)
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        { attribution: 'Tiles © Esri', maxZoom: 19 },
      ).addTo(mapInstance.current)
      layerRef.current = L.layerGroup().addTo(mapInstance.current)
    } else {
      mapInstance.current.setView([userLocation.lat, userLocation.lng], 12)
    }
  }, [ready, userLocation])

  useEffect(() => {
    if (!ready || !layerRef.current || !mapInstance.current) return
    const L = (window as any).L
    layerRef.current.clearLayers()

    L.circleMarker([userLocation.lat, userLocation.lng], {
      radius: 9,
      fillColor: '#2563eb',
      color: '#fff',
      weight: 3,
      fillOpacity: 1,
    })
      .bindPopup(`<b>🏠 Kotialueesi:</b><br/>${userLocation.address}`)
      .addTo(layerRef.current)

    let cancelled = false

    async function plotEvents() {
      const cache: Record<string, [number, number]> = JSON.parse(
        localStorage.getItem('gather_geo_cache_v3') || '{}',
      )
      const bounds: Array<[number, number]> = [[userLocation.lat, userLocation.lng]]
      let count = 0

      for (const ev of events.slice(0, 20)) {
        if (cancelled) break
        const fullText = `${ev.location?.name || ''} ${ev.name || ''} ${ev.description || ''}`
        let coords: [number, number] | null = findFallbackCoords(fullText)

        if (!coords) {
          const baseVenue = (ev.location?.name || '').split(/[,–—\-:/(]/)[0].trim()
          const query = [
            ev.location?.address?.streetAddress || baseVenue,
            ev.location?.address?.addressLocality || 'Helsinki',
          ]
            .filter(Boolean)
            .join(', ')
          if (cache[query]) {
            coords = cache[query]
          } else if (query) {
            try {
              const res = await fetch(
                `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lat=60.18&lon=24.92`,
              )
              const data = await res.json()
              const c = data?.features?.[0]?.geometry?.coordinates
              if (c) {
                coords = [c[1], c[0]]
                cache[query] = coords
                localStorage.setItem('gather_geo_cache_v3', JSON.stringify(cache))
              }
            } catch {}
          }
        }

        if (!coords) coords = [60.1797, 24.9213]

        if (coords && !cancelled && layerRef.current) {
          count++
          setPlottedCount(count)
          const d = formatEventDate(ev.startDate)
          const lat = coords[0] + (Math.random() - 0.5) * 0.0018
          const lng = coords[1] + (Math.random() - 0.5) * 0.0025
          bounds.push([lat, lng])

          L.marker([lat, lng])
            .bindPopup(
              `<b>${ev.name}</b><br/><small>${d.long} · ${ev.location?.name || 'Töölö'}</small><br/><a href="${ev.url}" target="_blank">Avaa tapahtuma →</a>`,
            )
            .addTo(layerRef.current)
        }
      }

      if (!cancelled && bounds.length > 1 && mapInstance.current) {
        mapInstance.current.fitBounds(bounds, { padding: [36, 36], maxZoom: 14 })
      }
    }

    setPlottedCount(0)
    plotEvents()
    return () => {
      cancelled = true
    }
  }, [ready, events, userLocation])

  return (
    <section className="json-feed-section" id="kartta" style={{ paddingTop: '2rem' }}>
      <div className="json-feed-heading">
        <div>
          <p className="eyebrow">Oletusnäkymä · Oma kotialue & tapahtumat</p>
          <h2>Kartta: {userLocation.address}</h2>
        </div>
        <p style={{ fontSize: 13, color: '#64748b' }}>
          Kartalla kotipisteesi sekä <strong>{plottedCount}</strong> paikannettua tapahtumaa.
        </p>
      </div>
      <div
        ref={mapRef}
        style={{ width: '100%', height: 420, borderRadius: 20, overflow: 'hidden' }}
      />
    </section>
  )
}

function JsonEventFeed({ userLocation }: { userLocation: SavedLocation }) {
  const [events, setEvents] = useState<EventFeedItem[]>([])
  const [query, setQuery] = useState('')
  const [onlyHomeArea, setOnlyHomeArea] = useState(true)

  useEffect(() => {
    fetch(`${FEED_URL}?refresh=${Date.now()}`)
      .then((r) => r.json())
      .then((d) =>
        setEvents(
          (d.itemListElement || [])
            .map((x: any) => x.item)
            .sort(
              (a: EventFeedItem, b: EventFeedItem) =>
                new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
            ),
        ),
      )
      .catch(() => {})
  }, [])

  const areaMatches = useMemo(() => {
    const city = userLocation.city.toLocaleLowerCase('fi')
    const district = userLocation.district.toLocaleLowerCase('fi')
    return events.filter((ev) => {
      const text = [
        ev.name,
        ev.description,
        ev.location?.name,
        ev.location?.address?.addressLocality,
        ev.location?.address?.addressRegion,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('fi')
      return text.includes(city) || (district && text.includes(district))
    })
  }, [events, userLocation])

  const effectiveOnlyHome = onlyHomeArea && areaMatches.length > 0

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('fi')
    const baseList = effectiveOnlyHome ? areaMatches : events
    if (!term) return baseList
    return baseList.filter((ev) =>
      [ev.name, ev.description, ev.location?.name, ev.organizer?.name]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('fi')
        .includes(term),
    )
  }, [events, areaMatches, query, effectiveOnlyHome])

  return (
    <>
      <DefaultAddressMap userLocation={userLocation} events={filtered} />
      <section className="json-feed-section" id="json-tapahtumat">
        <div className="json-feed-heading">
          <div>
            <p className="eyebrow">Tapahtumat alueellasi</p>
            <h2>
              {effectiveOnlyHome
                ? `Lähellä: ${userLocation.city} (${filtered.length})`
                : `Kaikki tapahtumat (${filtered.length})`}
            </h2>
            {onlyHomeArea && events.length > 0 && areaMatches.length === 0 && (
              <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                Alueelta "{userLocation.city}" ei löytynyt suoria osumia – näytetään kaikki
                lähialueen tapahtumat.
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={effectiveOnlyHome ? 'button primary' : 'button'}
              onClick={() => setOnlyHomeArea(true)}
            >
              Vain {userLocation.city} ({areaMatches.length})
            </button>
            <button
              type="button"
              className={!effectiveOnlyHome ? 'button primary' : 'button'}
              onClick={() => setOnlyHomeArea(false)}
            >
              Kaikki ({events.length})
            </button>
          </div>
        </div>

        <div className="feed-toolbar">
          <label className="feed-search">
            <span>Hae tapahtumista</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nimi, paikka tai järjestäjä"
            />
          </label>
        </div>

        <div className="feed-grid">
          {filtered.map((ev) => {
            const date = formatEventDate(ev.startDate)
            const region =
              ev.location?.address?.addressLocality ??
              ev.location?.address?.addressRegion ??
              'Helsinki'
            return (
              <a
                className="feed-card"
                href={ev.url}
                target="_blank"
                rel="noreferrer"
                key={ev['@id']}
              >
                <span className="feed-date">
                  <small>{date.month}</small>
                  <strong>{date.day}</strong>
                </span>
                <span className="feed-card-content">
                  <span className="feed-card-meta">
                    {region}
                    {ev.typicalAgeRange && ` · ${ev.typicalAgeRange}`}
                  </span>
                  <strong className="feed-card-title">{ev.name}</strong>
                  <span className="feed-card-description">{ev.description}</span>
                  <span className="feed-card-details">
                    <span>{date.long}</span>
                    <span>{ev.location?.name ?? region}</span>
                  </span>
                  <span className="feed-card-footer">
                    <span>{ev.organizer?.name ?? 'Tapahtuman järjestäjä'}</span>
                    <b>{ev.isAccessibleForFree ? 'Maksuton' : 'Katso hinta'}</b>
                  </span>
                </span>
                <span className="feed-card-arrow">→</span>
              </a>
            )
          })}
        </div>
      </section>
    </>
  )
}

function FamilyMatcher({ userLocation }: { userLocation: SavedLocation }) {
  const [activeTab, setActiveTab] = useState<'match' | 'profile'>('match')
  const [myFamily, setMyFamily] = useState<FamilyProfile>(DEFAULT_MY_FAMILY)
  const [matches, setMatches] = useState<string[]>([])
  const [passed, setPassed] = useState<string[]>([])

  const [newChildAge, setNewChildAge] = useState<string>('8')
  const [newChildGender, setNewChildGender] = useState<'boy' | 'girl' | 'unspecified'>('boy')
  const [newChildTags, setNewChildTags] = useState<string[]>([])
  const [newAdultName, setNewAdultName] = useState('')
  const [newAdultRole, setNewAdultRole] = useState<'Vanhempi' | 'Isovanhempi' | 'Läheinen'>(
    'Vanhempi',
  )

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
    const next = myFamily.parentInterests.includes(tag)
      ? myFamily.parentInterests.filter((t) => t !== tag)
      : [...myFamily.parentInterests, tag]
    saveFamily({ ...myFamily, parentInterests: next })
  }

  const handleAddAdult = () => {
    if (!newAdultName.trim()) return
    saveFamily({
      ...myFamily,
      adults: [
        ...myFamily.adults,
        { id: `a-${Date.now()}`, name: newAdultName.trim(), role: newAdultRole },
      ],
    })
    setNewAdultName('')
  }

  const handleAddChild = () => {
    const age = Number(newChildAge)
    if (!Number.isFinite(age) || age < 0 || age > 18) return
    saveFamily({
      ...myFamily,
      children: [
        ...myFamily.children,
        { id: `c-${Date.now()}`, age, gender: newChildGender, tags: newChildTags },
      ],
    })
    setNewChildTags([])
  }

  const scoredCandidates = useMemo(() => {
    const myChildTags = new Set(myFamily.children.flatMap((c) => c.tags))
    const myAges = myFamily.children.map((c) => c.age)

    return MOCK_FAMILIES.filter((f) => !passed.includes(f.id)).map((candidate) => {
      const sharedParent = candidate.parentInterests.filter((t) =>
        myFamily.parentInterests.includes(t),
      )
      const sharedChild = Array.from(
        new Set(candidate.children.flatMap((c) => c.tags).filter((t) => myChildTags.has(t))),
      )
      const ageBonus = candidate.children.some((cc) =>
        myAges.some((ma) => Math.abs(ma - cc.age) <= 2),
      )
        ? 25
        : 0
      const score = Math.min(98, 45 + sharedParent.length * 12 + sharedChild.length * 15 + ageBonus)
      return {
        family: candidate,
        score,
        sharedParent,
        sharedChild,
        isMatched: matches.includes(candidate.id),
      }
    })
  }, [myFamily, passed, matches])

  const genderLabel = (g: 'boy' | 'girl' | 'unspecified') =>
    g === 'boy' ? 'Poika' : g === 'girl' ? 'Tyttö' : 'Ei halua kertoa'

  return (
    <section className="json-feed-section" id="perhe-match" style={{ paddingTop: '1.5rem' }}>
      <div className="json-feed-heading">
        <div>
          <p className="eyebrow">Perheverkosto · Match & Harrastukset</p>
          <h2>Perhe-Match ({userLocation.city})</h2>
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
            gap: 20,
          }}
        >
          <div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 17 }}>
              1. Perheen aikuiset & lähisukulaiset
            </h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {myFamily.adults.map((a) => (
                <span
                  key={a.id}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 999,
                    background: '#f1f5f9',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  👤 {a.name} ({a.role})
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Nimi (esim. Puoliso tai Mummi)"
                value={newAdultName}
                onChange={(e) => setNewAdultName(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }}
              />
              <select
                value={newAdultRole}
                onChange={(e) => setNewAdultRole(e.target.value as any)}
                style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }}
              >
                <option value="Vanhempi">Vanhempi</option>
                <option value="Isovanhempi">Isovanhempi</option>
                <option value="Läheinen">Läheinen</option>
              </select>
              <button type="button" className="button" onClick={handleAddAdult}>
                + Lisää aikuinen
              </button>
            </div>
          </div>

          <div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 17 }}>
              2. Lapset (ikä pakollinen, sukupuoli & tagit)
            </h3>
            <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
              {myFamily.children.map((c, idx) => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: '#f8fafc',
                    borderRadius: 10,
                  }}
                >
                  <span>
                    <strong>
                      Lapsi #{idx + 1}: {c.age} v
                    </strong>{' '}
                    ({genderLabel(c.gender)}) · {c.tags.join(', ')}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      saveFamily({
                        ...myFamily,
                        children: myFamily.children.filter((x) => x.id !== c.id),
                      })
                    }
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#b91c1c',
                      cursor: 'pointer',
                    }}
                  >
                    Poista
                  </button>
                </div>
              ))}
            </div>
            <div
              style={{
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <label style={{ fontSize: 13 }}>
                Ikä*:{' '}
                <input
                  type="number"
                  min={0}
                  max={18}
                  value={newChildAge}
                  onChange={(e) => setNewChildAge(e.target.value)}
                  style={{ width: 60, padding: 6 }}
                />
              </label>
              <select
                value={newChildGender}
                onChange={(e) => setNewChildGender(e.target.value as any)}
                style={{ padding: 6 }}
              >
                <option value="boy">Poika</option>
                <option value="girl">Tyttö</option>
                <option value="unspecified">Ei halua kertoa</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {CHILD_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setNewChildTags((p) =>
                      p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag],
                    )
                  }
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    fontSize: 12,
                    border: '1px solid #cbd5e1',
                    background: newChildTags.includes(tag) ? '#166534' : '#fff',
                    color: newChildTags.includes(tag) ? '#fff' : '#0f172a',
                    cursor: 'pointer',
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
            <button type="button" className="button primary" onClick={handleAddChild}>
              + Lisää lapsi
            </button>
          </div>

          <div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 17 }}>
              3. Vanhempien "Nyt kiinnostaa" -tagit
            </h3>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PARENT_TAGS.map((tag) => {
                const active = myFamily.parentInterests.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleParentInterest(tag)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 600,
                      border: '1px solid #cbd5e1',
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
        <div className="feed-grid">
          {scoredCandidates.map(({ family, score, sharedParent, sharedChild, isMatched }) => (
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
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#557263' }}>
                    📍 {family.district}, {family.city}
                  </span>
                  <span
                    style={{
                      background: '#dcfce7',
                      color: '#166534',
                      padding: '3px 10px',
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
                <p style={{ fontSize: 13, color: '#475569', margin: '0 0 10px 0' }}>{family.bio}</p>
                <div style={{ fontSize: 12, marginBottom: 6 }}>
                  <strong>👨‍👩‍👧 Aikuiset:</strong>{' '}
                  {family.adults.map((a) => `${a.name} (${a.role})`).join(', ')}
                </div>
                <div style={{ fontSize: 12, marginBottom: 12 }}>
                  <strong>🧒 Lapset:</strong>{' '}
                  {family.children
                    .map((c) => `${c.age} v (${genderLabel(c.gender)}: ${c.tags.join(', ')})`)
                    .join(' · ')}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                  {family.parentInterests.map((tag) => {
                    const isShared = sharedParent.includes(tag) || sharedChild.includes(tag)
                    return (
                      <span
                        key={tag}
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: isShared ? '#fef9c3' : '#f1f5f9',
                          fontWeight: isShared ? 700 : 500,
                        }}
                      >
                        {isShared ? `★ ${tag}` : tag}
                      </span>
                    )
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {isMatched ? (
                  <div
                    style={{
                      width: '100%',
                      padding: 10,
                      borderRadius: 10,
                      background: '#dcfce7',
                      color: '#166534',
                      textAlign: 'center',
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    💚 Match! Kutsu yhteiseen tapahtumaan lähetetty
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="button"
                      onClick={() => setPassed((p) => [...p, family.id])}
                      style={{ flex: 1 }}
                    >
                      ✕ Ohita
                    </button>
                    <button
                      type="button"
                      className="button primary"
                      onClick={() => {
                        const next = Array.from(new Set([...matches, family.id]))
                        setMatches(next)
                        localStorage.setItem('gather_family_matches_v1', JSON.stringify(next))
                      }}
                      style={{ flex: 2 }}
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
