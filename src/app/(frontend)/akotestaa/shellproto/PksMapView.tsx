'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { calcDistanceKm, FamilyEvent, FamilyProfile, PKS_MLL_FAMILY_CAFES } from './protoData'
import { DEFAULT_PKS_COORDS, resolveEventsForMap, type CityOnlyGroup } from './mapGeoResolver'

interface LeafletCircleMarker {
  addTo: (target: LeafletMapInstance | LeafletLayerGroup) => LeafletCircleMarker
  bindPopup: (html: string) => LeafletCircleMarker
  on: (event: string, handler: () => void) => LeafletCircleMarker
}

interface LeafletDivIconMarker {
  addTo: (target: LeafletMapInstance | LeafletLayerGroup) => LeafletDivIconMarker
  bindPopup: (html: string) => LeafletDivIconMarker
  on: (event: string, handler: () => void) => LeafletDivIconMarker
}

interface LeafletLayerGroup {
  addTo: (map: LeafletMapInstance) => LeafletLayerGroup
  clearLayers: () => LeafletLayerGroup
}

interface LeafletMapInstance {
  remove: () => void
  setView: (coords: [number, number], zoom: number) => void
  fitBounds: (bounds: unknown, options?: { padding?: [number, number] }) => void
}

interface LeafletGlobal {
  map: (container: HTMLElement, options?: { zoomSnap?: number }) => LeafletMapInstance
  tileLayer: (
    url: string,
    options?: { attribution?: string; maxZoom?: number },
  ) => { addTo: (map: LeafletMapInstance) => void }
  layerGroup: () => LeafletLayerGroup
  latLngBounds: (sw: [number, number], ne: [number, number]) => unknown
  divIcon: (options: {
    className?: string
    html: string
    iconSize?: [number, number]
    iconAnchor?: [number, number]
  }) => unknown
  marker: (coords: [number, number], options?: { icon?: unknown }) => LeafletDivIconMarker
  circleMarker: (
    coords: [number, number],
    options: {
      radius: number
      fillColor: string
      color: string
      weight: number
      fillOpacity: number
    },
  ) => LeafletCircleMarker
}

type MapEventRecord = FamilyEvent & {
  locationName?: string
  startDate?: string
  coordinates?: unknown
}

interface PksMapViewProps {
  events: MapEventRecord[]
  attendingIds: string[]
  matchedFamilies: FamilyProfile[]
  homeCoords: [number, number]
  homeLabel: string
  familyName: string
  shareEventsWithMatches: boolean
  showCloseRelativesInMatches: boolean
  focusCoords: [number, number] | null
  onResetBounds: () => void
  selectedCity?: string
  onChangeSelectedCity?: (city: string) => void
}

const PKS_SEUTULA_BOUNDS: [[number, number], [number, number]] = [
  [60.135, 24.585],
  [60.345, 25.165],
]

const MAX_MAP_EVENT_PINS = 25

function getEventVenueLabel(evt: MapEventRecord): string {
  return evt.locationName || evt.venue || evt.address || evt.city
}

function getEventTimeLabel(evt: MapEventRecord): string {
  return evt.time || evt.startDate || ''
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[character]
  })
}

