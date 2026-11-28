'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarPlus,
  ChevronDown,
  ExternalLink,
  MapPin,
  MessageCircle,
  Tag,
  UserPlus,
  Users,
} from 'lucide-react'
import { calcDistanceKm, FamilyEvent, FamilyProfile, PKS_MLL_FAMILY_CAFES } from './protoData'
import { buildGoogleCalendarUrl } from './googleCalendar'
import { DEFAULT_PKS_COORDS, resolveEventsForMap, type CityOnlyGroup } from './mapGeoResolver'
import { PKS_ALL_CITIES, PKS_CITY_FILTER_OPTIONS } from './pksAreas'

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
  showMapFeed?: boolean
  pendingEventIds?: ReadonlySet<string>
  countsByEventId?: Readonly<Record<string, number>>
  isLoadingParticipations?: boolean
  onToggleParticipation?: (eventId: string, eventTitle: string, isGoing: boolean) => void
  onOpenEventChat?: (eventId: string, eventTitle: string) => void
  onLogSelection?: (action: string, detail: string) => void
  onOpenMap?: (coords: [number, number], label?: string) => void
}

const PKS_SEUTULA_BOUNDS: [[number, number], [number, number]] = [
  [60.135, 24.585],
  [60.345, 25.165],
]

const MAX_MAP_EVENT_PINS = 25
const MAP_MARKER_COLORS = {
  home: '#C2591A',
  event: '#9E4B16',
  area: '#9CB9B7',
  family: '#2F5D50',
  cafe: '#6E567F',
} as const

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
  showMapFeed = false,
  pendingEventIds,
  countsByEventId,
  isLoadingParticipations,
  onToggleParticipation,
  onOpenEventChat,
  onLogSelection,
  onOpenMap,
}: PksMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<LeafletMapInstance | null>(null)
  const markerLayerRef = useRef<LeafletLayerGroup | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState(false)
  const [selectedCityGroup, setSelectedCityGroup] = useState<CityOnlyGroup<MapEventRecord> | null>(
    null,
  )
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null)
  const eventCardRefs = useRef(new Map<string, HTMLElement>())
  const familyCardRefs = useRef(new Map<string, HTMLButtonElement>())

  // Geneerinen kaupunkifiltteri (synkronoitu profiilin filtterin kanssa tai paikallinen)
  const [internalCityFilter, setInternalCityFilter] = useState<string>(PKS_ALL_CITIES)
  const activeCityFilter = selectedCity ?? internalCityFilter

  const handleCityChange = (nextCity: string) => {
    setInternalCityFilter(nextCity)
    setListPage(1)
    setSelectedCityGroup(null)
    setSelectedEventId(null)
    setSelectedFamilyId(null)
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
        if (activeCityFilter === PKS_ALL_CITIES) return true
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
          activeCityFilter === PKS_ALL_CITIES ||
          cafe.city.toLowerCase() === activeCityFilter.toLowerCase(),
      )
      .sort((a, b) => a.distanceKm - b.distanceKm)
  }, [showMllCafes, activeCityFilter, safeHome])

  const visibleMatchedFamilies = useMemo(() => {
    if (activeCityFilter === PKS_ALL_CITIES) return matchedFamilies
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

  const selectEvent = useCallback(
    (eventId: string, coords?: [number, number]) => {
      setSelectedEventId(eventId)
      setSelectedFamilyId(null)
      const eventIndex = cityFilteredAllEvents.findIndex((event) => event.id === eventId)
      if (eventIndex >= 0) {
        setListPage(Math.floor(eventIndex / listPageSize) + 1)
        const event = cityFilteredAllEvents[eventIndex]
        mapInstanceRef.current?.setView(coords ?? event.coords, 14)
      } else if (coords) {
        mapInstanceRef.current?.setView(coords, 14)
      }
    },
    [cityFilteredAllEvents, listPageSize],
  )

  const selectFamily = useCallback((familyId: string) => {
    setSelectedFamilyId(familyId)
    setSelectedEventId(null)
  }, [])

  useEffect(() => {
    if (!showMapFeed || !selectedEventId) return
    eventCardRefs.current.get(selectedEventId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedEventId, showMapFeed, safeListPage])

  useEffect(() => {
    if (!showMapFeed || !selectedFamilyId) return
    familyCardRefs.current.get(selectedFamilyId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedFamilyId, showMapFeed])

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

    // Oma koti: terrakotta
    L.circleMarker(safeHome, {
      radius: 12,
      fillColor: MAP_MARKER_COLORS.home,
      color: '#ffffff',
      weight: 3,
      fillOpacity: 0.98,
    })
      .addTo(markerLayer)
      .bindPopup(
        `<strong>🟠 Oma koti (${familyName})</strong><br/>${homeLabel}<br/><span style="font-size:11px;color:${MAP_MARKER_COLORS.home};">Klikkaus zoomaa oletusnäkymään</span>`,
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
          html: `<div role="img" aria-label="${eventCount} tapahtumaa samassa sijainnissa" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;background:${MAP_MARKER_COLORS.event};color:#fff;border:2px solid #fff;border-radius:9999px;box-shadow:0 2px 8px rgba(15,23,42,.4);font-size:10px;font-weight:800;">${eventCount}</div>`,
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
          .on('click', () => selectEvent(firstPin.event.id, coords))
        return
      }

      const evt = firstPin.event
      const isGoing = attendingIds.includes(evt.id)
      const isSelected = selectedEventId === evt.id
      const venueText = getEventVenueLabel(evt)
      const timeText = getEventTimeLabel(evt)
      const descHtml = evt.description
        ? `<br/><span style="font-size:11px;color:#475569;">${evt.description}</span>`
        : ''
      const linkHtml = evt.url
        ? `<br/><a href="${evt.url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:4px;font-size:11px;font-weight:700;color:${MAP_MARKER_COLORS.event};text-decoration:underline;">Lisätiedot ↗</a>`
        : ''

      L.circleMarker(coords, {
        radius: isSelected ? 12 : 9.5,
        fillColor: MAP_MARKER_COLORS.event,
        color: isSelected ? '#2E211B' : '#6D3514',
        weight: isSelected ? 4 : 2.5,
        fillOpacity: 0.96,
      })
        .addTo(markerLayer)
        .bindPopup(
          `<span style="font-size:10px;font-weight:700;color:${MAP_MARKER_COLORS.event};">TARKKA SIJAINTI (${evt.city})</span><br/><strong>📅 ${evt.title}</strong><br/>${venueText}<br/>${
            isGoing ? '✅ Olet menossa mukaan' : timeText
          }${descHtml}${linkHtml}`,
        )
        .on('click', () => selectEvent(evt.id, coords))
    })

    // 2. Kaupunginosa / tunnettu alue: salvia
    resolvedMap.districtPins.forEach(({ event: evt, district, city, plotCoords }) => {
      if (!plotCoords) return
      const isGoing = attendingIds.includes(evt.id)
      const isSelected = selectedEventId === evt.id
      const venueText = getEventVenueLabel(evt)
      const timeText = getEventTimeLabel(evt)
      const descHtml = evt.description
        ? `<br/><span style="font-size:11px;color:#475569;">${evt.description}</span>`
        : ''
      const linkHtml = evt.url
        ? `<br/><a href="${evt.url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:4px;font-size:11px;font-weight:700;color:#2F5D50;text-decoration:underline;">Lisätiedot ↗</a>`
        : ''

      L.circleMarker(plotCoords, {
        radius: isSelected ? 11 : 8.5,
        fillColor: MAP_MARKER_COLORS.area,
        color: isSelected ? '#2E211B' : '#2F5D50',
        weight: isSelected ? 4 : 2,
        fillOpacity: 0.9,
      })
        .addTo(markerLayer)
        .bindPopup(
          `<span style="font-size:10px;font-weight:700;color:#2F5D50;">ALUE: ${district || city}</span><br/><strong>📅 ${evt.title}</strong><br/>${venueText}<br/>${
            isGoing ? '✅ Olet menossa mukaan' : timeText
          }${descHtml}${linkHtml}`,
        )
        .on('click', () => selectEvent(evt.id, plotCoords))
    })

    // 3. Vain kaupunki: terrakottainen kaupunkilistamerkki
    resolvedMap.cityGroups.forEach((group) => {
      const badgeIcon = L.divIcon({
        className: 'perhepiiri-city-list-badge',
        html: `<div style="background:#F7F6F3;color:#2E211B;border:2px solid ${MAP_MARKER_COLORS.event};border-radius:9999px;padding:3px 8px;font-size:11px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,0.18);white-space:nowrap;cursor:pointer;">${group.city}: ${group.items.length} (lista)</div>`,
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
          const firstEvent = group.items[0]?.event
          if (firstEvent) selectEvent(firstEvent.id, group.coords)
        })
    })

    // 4. MLL-perhekahvilat: murrettu lila — vain kun filtteri on päällä
    if (showMllCafes) {
      visibleMllCafes.forEach((cafe) => {
        const linkHtml = cafe.url
          ? `<br/><a href="${cafe.url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:4px;font-size:11px;font-weight:700;color:${MAP_MARKER_COLORS.cafe};text-decoration:underline;">Yhdistyksen sivu ↗</a>`
          : ''

        L.circleMarker(cafe.coords, {
          radius: 9,
          fillColor: MAP_MARKER_COLORS.cafe,
          color: '#4E3D5A',
          weight: 2.5,
          fillOpacity: 0.94,
        })
          .addTo(markerLayer)
          .bindPopup(
            `<span style="font-size:10px;font-weight:700;color:${MAP_MARKER_COLORS.cafe};">MLL-PERHEKAHVILA (${cafe.city})</span><br/><strong>☕ ${cafe.name}</strong><br/>${cafe.venue}, ${cafe.address}<br/><span style="font-size:11px;color:#475569;">🕒 ${cafe.schedule} • ${cafe.ageGroup} (${cafe.distanceKm} km)</span>${linkHtml}`,
          )
      })
    }

    // Perheosumat: metsänvihreä
    visibleMatchedFamilies.forEach((fam) => {
      const isSelected = selectedFamilyId === fam.id
      const linkedTitle = fam.attendingEventId ? eventTitleById.get(fam.attendingEventId) || '' : ''
      const eventNote =
        shareEventsWithMatches && linkedTitle
          ? `<br/><span style="font-size:11px;color:${MAP_MARKER_COLORS.family};">Tapahtuma: ${linkedTitle}</span>`
          : ''

      const relativesNote =
        showCloseRelativesInMatches && fam.hasCloseRelatives && fam.closeRelativesSummary
          ? `<br/><span style="font-size:11px;color:#475569;">🫂 Läheiset: ${fam.closeRelativesSummary}</span>`
          : ''

      L.circleMarker(fam.coords, {
        radius: isSelected ? 14 : 11,
        fillColor: MAP_MARKER_COLORS.family,
        color: isSelected ? '#2E211B' : '#ffffff',
        weight: isSelected ? 4 : 2.5,
        fillOpacity: 0.96,
      })
        .addTo(markerLayer)
        .bindPopup(
          `<strong>🤝 ${fam.name}</strong><br/>${fam.area} (${fam.childrenAges})${eventNote}${relativesNote}`,
        )
        .on('click', () => selectFamily(fam.id))
    })
  }, [
    mapReady,
    resolvedMap,
    visibleMllCafes,
    showMllCafes,
    eventTitleById,
    attendingIds,
    visibleMatchedFamilies,
    selectedEventId,
    selectedFamilyId,
    safeHome,
    homeLabel,
    familyName,
    shareEventsWithMatches,
    showCloseRelativesInMatches,
    onResetBounds,
    selectEvent,
    selectFamily,
  ])

  return (
    <div className="h-full min-w-0 flex flex-col relative bg-[var(--color-bg)]">
      <div className="flex-none h-[52%] md:h-[54%] md:max-h-[480px] flex flex-col min-h-[240px] border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        {mapError ? (
          <div className="flex-1 flex items-center justify-center p-6 text-center text-xs text-slate-600 bg-slate-100">
            Karttakirjaston lataus ei onnistunut. Tarkista verkkoyhteys ja avaa kartta uudelleen.
          </div>
        ) : (
          <div ref={mapContainerRef} className="flex-1 w-full min-h-[200px]" />
        )}

        {/* Geneerinen kaupunkifiltteri + karttaselitteet + MLL-kahviloiden erillinen kytkin */}
        <div className="bg-[var(--color-surface)] border-t border-[var(--color-border)] px-4 md:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
        <div className="flex flex-wrap items-center gap-2 font-medium text-[var(--color-ink)]">
            {/* Geneerinen kaupunkivalitsin */}
            <label className="inline-flex items-center gap-1.5 font-bold text-[var(--color-ink)]">
              <span>Kaupunki:</span>
              <select
                value={activeCityFilter}
                onChange={(e) => handleCityChange(e.target.value)}
                aria-label="Kaupunkifiltteri"
                className="min-h-11 px-2.5 py-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-ink)] font-bold text-xs"
              >
                {PKS_CITY_FILTER_OPTIONS.map((city) => (
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
              <span className="w-2.5 h-2.5 rounded-full bg-[#9E4B16] border border-[#6D3514] inline-block" />
              Kartalla ({mapCappedEvents.length}/{cityFilteredAllEvents.length})
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#9CB9B7] border border-[#2F5D50] inline-block" />
              Alue ({resolvedMap.stats.districtCount})
            </span>
            <button
              type="button"
              onClick={() =>
                setSelectedCityGroup((prev) => (prev ? null : (resolvedMap.cityGroups[0] ?? null)))
              }
              className="min-h-11 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] font-bold hover:bg-[var(--color-bg)]"
            >
              Kaupunkilista ({resolvedMap.stats.cityOnlyCount})
            </button>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2F5D50] border border-white inline-block" />
              Osumat ({visibleMatchedFamilies.length})
            </span>

            {/* MLL-perhekahviloiden oma kytkin (oletuksena pois päältä) */}
            <button
              type="button"
              onClick={() => setShowMllCafes((prev) => !prev)}
              className={`min-h-11 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border font-bold transition-colors ${
                showMllCafes
                  ? 'bg-[#6E567F] text-white border-[#4E3D5A]'
                  : 'bg-[var(--color-surface)] text-[var(--color-ink)] border-[var(--color-border)] hover:bg-[var(--color-bg)]'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full inline-block ${
                  showMllCafes ? 'bg-white' : 'bg-[#6E567F]'
                }`}
              />
              ☕ MLL-kahvilat {showMllCafes ? `(${visibleMllCafes.length})` : '(pois)'}
            </button>
          </div>

          <button
            type="button"
            onClick={onResetBounds}
            className="min-h-11 px-2.5 py-1 rounded-lg bg-[var(--color-accent-soft)] font-semibold text-[var(--color-ink)] shrink-0"
          >
            Koko PKS
          </button>
        </div>
      </div>

      {selectedCityGroup && (
        <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 md:px-6 py-3 text-xs max-h-44 overflow-y-auto shrink-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-bold text-[var(--color-ink)]">
              {selectedCityGroup.city} — vain kaupunkitason tapahtumat (
              {selectedCityGroup.items.length})
            </span>
            <button
              type="button"
              onClick={() => setSelectedCityGroup(null)}
              className="min-h-11 px-2 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-ink)] font-semibold"
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
                  className="bg-[var(--color-bg)] rounded-2xl px-2.5 py-1.5 border border-[var(--color-border)] flex min-w-0 items-center justify-between gap-2"
                >
                  <button
                    type="button"
                    onClick={() => selectEvent(item.id)}
                    className="min-h-11 min-w-0 flex-1 text-left"
                  >
                    <div className="font-semibold text-slate-900 truncate">{item.title}</div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {itemVenue} {itemTime ? `• ${itemTime}` : ''}
                    </div>
                  </button>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-11 shrink-0 text-[var(--color-accent)] font-bold underline"
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

      {showMapFeed ? (
        <div className="min-w-0 flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 md:px-6 py-3">
          <div className="grid min-w-0 grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <section aria-labelledby="map-families-heading" className="min-w-0 space-y-2">
              <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
                <h2
                  id="map-families-heading"
                  className="text-sm font-bold text-[var(--color-ink)]"
                >
                  Perheosumat kartan alueella
                </h2>
                <span className="text-xs text-[var(--color-ink-muted)]">
                  {visibleMatchedFamilies.length} perhettä
                </span>
              </div>
              {visibleMatchedFamilies.length === 0 ? (
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-xs text-[var(--color-ink-muted)]">
                  Ei perheosumia valitulla alueella.
                </div>
              ) : (
                <div className="space-y-2">
                  {visibleMatchedFamilies.map((family) => (
                    <button
                      key={family.id}
                      ref={(element) => {
                        if (element) familyCardRefs.current.set(family.id, element)
                        else familyCardRefs.current.delete(family.id)
                      }}
                      type="button"
                      aria-pressed={selectedFamilyId === family.id}
                      onClick={() => {
                        selectFamily(family.id)
                      }}
                      className={`min-h-11 w-full min-w-0 rounded-2xl border p-3 text-left transition-colors ${
                        selectedFamilyId === family.id
                          ? 'border-[#2F5D50] bg-[var(--color-accent-soft)]'
                          : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)]'
                      }`}
                    >
                      <span className="block min-w-0 break-words text-xs font-bold text-[var(--color-ink)]">
                        {family.name}
                      </span>
                      <span className="mt-1 block min-w-0 break-words text-[11px] text-[var(--color-ink-muted)]">
                        {family.area} ({family.city}) • {family.childrenAges}
                      </span>
                      {shareEventsWithMatches &&
                        family.attendingEventId &&
                        eventTitleById.has(family.attendingEventId) && (
                          <span className="mt-1 block min-w-0 break-words text-[11px] text-[#2F5D50]">
                            Tapahtuma: {eventTitleById.get(family.attendingEventId)}
                          </span>
                        )}
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section aria-labelledby="map-events-heading" className="min-w-0 space-y-2">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2
                    id="map-events-heading"
                    className="text-sm font-bold text-[var(--color-ink)]"
                  >
                    Tapahtumat kartan alueella
                  </h2>
                  <p className="text-[11px] text-[var(--color-ink-muted)]">
                    {activeCityFilter}: {cityFilteredAllEvents.length} tapahtumaa
                  </p>
                </div>

                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-[var(--color-ink-muted)]">Eräkoko:</span>
                  {([25, 50] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        setListPageSize(size)
                        setListPage(1)
                      }}
                      className={`min-h-11 px-2 py-0.5 rounded-md font-bold text-[11px] border ${
                        listPageSize === size
                          ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                          : 'bg-[var(--color-surface)] text-[var(--color-ink)] border-[var(--color-border)] hover:bg-[var(--color-bg)]'
                      }`}
                    >
                      {size} / sivu
                    </button>
                  ))}
                  {totalListPages > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={safeListPage <= 1}
                        onClick={() => setListPage((page) => Math.max(1, page - 1))}
                        aria-label="Edellinen tapahtumasivu"
                        className="min-h-11 min-w-11 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] font-semibold disabled:opacity-40"
                      >
                        ←
                      </button>
                      <span className="font-mono text-[11px] text-[var(--color-ink)]">
                        {safeListPage}/{totalListPages}
                      </span>
                      <button
                        type="button"
                        disabled={safeListPage >= totalListPages}
                        onClick={() => setListPage((page) => Math.min(totalListPages, page + 1))}
                        aria-label="Seuraava tapahtumasivu"
                        className="min-h-11 min-w-11 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] font-semibold disabled:opacity-40"
                      >
                        →
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {paginatedBottomEvents.length === 0 ? (
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center text-xs text-[var(--color-ink-muted)]">
                  Ei tapahtumia valitussa kaupungissa ({activeCityFilter}).
                </div>
              ) : (
                <div className="space-y-2">
                  {paginatedBottomEvents.map((event) => {
                    const isExpanded = selectedEventId === event.id
                    const isGoing = attendingIds.includes(event.id)
                    const isFree = event.price.trim().toLowerCase().includes('maksuton')
                    const eventDetailsId = `map-event-details-${encodeURIComponent(event.id)}`
                    const participantCount =
                      countsByEventId && Object.hasOwn(countsByEventId, event.id)
                        ? countsByEventId[event.id]
                        : undefined
                    const visibleParticipantCount =
                      isLoadingParticipations && participantCount === undefined
                        ? '…'
                        : (participantCount ?? 0)
                    const ParticipationIcon = isGoing ? Users : UserPlus
                    const calendarUrl = buildGoogleCalendarUrl(event)

                    return (
                      <article
                        key={event.id}
                        ref={(element) => {
                          if (element) eventCardRefs.current.set(event.id, element)
                          else eventCardRefs.current.delete(event.id)
                        }}
                        className={`min-w-0 rounded-2xl border bg-[var(--color-surface)] p-3 transition-colors ${
                          isExpanded
                            ? 'border-[#2F5D50] shadow-sm'
                            : 'border-[var(--color-border)]'
                        }`}
                      >
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          aria-controls={eventDetailsId}
                          onClick={() => {
                            if (isExpanded) {
                              setSelectedEventId(null)
                              return
                            }
                            selectEvent(event.id, event.coords)
                            onOpenMap?.(event.coords, event.id)
                          }}
                          className="flex min-h-11 w-full min-w-0 items-start gap-2 text-left"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-[10px] font-semibold text-[var(--color-ink-muted)]">
                              <span className="break-words">
                                {event.district
                                  ? `${event.district} (${event.city})`
                                  : event.city}
                              </span>
                              <span>
                                {event.hasExactCoords ? '' : '~'}
                                {event.distanceKm} km
                              </span>
                              {event.ageGroup && (
                                <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-0.5 text-[var(--color-ink)]">
                                  {event.ageGroup}
                                </span>
                              )}
                              {event.price.trim() && (
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold ${
                                    isFree
                                      ? 'border-[#2F5D50] text-[#2F5D50]'
                                      : 'border-[var(--color-border)] text-[var(--color-ink)]'
                                  }`}
                                >
                                  {isFree && (
                                    <Tag
                                      aria-hidden="true"
                                      className="h-3 w-3"
                                      strokeWidth={2}
                                    />
                                  )}
                                  {event.price}
                                </span>
                              )}
                            </span>
                            <span className="mt-1 block min-w-0 break-words text-sm font-bold leading-snug text-[var(--color-ink)]">
                              {event.title}
                            </span>
                            <span className="mt-1 block min-w-0 break-words text-[11px] text-[var(--color-ink-muted)]">
                              {getEventVenueLabel(event)} • {getEventTimeLabel(event)}
                            </span>
                          </span>
                          <ChevronDown
                            aria-hidden="true"
                            className={`mt-1 h-4 w-4 shrink-0 transition-transform ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                            strokeWidth={2}
                          />
                        </button>

                        <div
                          id={eventDetailsId}
                          hidden={!isExpanded}
                          className="mt-2 min-w-0 space-y-2 border-t border-[var(--color-border)] pt-2"
                        >
                          {event.description && (
                            <p className="break-words text-xs leading-relaxed text-[var(--color-ink)]">
                              {event.description}
                            </p>
                          )}
                          <p className="break-words text-[11px] text-[var(--color-ink-muted)]">
                            {getEventVenueLabel(event)} • {getEventTimeLabel(event)}
                            {' • '}
                            {event.hasExactCoords ? 'Tarkka sijainti' : 'Sijainti arvioitu'}
                          </p>
                          <div className="flex min-w-0 flex-wrap gap-1.5">
                              {onToggleParticipation && (
                                <button
                                  type="button"
                                  disabled={pendingEventIds?.has(event.id)}
                                  aria-pressed={isGoing}
                                  onClick={() =>
                                    onToggleParticipation(event.id, event.title, isGoing)
                                  }
                                  aria-label={`${isGoing ? 'Poista ilmoittautuminen' : 'Ilmoittaudu mukaan'}: ${event.title}. Osallistujia: ${visibleParticipantCount}`}
                                  title={
                                    pendingEventIds?.has(event.id)
                                      ? 'Ilmoittautumista tallennetaan'
                                      : isGoing
                                        ? 'Poista ilmoittautuminen tapahtumaan'
                                        : 'Ilmoittaudu tapahtumaan'
                                  }
                                  className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border p-2 transition-colors disabled:cursor-wait disabled:opacity-60 ${
                                    isGoing
                                      ? 'border-[#2F5D50] bg-[var(--color-accent-soft)] text-[var(--color-ink)]'
                                      : 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white hover:brightness-110'
                                  }`}
                                >
                                  <ParticipationIcon
                                    aria-hidden="true"
                                    className="h-5 w-5"
                                    strokeWidth={2}
                                  />
                                </button>
                              )}
                              {onOpenEventChat && (
                                <button
                                  type="button"
                                  onClick={() => onOpenEventChat(event.id, event.title)}
                                  aria-label={`Avaa tapahtumakeskustelu: ${event.title}`}
                                  title="Keskustele tapahtumaan menossa olevien kanssa"
                                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--color-carmine)] bg-[var(--color-carmine)] p-2 text-white transition-colors hover:brightness-95"
                                >
                                  <MessageCircle
                                    aria-hidden="true"
                                    className="h-5 w-5"
                                    strokeWidth={2}
                                  />
                                </button>
                              )}
                              <a
                                href={calendarUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => onLogSelection?.('GCAL_EXPORT', event.id)}
                                aria-label={`Lisää tapahtuma Google Kalenteriin: ${event.title}`}
                                title="Lisää tapahtuma Google Kalenteriin"
                                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-[var(--color-ink)] transition-colors hover:bg-[var(--color-bg)]"
                              >
                                <CalendarPlus
                                  aria-hidden="true"
                                  className="h-5 w-5"
                                  strokeWidth={2}
                                />
                              </a>
                              {onOpenMap && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    selectEvent(event.id, event.coords)
                                    onOpenMap(event.coords, event.id)
                                  }}
                                  aria-label={`Avaa tapahtuman sijainti kartalla: ${event.title}`}
                                  title="Kohdista kartta tapahtuman sijaintiin"
                                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-[var(--color-ink)] transition-colors hover:bg-[var(--color-bg)]"
                                >
                                  <MapPin
                                    aria-hidden="true"
                                    className="h-5 w-5 text-[var(--color-accent)]"
                                    strokeWidth={2}
                                  />
                                </button>
                              )}
                              {event.url && (
                                <a
                                  href={event.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Lisätiedot tapahtumasta: ${event.title}`}
                                  title="Avaa tapahtuman lisätiedot"
                                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-[var(--color-ink)] transition-colors hover:bg-[var(--color-bg)]"
                                >
                                  <ExternalLink
                                    aria-hidden="true"
                                    className="h-5 w-5"
                                    strokeWidth={2}
                                  />
                                </a>
                              )}
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      ) : (
        <div className="min-w-0 flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="font-bold text-slate-800">
              Tapahtumalista ({activeCityFilter}): {cityFilteredAllEvents.length} kpl{' '}
              <span className="font-normal text-slate-500">
                (kartalla enintään {MAX_MAP_EVENT_PINS} lähintä / kaupunki)
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-slate-500">Eräkoko:</span>
              {([25, 50] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    setListPageSize(size)
                    setListPage(1)
                  }}
                  className={`min-h-11 px-2 py-0.5 rounded-md font-bold text-[11px] border ${
                    listPageSize === size
                      ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                      : 'bg-[var(--color-surface)] text-[var(--color-ink)] border-[var(--color-border)] hover:bg-[var(--color-bg)]'
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
                    onClick={() => setListPage((page) => Math.max(1, page - 1))}
                    className="min-h-11 min-w-11 px-2 py-0.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] font-semibold disabled:opacity-40"
                  >
                    ←
                  </button>
                  <span className="font-mono text-[11px] text-slate-700">
                    {safeListPage}/{totalListPages}
                  </span>
                  <button
                    type="button"
                    disabled={safeListPage >= totalListPages}
                    onClick={() => setListPage((page) => Math.min(totalListPages, page + 1))}
                    className="min-h-11 min-w-11 px-2 py-0.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] font-semibold disabled:opacity-40"
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {paginatedBottomEvents.map((event) => (
                <div
                  key={event.id}
                  className="min-w-0 bg-[var(--color-surface)] rounded-3xl p-2.5 border border-[var(--color-border)] flex items-start justify-between gap-2 text-xs"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="text-[10px] font-bold text-[var(--color-accent)] uppercase">
                      {event.district ? `${event.district} (${event.city})` : event.city} •{' '}
                      {event.hasExactCoords ? '' : '~'}
                      {event.distanceKm} km • {event.ageGroup}
                    </div>
                    <div className="font-bold text-slate-900 truncate">{event.title}</div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {getEventVenueLabel(event)} • {getEventTimeLabel(event)}
                    </div>
                  </div>
                  {event.url && (
                    <a
                      href={event.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-11 shrink-0 px-2 py-1 rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-ink)] font-bold text-[11px] hover:brightness-95"
                    >
                      Avaa ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