export function PksMapView({
  events,
  attendingIds,
  matchedFamilies,
  homeCoords,
  homeLabel,
  familyName,
  shareEventsWithMatches,
  showCloseRelativesInMatches,
  focusCoords,
  onResetBounds,
  selectedCity,
  onChangeSelectedCity,
}: PksMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<LeafletMapInstance | null>(null)
  const markerLayerRef = useRef<LeafletLayerGroup | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState(false)
  const [selectedCityGroup, setSelectedCityGroup] = useState<CityOnlyGroup<MapEventRecord> | null>(
    null,
  )

  // Geneerinen kaupunkifiltteri (synkronoitu profiilin filtterin kanssa tai paikallinen)
  const [internalCityFilter, setInternalCityFilter] = useState<string>('Kaikki PKS')
  const activeCityFilter = selectedCity ?? internalCityFilter

  const handleCityChange = (nextCity: string) => {
    setInternalCityFilter(nextCity)
    setListPage(1)
    setSelectedCityGroup(null)
    onChangeSelectedCity?.(nextCity)
  }

  // MLL-perhekahvilat: oletuksena pois päältä, tottelee geneeristä kaupunkifiltteriä
  const [showMllCafes, setShowMllCafes] = useState(false)

  // Kartan alla olevan listan sivutus (25 tai 50 kpl / sivu)
  const [listPageSize, setListPageSize] = useState<25 | 50>(25)
  const [listPage, setListPage] = useState<number>(1)

  const safeHome = homeCoords || DEFAULT_PKS_COORDS

  // Kaikki valitun kaupungin tapahtumat lähimmästä kauimpaan (ei katkaistu 25:een)
  const cityFilteredAllEvents = useMemo(() => {
    const resolved = resolveEventsForMap(events, safeHome)
    return resolved.all
      .map(({ event: evt, effectiveCoords, hasExactCoords, district }) => ({
        ...evt,
        coords: effectiveCoords,
        hasExactCoords,
        district,
        distanceKm: calcDistanceKm(safeHome, effectiveCoords),
      }))
      .filter((evt) => {
        if (activeCityFilter === 'Kaikki PKS') return true
        return (evt.city || '').toLowerCase() === activeCityFilter.toLowerCase()
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
  }, [events, safeHome, activeCityFilter])

  // Kartalle piirretään enintään 25 lähintä tapahtumaa per kaupunki.
  const mapCappedEvents = useMemo(() => {
    const perCityCount = new Map<string, number>()
    const result: typeof cityFilteredAllEvents = []

    for (const evt of cityFilteredAllEvents) {
      const cityKey = (evt.city || 'Muu').toLowerCase()
      const current = perCityCount.get(cityKey) ?? 0
      if (current < MAX_MAP_EVENT_PINS) {
        perCityCount.set(cityKey, current + 1)
        result.push(evt)
      }
    }
    return result
  }, [cityFilteredAllEvents])

  const resolvedMap = useMemo(
    () => resolveEventsForMap(mapCappedEvents, safeHome),
    [mapCappedEvents, safeHome],
  )

  // MLL-perhekahvilat näytetään vain jos oma filtterikytkin on päällä + rajataan geneerisellä kaupunkifiltterillä
  const visibleMllCafes = useMemo(() => {
    if (!showMllCafes) return []
    return PKS_MLL_FAMILY_CAFES.map((cafe) => ({
      ...cafe,
      distanceKm: calcDistanceKm(safeHome, cafe.coords),
    }))
      .filter(
        (cafe) =>
          activeCityFilter === 'Kaikki PKS' ||
          cafe.city.toLowerCase() === activeCityFilter.toLowerCase(),
      )
      .sort((a, b) => a.distanceKm - b.distanceKm)
  }, [showMllCafes, activeCityFilter, safeHome])

  const visibleMatchedFamilies = useMemo(() => {
    if (activeCityFilter === 'Kaikki PKS') return matchedFamilies
    return matchedFamilies.filter((f) => f.city.toLowerCase() === activeCityFilter.toLowerCase())
  }, [matchedFamilies, activeCityFilter])

  // Sivutuslaskenta kartan alla olevalle listalle
  const totalListPages = Math.max(1, Math.ceil(cityFilteredAllEvents.length / listPageSize))
  const safeListPage = Math.min(listPage, totalListPages)
  const paginatedBottomEvents = useMemo(() => {
    const startIdx = (safeListPage - 1) * listPageSize
    return cityFilteredAllEvents.slice(startIdx, startIdx + listPageSize)
  }, [cityFilteredAllEvents, safeListPage, listPageSize])

  const eventTitleById = useMemo(() => {
    const map = new Map<string, string>()
    for (const evt of events) {
      map.set(evt.id, evt.title)
    }
    return map
  }, [events])

  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false
    let script: HTMLScriptElement | null = null
    setMapError(false)

    const initLeaflet = () => {
      if (cancelled) return
      const L = (window as unknown as { L?: LeafletGlobal }).L
      if (!L || !mapContainerRef.current) {
        setMapError(true)
        return
      }

      const map = L.map(mapContainerRef.current, { zoomSnap: 0.25 })
      mapInstanceRef.current = map

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        { attribution: '© Esri / OSM', maxZoom: 19 },
      ).addTo(map)

      markerLayerRef.current = L.layerGroup().addTo(map)
      map.fitBounds(L.latLngBounds(PKS_SEUTULA_BOUNDS[0], PKS_SEUTULA_BOUNDS[1]), {
        padding: [12, 12],
      })
      setMapReady(true)
    }

    if ((window as unknown as { L?: LeafletGlobal }).L) {
      initLeaflet()
    } else {
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link')
        link.id = 'leaflet-css'
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
      }

      script = document.createElement('script')
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.async = true
      script.onload = initLeaflet
      script.onerror = () => {
        if (!cancelled) setMapError(true)
      }
      document.body.appendChild(script)
    }

    return () => {
      cancelled = true
      script?.remove()
      mapInstanceRef.current?.remove()
      mapInstanceRef.current = null
      markerLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapReady) return
    const L = (window as unknown as { L?: LeafletGlobal }).L
    const map = mapInstanceRef.current
    if (!L || !map) return

    if (focusCoords) {
      map.setView(focusCoords, 14)
    } else {
      map.fitBounds(L.latLngBounds(PKS_SEUTULA_BOUNDS[0], PKS_SEUTULA_BOUNDS[1]), {
        padding: [12, 12],
      })
    }
  }, [mapReady, focusCoords])

  useEffect(() => {
    if (!mapReady) return
    const L = (window as unknown as { L?: LeafletGlobal }).L
    const map = mapInstanceRef.current
    const markerLayer = markerLayerRef.current
    if (!L || !map || !markerLayer) return
    markerLayer.clearLayers()

    const defaultBounds = L.latLngBounds(PKS_SEUTULA_BOUNDS[0], PKS_SEUTULA_BOUNDS[1])

    // Oma koti: oranssi
    L.circleMarker(safeHome, {
      radius: 12,
      fillColor: '#f97316',
      color: '#ffffff',
      weight: 3,
      fillOpacity: 0.98,
    })
      .addTo(markerLayer)
      .bindPopup(
        `<strong>🟠 Oma koti (${familyName})</strong><br/>${homeLabel}<br/><span style="font-size:11px;color:#ea580c;">Klikkaus zoomaa oletusnäkymään</span>`,
      )
      .on('click', () => {
        map.fitBounds(defaultBounds, { padding: [12, 12] })
        onResetBounds()
      })

    // Only events at exactly the same coordinates share a marker.
    const exactPinGroups = new Map<string, typeof resolvedMap.exactPins>()
    resolvedMap.exactPins.forEach((pin) => {
      if (!pin.plotCoords) return
      const key = `${pin.plotCoords[0]},${pin.plotCoords[1]}`
      const group = exactPinGroups.get(key)
      if (group) {
        group.push(pin)
      } else {
        exactPinGroups.set(key, [pin])
      }
    })

    exactPinGroups.forEach((pins) => {
      const firstPin = pins[0]
      const coords = firstPin?.plotCoords
      if (!firstPin || !coords) return
      const eventCount = pins.length

      if (eventCount > 1) {
        const badgeIcon = L.divIcon({
          className: 'perhepiiri-event-cluster',
          html: `<div role="img" aria-label="${eventCount} tapahtumaa samassa sijainnissa" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;background:#1d4ed8;color:#fff;border:2px solid #fff;border-radius:9999px;box-shadow:0 2px 8px rgba(15,23,42,.4);font-size:10px;font-weight:800;">${eventCount}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        })
        const eventRows = pins
          .map(({ event: evt }) => {
            const time = getEventTimeLabel(evt)
            const venue = getEventVenueLabel(evt)
            const isGoing = attendingIds.includes(evt.id)
            return `<li style="padding:6px 0;border-bottom:1px solid #e2e8f0;"><strong>${escapeHtml(evt.title)}</strong><br/><span style="font-size:11px;color:#475569;">${escapeHtml(venue)}${time ? ` • ${escapeHtml(time)}` : ''}${isGoing ? ' • ✅ Olet menossa mukaan' : ''}</span></li>`
          })
          .join('')

        L.marker(coords, { icon: badgeIcon })
          .addTo(markerLayer)
          .bindPopup(
            `<strong>${eventCount} tapahtumaa samassa sijainnissa</strong><ul style="max-height:240px;overflow-y:auto;list-style:none;padding:0;margin:6px 0 0;">${eventRows}</ul>`,
          )
        return
      }

      const evt = firstPin.event
      const isGoing = attendingIds.includes(evt.id)
      const venueText = getEventVenueLabel(evt)
      const timeText = getEventTimeLabel(evt)
      const descHtml = evt.description
        ? `<br/><span style="font-size:11px;color:#475569;">${evt.description}</span>`
        : ''
      const linkHtml = evt.url
        ? `<br/><a href="${evt.url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:4px;font-size:11px;font-weight:700;color:#1d4ed8;text-decoration:underline;">Lisätiedot ↗</a>`
        : ''

      L.circleMarker(coords, {
        radius: 9.5,
        fillColor: '#1d4ed8',
        color: '#1e3a8a',
        weight: 2.5,
        fillOpacity: 0.96,
      })
        .addTo(markerLayer)
        .bindPopup(
          `<span style="font-size:10px;font-weight:700;color:#1d4ed8;">TARKKA SIJAINTI (${evt.city})</span><br/><strong>📅 ${evt.title}</strong><br/>${venueText}<br/>${
            isGoing ? '✅ Olet menossa mukaan' : timeText
          }${descHtml}${linkHtml}`,
        )
    })

    // 2. Kaupunginosa / tunnettu alue: vaaleansininen (#93c5fd)
    resolvedMap.districtPins.forEach(({ event: evt, district, city, plotCoords }) => {
      if (!plotCoords) return
      const isGoing = attendingIds.includes(evt.id)
      const venueText = getEventVenueLabel(evt)
      const timeText = getEventTimeLabel(evt)
      const descHtml = evt.description
        ? `<br/><span style="font-size:11px;color:#475569;">${evt.description}</span>`
        : ''
      const linkHtml = evt.url
        ? `<br/><a href="${evt.url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:4px;font-size:11px;font-weight:700;color:#2563eb;text-decoration:underline;">Lisätiedot ↗</a>`
        : ''

      L.circleMarker(plotCoords, {
        radius: 8.5,
        fillColor: '#93c5fd',
        color: '#2563eb',
        weight: 2,
        fillOpacity: 0.9,
      })
        .addTo(markerLayer)
        .bindPopup(
          `<span style="font-size:10px;font-weight:700;color:#2563eb;">ALUE: ${district || city}</span><br/><strong>📅 ${evt.title}</strong><br/>${venueText}<br/>${
            isGoing ? '✅ Olet menossa mukaan' : timeText
          }${descHtml}${linkHtml}`,
        )
    })

    // 3. Vain kaupunki: sininen kaupunkilistamarkkeri
    resolvedMap.cityGroups.forEach((group) => {
      const badgeIcon = L.divIcon({
        className: 'perhepiiri-city-list-badge',
        html: `<div style="background:#eff6ff;color:#1e3a8a;border:2px solid #2563eb;border-radius:9999px;padding:3px 8px;font-size:11px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,0.18);white-space:nowrap;cursor:pointer;">${group.city}: ${group.items.length} (lista)</div>`,
        iconSize: [112, 24],
        iconAnchor: [56, 12],
      })

      L.marker(group.coords, { icon: badgeIcon })
        .addTo(markerLayer)
        .bindPopup(
          `<strong>${group.city} — ${group.items.length} tapahtumaa</strong><br/><span style="font-size:11px;color:#475569;">Vain kaupunkitieto (ei tarkkaa osoitetta tai kaupunginosaa).</span>`,
        )
        .on('click', () => {
          setSelectedCityGroup(group)
        })
    })

    // 4. MLL-perhekahvilat: violetti (#7c3aed) — vain kun filtteri on päällä
    if (showMllCafes) {
      visibleMllCafes.forEach((cafe) => {
        const linkHtml = cafe.url
          ? `<br/><a href="${cafe.url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:4px;font-size:11px;font-weight:700;color:#6d28d9;text-decoration:underline;">Yhdistyksen sivu ↗</a>`
          : ''

        L.circleMarker(cafe.coords, {
          radius: 9,
          fillColor: '#7c3aed',
          color: '#4c1d95',
          weight: 2.5,
          fillOpacity: 0.94,
        })
          .addTo(markerLayer)
          .bindPopup(
            `<span style="font-size:10px;font-weight:700;color:#6d28d9;">MLL-PERHEKAHVILA (${cafe.city})</span><br/><strong>☕ ${cafe.name}</strong><br/>${cafe.venue}, ${cafe.address}<br/><span style="font-size:11px;color:#475569;">🕒 ${cafe.schedule} • ${cafe.ageGroup} (${cafe.distanceKm} km)</span>${linkHtml}`,
          )
      })
    }

    // Perheosumat: vihreä (#059669)
    visibleMatchedFamilies.forEach((fam) => {
      const linkedTitle = fam.attendingEventId ? eventTitleById.get(fam.attendingEventId) || '' : ''
      const eventNote =
        shareEventsWithMatches && linkedTitle
          ? `<br/><span style="font-size:11px;color:#059669;">Tapahtuma: ${linkedTitle}</span>`
          : ''

      const relativesNote =
        showCloseRelativesInMatches && fam.hasCloseRelatives && fam.closeRelativesSummary
          ? `<br/><span style="font-size:11px;color:#475569;">🫂 Läheiset: ${fam.closeRelativesSummary}</span>`
          : ''

      L.circleMarker(fam.coords, {
        radius: 11,
        fillColor: '#059669',
        color: '#ffffff',
        weight: 2.5,
        fillOpacity: 0.96,
      })
        .addTo(markerLayer)
        .bindPopup(
          `<strong>🤝 ${fam.name}</strong><br/>${fam.area} (${fam.childrenAges})${eventNote}${relativesNote}`,
        )
    })
  }, [
    mapReady,
    resolvedMap,
    visibleMllCafes,
    showMllCafes,
    eventTitleById,
    attendingIds,
    visibleMatchedFamilies,
    safeHome,
    homeLabel,
    familyName,
    shareEventsWithMatches,
    showCloseRelativesInMatches,
    onResetBounds,
  ])

  return (
    <div className="h-full flex flex-col relative bg-slate-50">
      <div className="flex-none h-[52%] sm:h-[54%] sm:max-h-[480px] flex flex-col min-h-[240px] border-b border-slate-200 bg-white">
        {mapError ? (
          <div className="flex-1 flex items-center justify-center p-6 text-center text-xs text-slate-600 bg-slate-100">
            Karttakirjaston lataus ei onnistunut. Tarkista verkkoyhteys ja avaa kartta uudelleen.
          </div>
        ) : (
          <div ref={mapContainerRef} className="flex-1 w-full min-h-[200px]" />
        )}

        {/* Geneerinen kaupunkifiltteri + karttaselitteet + MLL-kahviloiden erillinen kytkin */}
        <div className="bg-white border-t border-slate-200 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-2 font-medium text-slate-700">
            {/* Geneerinen kaupunkivalitsin */}
            <label className="inline-flex items-center gap-1.5 font-bold text-slate-800">
              <span>Kaupunki:</span>
              <select
                value={activeCityFilter}
                onChange={(e) => handleCityChange(e.target.value)}
                aria-label="Kaupunkifiltteri"
                className="px-2.5 py-1 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 font-bold text-xs"
              >
                {['Kaikki PKS', 'Espoo', 'Helsinki', 'Vantaa', 'Kauniainen'].map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </label>

            <span>🟠 Koti</span>
            <span
              className="inline-flex items-center gap-1"
              title="Kartalla näytetään enintään 25 lähintä tapahtumaa kaupunkia kohden. Vain täsmälleen samoihin koordinaatteihin osuvat tapahtumat ryhmitellään."
            >
              <span className="w-2.5 h-2.5 rounded-full bg-blue-700 border border-blue-900 inline-block" />
              Kartalla ({mapCappedEvents.length}/{cityFilteredAllEvents.length})
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-300 border border-blue-600 inline-block" />
              Alue ({resolvedMap.stats.districtCount})
            </span>
            <button
              type="button"
              onClick={() =>
                setSelectedCityGroup((prev) => (prev ? null : (resolvedMap.cityGroups[0] ?? null)))
              }
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-blue-600 bg-blue-50 text-blue-900 font-bold hover:bg-blue-100"
            >
              Kaupunkilista ({resolvedMap.stats.cityOnlyCount})
            </button>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 border border-white inline-block" />
              Osumat ({visibleMatchedFamilies.length})
            </span>

            {/* MLL-perhekahviloiden oma kytkin (oletuksena pois päältä) */}
            <button
              type="button"
              onClick={() => setShowMllCafes((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border font-bold transition-colors ${
                showMllCafes
                  ? 'bg-violet-600 text-white border-violet-800'
                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full inline-block ${
                  showMllCafes ? 'bg-white' : 'bg-violet-600'
                }`}
              />
              ☕ MLL-kahvilat {showMllCafes ? `(${visibleMllCafes.length})` : '(pois)'}
            </button>
          </div>

          <button
            type="button"
            onClick={onResetBounds}
            className="px-2.5 py-1 rounded-lg bg-slate-100 font-semibold text-slate-800 shrink-0"
          >
            Koko PKS
          </button>
        </div>
      </div>

      {selectedCityGroup && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 sm:px-6 py-3 text-xs max-h-44 overflow-y-auto shrink-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-bold text-blue-950">
              {selectedCityGroup.city} — vain kaupunkitason tapahtumat (
              {selectedCityGroup.items.length})
            </span>
            <button
              type="button"
              onClick={() => setSelectedCityGroup(null)}
              className="px-2 py-0.5 rounded bg-white border border-blue-300 text-blue-900 font-semibold"
            >
              Sulje lista
            </button>
          </div>
          <ul className="space-y-1">
            {selectedCityGroup.items.map(({ event: item }) => {
              const itemVenue = getEventVenueLabel(item)
              const itemTime = getEventTimeLabel(item)
              return (
                <li
                  key={item.id}
                  className="bg-white rounded-lg px-2.5 py-1.5 border border-blue-100 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">{item.title}</div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {itemVenue} {itemTime ? `• ${itemTime}` : ''}
                    </div>
                  </div>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-blue-700 font-bold underline"
                    >
                      Avaa ↗
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Kartan alla oleva sivutettu listaus (25 tai 50 erissä kaikki valitun kaupungin tapahtumat) */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="font-bold text-slate-800">
            Tapahtumalista ({activeCityFilter}): {cityFilteredAllEvents.length} kpl{' '}
            <span className="font-normal text-slate-500">
              (kartalla enintään {MAX_MAP_EVENT_PINS} lähintä / kaupunki)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">Eräkoko:</span>
            {([25, 50] as const).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => {
                  setListPageSize(size)
                  setListPage(1)
                }}
                className={`px-2 py-0.5 rounded-md font-bold text-[11px] border ${
                  listPageSize === size
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                {size} / sivu
              </button>
            ))}

            {totalListPages > 1 && (
              <div className="flex items-center gap-1.5 ml-1">
                <button
                  type="button"
                  disabled={safeListPage <= 1}
                  onClick={() => setListPage((p) => Math.max(1, p - 1))}
                  className="px-2 py-0.5 rounded border border-slate-300 bg-white text-slate-700 font-semibold disabled:opacity-40"
                >
                  ←
                </button>
                <span className="font-mono text-[11px] text-slate-700">
                  {safeListPage}/{totalListPages}
                </span>
                <button
                  type="button"
                  disabled={safeListPage >= totalListPages}
                  onClick={() => setListPage((p) => Math.min(totalListPages, p + 1))}
                  className="px-2 py-0.5 rounded border border-slate-300 bg-white text-slate-700 font-semibold disabled:opacity-40"
                >
                  →
                </button>
              </div>
            )}
          </div>
        </div>

        {paginatedBottomEvents.length === 0 ? (
          <div className="bg-white rounded-xl p-4 border border-slate-200 text-xs text-slate-500 text-center">
            Ei tapahtumia valitussa kaupungissa ({activeCityFilter}).
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {paginatedBottomEvents.map((evt) => (
              <div
                key={evt.id}
                className="bg-white rounded-xl p-2.5 border border-slate-200 flex items-start justify-between gap-2 text-xs"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="text-[10px] font-bold text-blue-700 uppercase">
                    {evt.district ? `${evt.district} (${evt.city})` : evt.city} •{' '}
                    {evt.hasExactCoords ? '' : '~'}
                    {evt.distanceKm} km • {evt.ageGroup}
                  </div>
                  <div className="font-bold text-slate-900 truncate">{evt.title}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {getEventVenueLabel(evt)} • {getEventTimeLabel(evt)}
                  </div>
                </div>
                {evt.url && (
                  <a
                    href={evt.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold text-[11px] hover:bg-blue-100"
                  >
                    Avaa ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
