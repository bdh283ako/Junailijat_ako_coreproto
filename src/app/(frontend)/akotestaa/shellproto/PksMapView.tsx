'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarPlus,
  CalendarDays,
  ChevronDown,
  Coins,
  ExternalLink,
  House,
  MapPin,
  MessageCircle,
  Search,
  Tag,
  UserPlus,
  Users,
} from 'lucide-react'
import { calcDistanceKm, FamilyEvent, FamilyProfile, PKS_MLL_FAMILY_CAFES } from './protoData'
import { buildGoogleCalendarUrl } from './googleCalendar'
import { DEFAULT_PKS_COORDS, resolveEventsForMap, type CityOnlyGroup } from './mapGeoResolver'
import {
  getPksCityFilterLabel,
  PKS_ALL_CITIES,
  PKS_CITY_FILTER_OPTIONS,
} from './pksAreas'
import { CANONICAL_EVENT_FILTERS } from './eventTaxonomy'

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
  marker: (
    coords: [number, number],
    options?: { icon?: unknown; title?: string },
  ) => LeafletDivIconMarker
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
  source?: string
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

const MAP_SOURCE_COLORS = {
  linked: '#9E4B16',
  lahella: '#BE5518',
  eventPulse: '#6B3F79',
} as const

const CANONICAL_MAP_FILTERS = CANONICAL_EVENT_FILTERS

type CanonicalMapFilter = (typeof CANONICAL_MAP_FILTERS)[number]

function isDebugMapEnabled(): boolean {
  if (typeof window === 'undefined') return false
  const debug = new URLSearchParams(window.location.search).get('debug')
  return debug === '1' || debug === 'true'
}

function getEventSourceColor(source: string | undefined): string {
  const normalized = (source ?? '').toLowerCase()
  if (normalized.includes('lahella')) return MAP_SOURCE_COLORS.lahella
  if (normalized.includes('linked')) return MAP_SOURCE_COLORS.linked
  if (normalized.includes('karo') || normalized.includes('eventpulse')) {
    return MAP_SOURCE_COLORS.eventPulse
  }
  return MAP_MARKER_COLORS.event
}

function getMeetingPlaceMarkerSvg(color: string, selected = false): string {
  const ring = selected ? '#2E211B' : '#FFFFFF'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 44 52" role="img" aria-label="Kohtaamispaikka">
    <path d="M22 2C11.5 2 3 10.5 3 21c0 14 19 29 19 29s19-15 19-29C41 10.5 32.5 2 22 2Z" fill="${color}" stroke="${ring}" stroke-width="3"/>
    <path d="M15 19h10v9c0 4-3 7-7 7h-1c-4 0-7-3-7-7v-1h5m5-8h3c3 0 5 2 5 5s-2 5-5 5h-3" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`
}

function getEventMarkerSvg(color: string, selected = false, count?: number): string {
  const ring = selected ? '#2E211B' : '#FFFFFF'
  const countLabel = count === undefined ? '' : count > 99 ? '99+' : String(count)
  const countFontSize = countLabel.length > 2 ? 9 : 13
  const iconContent = count === undefined
    ? '<rect x="13" y="13" width="18" height="16" rx="3" fill="none" stroke="#FFFFFF" stroke-width="2"/><path d="M18 10v6M26 10v6M13 20h18M18 24h8" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>'
    : `<text x="22" y="29" text-anchor="middle" font-size="${countFontSize}" font-weight="800" fill="#FFFFFF">${countLabel}</text>`
  const ariaLabel = count === undefined ? 'Tapahtuma' : `${count} tapahtumaa samassa sijainnissa`
  const width = count === undefined ? 26 : 30
  const height = count === undefined ? 34 : 38
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 44 52" role="img" aria-label="${ariaLabel}">
    <path d="M22 2C11.5 2 3 10.5 3 21c0 14 19 29 19 29s19-15 19-29C41 10.5 32.5 2 22 2Z" fill="${color}" stroke="${ring}" stroke-width="3"/>
    ${iconContent}
  </svg>`
}

function getFamilyMarkerSvg(selected = false): string {
  const ring = selected ? '#2E211B' : '#FFFFFF'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 44 52" role="img" aria-label="Perhematsi">
    <path d="M22 2C11.5 2 3 10.5 3 21c0 14 19 29 19 29s19-15 19-29C41 10.5 32.5 2 22 2Z" fill="#9CB9B7" stroke="${ring}" stroke-width="3"/>
    <circle cx="17" cy="18" r="4" fill="#2F5D50"/>
    <circle cx="27" cy="18" r="4" fill="#2F5D50"/>
    <path d="M12 31c1-6 5-9 10-9s9 3 10 9" fill="none" stroke="#2F5D50" stroke-width="3" stroke-linecap="round"/>
  </svg>`
}

function getHomeMarkerSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 48 56" role="img" aria-label="Oma kotisijainti">
    <circle cx="24" cy="24" r="21" fill="#1F4E79" fill-opacity=".16" stroke="#1F4E79" stroke-width="3"/>
    <path d="M24 6C14.1 6 6 14.1 6 24c0 13.2 18 27 18 27s18-13.8 18-27C42 14.1 33.9 6 24 6Z" fill="#1F4E79" stroke="#FFFFFF" stroke-width="3"/>
    <path d="m15 24 9-8 9 8v9H28v-7h-8v7h-5v-9Z" fill="#FFFFFF"/>
  </svg>`
}

function wrapMarkerSvg(svg: string): string {
  return `<div style="width:44px;height:44px;display:flex;align-items:flex-end;justify-content:center;pointer-events:none;">${svg}</div>`
}

function getEventVenueLabel(evt: MapEventRecord): string {
  return evt.locationName || evt.venue || evt.address || evt.city
}

function getEventTimeLabel(evt: MapEventRecord): string {
  return evt.time || evt.startDate || ''
}

const FI_MONTH_SHORT = [
  'tammi',
  'helmi',
  'maalis',
  'huhti',
  'touko',
  'kesä',
  'heinä',
  'elo',
  'syys',
  'loka',
  'marras',
  'joulu',
]

function getCompactEventDateLabel(evt: MapEventRecord): { day: string; month: string } | null {
  const localizedDate = (evt.time ?? '').match(/(\d{1,2})\.(\d{1,2})\./)
  const isoDate = (evt.startDate ?? '').match(/^\d{4}-(\d{2})-(\d{2})/)
  const day = localizedDate?.[1] ?? isoDate?.[2]
  const monthNumber = Number(localizedDate?.[2] ?? isoDate?.[1])
  const month = FI_MONTH_SHORT[monthNumber - 1]
  return day && month ? { day, month } : null
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

  const [meetingPlaceMode, setMeetingPlaceMode] = useState<'off' | 'alongside'>('off')
  const [activeCanonicalFilters, setActiveCanonicalFilters] = useState<CanonicalMapFilter[]>([])
  const [paidOnly, setPaidOnly] = useState(false)

  // Kartan alla olevan listan sivutus (25 tai 50 kpl / sivu)
  const [listPageSize, setListPageSize] = useState<25 | 50>(25)
  const [listPage, setListPage] = useState<number>(1)
  const [mapEventSearchQuery, setMapEventSearchQuery] = useState('')

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
      .filter((evt) => {
        const tagText = [
          ...(evt.tags ?? []),
          ...(evt.keywords ?? []),
          evt.ageGroup ?? '',
          evt.description ?? '',
        ]
          .join(' ')
          .toLowerCase()
        const isMeetingPlace =
          /hm_kohtaamispaikka|\bplace\b|kohtaamispaikka|perhekahvil/.test(tagText)
        if (meetingPlaceMode === 'off' && isMeetingPlace) return false
        if (activeCanonicalFilters.length === 0 && !paidOnly) return true
        const eventTags = [...(evt.tags ?? []), ...(evt.keywords ?? [])]
          .concat(evt.ageGroup ?? '')
          .map((tag) => tag.toLowerCase())
        if (paidOnly && !eventTags.includes('maksullinen')) return false
        return activeCanonicalFilters.every((filter) =>
          eventTags.includes(filter.toLowerCase()),
        )
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
  }, [events, safeHome, activeCityFilter, activeCanonicalFilters, meetingPlaceMode, paidOnly])

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

  // MLL-perhekahvilat seuraavat kohtaamispaikkojen kytkintä ja kaupunkirajausta.
  const visibleMllCafes = useMemo(() => {
    if (meetingPlaceMode === 'off') return []
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
  }, [meetingPlaceMode, activeCityFilter, safeHome])

  const visibleMatchedFamilies = useMemo(() => {
    if (activeCityFilter === PKS_ALL_CITIES) return matchedFamilies
    return matchedFamilies.filter((f) => f.city.toLowerCase() === activeCityFilter.toLowerCase())
  }, [matchedFamilies, activeCityFilter])

  const normalizedMapEventSearch = mapEventSearchQuery.trim().toLowerCase()
  const searchedMapEvents = useMemo(() => {
    if (!normalizedMapEventSearch) return cityFilteredAllEvents
    return cityFilteredAllEvents.filter((event) =>
      [
        event.title,
        getEventVenueLabel(event),
        event.city,
        event.district ?? '',
        event.description ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedMapEventSearch),
    )
  }, [cityFilteredAllEvents, normalizedMapEventSearch])

  // Sivutuslaskenta haetulle kartan alla olevalle listalle
  const totalListPages = Math.max(1, Math.ceil(searchedMapEvents.length / listPageSize))
  const safeListPage = Math.min(listPage, totalListPages)
  const paginatedBottomEvents = useMemo(() => {
    const startIdx = (safeListPage - 1) * listPageSize
    return searchedMapEvents.slice(startIdx, startIdx + listPageSize)
  }, [searchedMapEvents, safeListPage, listPageSize])

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

    // Oma koti: syvä sininen koti-ikoni
    L.marker(safeHome, {
      icon: L.divIcon({
        className: 'perhepiiri-home-marker',
        html: wrapMarkerSvg(getHomeMarkerSvg()),
        iconSize: [44, 44],
        iconAnchor: [22, 44],
      }),
      title: 'Oma kotisijainti',
    })
      .addTo(markerLayer)
      .bindPopup(
        `<strong>Oma koti (${familyName})</strong><br/>${homeLabel}<br/><span style="font-size:11px;color:#1F4E79;">Klikkaus zoomaa oletusnäkymään</span>`,
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
        const clusterColor = isDebugMapEnabled()
          ? getEventSourceColor(firstPin.event.source)
          : MAP_MARKER_COLORS.event
        const badgeIcon = L.divIcon({
          className: 'perhepiiri-event-cluster',
          html: wrapMarkerSvg(getEventMarkerSvg(clusterColor, false, eventCount)),
          iconSize: [44, 44],
          iconAnchor: [22, 44],
        })
        const eventRows = pins
          .map(({ event: evt }) => {
            const time = getEventTimeLabel(evt)
            const venue = getEventVenueLabel(evt)
            const isGoing = attendingIds.includes(evt.id)
            return `<li style="padding:6px 0;border-bottom:1px solid #e2e8f0;"><strong>${escapeHtml(evt.title)}</strong><br/><span style="font-size:11px;color:#475569;">${escapeHtml(venue)}${time ? ` • ${escapeHtml(time)}` : ''}${isGoing ? ' • ✅ Olet menossa mukaan' : ''}</span></li>`
          })
          .join('')

        L.marker(coords, {
          icon: badgeIcon,
          title: `${eventCount} tapahtumaa samassa sijainnissa`,
        })
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

      const eventColor = isDebugMapEnabled() ? getEventSourceColor(evt.source) : MAP_MARKER_COLORS.event
      L.marker(coords, {
        icon: L.divIcon({
          className: 'perhepiiri-event-marker',
          html: wrapMarkerSvg(getEventMarkerSvg(eventColor, isSelected)),
          iconSize: [44, 44],
          iconAnchor: [22, 44],
        }),
        title: evt.title,
      })
        .addTo(markerLayer)
        .bindPopup(
          `<span style="font-size:10px;font-weight:700;color:${eventColor};">TARKKA SIJAINTI (${evt.city})</span><br/><strong>${escapeHtml(evt.title)}</strong><br/>${escapeHtml(venueText)}<br/>${
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

      const eventColor = isDebugMapEnabled() ? getEventSourceColor(evt.source) : MAP_MARKER_COLORS.event
      L.marker(plotCoords, {
        icon: L.divIcon({
          className: 'perhepiiri-area-event-marker',
          html: wrapMarkerSvg(getEventMarkerSvg(eventColor, isSelected)),
          iconSize: [44, 44],
          iconAnchor: [22, 44],
        }),
        title: evt.title,
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
    if (meetingPlaceMode !== 'off') {
      visibleMllCafes.forEach((cafe) => {
        const linkHtml = cafe.url
          ? `<br/><a href="${cafe.url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:4px;font-size:11px;font-weight:700;color:${MAP_MARKER_COLORS.cafe};text-decoration:underline;">Yhdistyksen sivu ↗</a>`
          : ''

        L.marker(cafe.coords, {
          icon: L.divIcon({
            className: 'perhepiiri-meeting-marker',
            html: wrapMarkerSvg(getMeetingPlaceMarkerSvg('#BE5518')),
            iconSize: [44, 44],
            iconAnchor: [22, 44],
          }),
          title: `MLL-perhekahvila: ${cafe.name}`,
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

      L.marker(fam.coords, {
        icon: L.divIcon({
          className: 'perhepiiri-family-marker',
          html: wrapMarkerSvg(getFamilyMarkerSvg(isSelected)),
          iconSize: [44, 44],
          iconAnchor: [22, 44],
        }),
        title: `${fam.name}, perhematsi`,
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
    meetingPlaceMode,
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

        <div className="bg-[var(--color-surface)] border-t border-[var(--color-border)] px-4 md:px-6 py-2 text-xs shrink-0">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2 font-medium text-[var(--color-ink)]">
              <label className="inline-flex items-center gap-1.5 font-bold text-[var(--color-ink)]">
                <MapPin aria-hidden="true" size={16} strokeWidth={2} />
              <select
                value={activeCityFilter}
                onChange={(e) => handleCityChange(e.target.value)}
                aria-label="Kaupunkifiltteri"
                className="min-h-11 px-2.5 py-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-ink)] font-bold text-xs"
              >
                {PKS_CITY_FILTER_OPTIONS.map((city) => (
                  <option key={city} value={city}>
                    {getPksCityFilterLabel(city)}
                  </option>
                ))}
              </select>
              </label>

              <span className="inline-flex items-center gap-1">
                <House aria-hidden="true" size={14} strokeWidth={2} className="text-[#1F4E79]" />
                Koti
              </span>
              <span
                className="inline-flex items-center gap-1"
                title="Kartalla näytetään enintään 25 lähintä tapahtumaa kaupunkia kohden. Vain täsmälleen samoihin koordinaatteihin osuvat tapahtumat ryhmitellään."
              >
                <CalendarDays
                  aria-hidden="true"
                  size={14}
                  strokeWidth={2}
                  className="text-[#9E4B16]"
                />
                Tapahtumat ({mapCappedEvents.length}/{cityFilteredAllEvents.length})
              </span>
              {resolvedMap.stats.cityOnlyCount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setSelectedCityGroup((prev) =>
                      prev ? null : (resolvedMap.cityGroups[0] ?? null),
                    )
                  }
                  className="min-h-11 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] font-bold hover:bg-[var(--color-bg)]"
                >
                  Kaupunkilista ({resolvedMap.stats.cityOnlyCount})
                </button>
              )}
              <span className="inline-flex items-center gap-1">
                <Users aria-hidden="true" size={14} strokeWidth={2} className="text-[#2F5D50]" />
                Perheosumat ({visibleMatchedFamilies.length})
              </span>
              <div className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-1.5">
                <span className="px-2 text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-muted)]">
                  Karttatasot
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={meetingPlaceMode === 'alongside'}
                  aria-label="Näytä kohtaamispaikat kartalla"
                  onClick={() =>
                    setMeetingPlaceMode((current) =>
                      current === 'alongside' ? 'off' : 'alongside',
                    )
                  }
                  className={`min-h-11 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-bold transition-colors ${
                    meetingPlaceMode === 'alongside'
                      ? 'border-[#8A3D10] bg-[#BE5518] text-white'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-alt)]'
                  }`}
                >
                  <House
                    aria-hidden="true"
                    size={16}
                    strokeWidth={2}
                    className={
                      meetingPlaceMode === 'alongside' ? 'text-white' : 'text-[#8A3D10]'
                    }
                  />
                  <span>Kohtaamispaikat</span>
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={paidOnly}
                  aria-label="Näytä vain maksulliset tapahtumat kartalla"
                  onClick={() => setPaidOnly((current) => !current)}
                  className={`min-h-11 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-bold transition-colors ${
                    paidOnly
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-alt)]'
                  }`}
                >
                  <Coins
                    aria-hidden="true"
                    size={16}
                    strokeWidth={2}
                    className={paidOnly ? 'text-white' : 'text-[var(--color-ink-muted)]'}
                  />
                  <span>Maksullinen</span>
                </button>
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-2 border-t border-[var(--color-border)] pt-2">
              <div
                className="flex min-w-0 flex-wrap items-center gap-1.5"
                aria-label="Sisältö- ja ikätägeittäin suodatus"
              >
                {CANONICAL_MAP_FILTERS.map((filter) => {
                  const active = activeCanonicalFilters.includes(filter)
                  return (
                    <button
                      key={filter}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setActiveCanonicalFilters((current) =>
                          active
                            ? current.filter((item) => item !== filter)
                            : [...current, filter],
                        )
                      }
                      className={`min-h-11 px-2.5 py-1 rounded-full border text-[11px] font-bold ${
                        active
                          ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                          : 'bg-[var(--color-surface)] text-[var(--color-ink)] border-[var(--color-border)]'
                      }`}
                    >
                      {filter}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
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
          <div className="min-w-0 space-y-4">
            <section aria-labelledby="map-families-heading" className="min-w-0 space-y-2">
              <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
                <h2
                  id="map-families-heading"
                  className="text-sm font-bold text-[var(--color-ink)]"
                >
                  Perheosumat
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
                <div
                  role="region"
                  aria-label="Perheosumat, vaakasuunnassa selattava karuselli"
                  tabIndex={0}
                  className="flex min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-2"
                >
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
                        onOpenMap?.(family.coords, family.id)
                      }}
                      className={`relative min-h-11 w-64 shrink-0 snap-start rounded-2xl border p-3 text-left transition-colors ${
                        selectedFamilyId === family.id
                          ? 'border-[#2F5D50] bg-[var(--color-accent-soft)]'
                          : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)]'
                      }`}
                    >
                      <span className="block min-w-0 break-words text-sm font-bold text-[var(--color-ink)]">
                        {family.name}
                      </span>
                      <span className="mt-2 flex min-w-0 flex-wrap gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[10px] font-semibold text-[var(--color-ink)]">
                          <MapPin aria-hidden="true" size={12} strokeWidth={2} />
                          {family.area}, {family.city}
                        </span>
                        <span className="rounded-full border border-[#2F5D50]/40 bg-[var(--color-accent-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--color-ink)]">
                          {family.childrenAges}
                        </span>
                      </span>
                      {family.interests.length > 0 && (
                        <span className="mt-2 flex min-w-0 flex-wrap gap-1">
                          {family.interests.slice(0, 3).map((interest) => (
                            <span
                              key={interest}
                              className="rounded-full bg-[var(--color-bg)] px-2 py-0.5 text-[10px] text-[var(--color-ink-muted)]"
                            >
                              {interest}
                            </span>
                          ))}
                        </span>
                      )}
                      {shareEventsWithMatches &&
                        family.attendingEventId &&
                        eventTitleById.has(family.attendingEventId) && (
                          <span className="mt-2 block min-w-0 break-words text-[11px] font-semibold text-[#2F5D50]">
                            Tapahtuma: {eventTitleById.get(family.attendingEventId)}
                          </span>
                        )}
                      <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#2F5D50]">
                        <MapPin aria-hidden="true" size={13} strokeWidth={2} />
                        Katso kartalla
                      </span>
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
                    {getPksCityFilterLabel(activeCityFilter)}: {searchedMapEvents.length} tapahtumaa
                  </p>
                </div>

                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {([25, 50] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      aria-pressed={listPageSize === size}
                      onClick={() => {
                        setListPageSize(size)
                        setListPage(1)
                      }}
                      className={`min-h-11 px-3 py-0.5 rounded-full font-bold text-[11px] ${
                        listPageSize === size
                          ? 'bg-[var(--color-accent)] text-white'
                          : 'bg-transparent text-[var(--color-ink)] hover:bg-[var(--color-surface-alt)]'
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
                        className="min-h-11 min-w-11 rounded-full text-[var(--color-ink)] font-semibold hover:bg-[var(--color-surface-alt)] disabled:opacity-40"
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
                        className="min-h-11 min-w-11 rounded-full text-[var(--color-ink)] font-semibold hover:bg-[var(--color-surface-alt)] disabled:opacity-40"
                      >
                        →
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <label className="relative block min-w-0">
                <span className="sr-only">Hae tapahtumia kartan listasta</span>
                <Search
                  aria-hidden="true"
                  size={16}
                  strokeWidth={2}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-muted)]"
                />
                <input
                  type="search"
                  value={mapEventSearchQuery}
                  onChange={(event) => {
                    setMapEventSearchQuery(event.target.value)
                    setListPage(1)
                  }}
                  placeholder="Hae tapahtuman nimellä, paikalla tai kuvauksella"
                  className="min-h-11 w-full min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] pl-10 pr-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)]"
                />
              </label>

              {paginatedBottomEvents.length === 0 ? (
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center text-xs text-[var(--color-ink-muted)]">
                  Ei tapahtumia haulla ja alueella {getPksCityFilterLabel(activeCityFilter)}.
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
                    const dateLabel = getCompactEventDateLabel(event)

                    return (
                      <article
                        key={event.id}
                        ref={(element) => {
                          if (element) eventCardRefs.current.set(event.id, element)
                          else eventCardRefs.current.delete(event.id)
                        }}
                        className={`flex min-w-0 items-start gap-2 rounded-2xl border bg-[var(--color-surface)] p-3 transition-colors ${
                          isExpanded
                            ? 'border-[#2F5D50] shadow-sm'
                            : 'border-[var(--color-border)]'
                        }`}
                      >
                        {dateLabel && (
                          <div
                            aria-hidden="true"
                            className="flex min-h-12 w-10 shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border border-[#9E4B16]/40 bg-[var(--color-accent-soft)] px-1 py-1 text-[var(--color-ink)]"
                          >
                            <span className="text-[8px] font-semibold uppercase leading-none">
                              {dateLabel.month}
                            </span>
                            <span className="[font-family:var(--font-date-numeral)] text-base font-semibold leading-none">
                              {dateLabel.day}
                            </span>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
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
                                      ? 'border-[#2F5D50] bg-[var(--color-bg)] text-[#2F5D50]'
                                        : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-ink)]'
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
                            <span className="mt-1 block min-w-0 break-words text-sm font-semibold leading-snug text-[var(--color-ink)]">
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
              Tapahtumalista ({getPksCityFilterLabel(activeCityFilter)}): {searchedMapEvents.length} kpl{' '}
              <span className="font-normal text-slate-500">
                (kartalla enintään {MAX_MAP_EVENT_PINS} lähintä / kaupunki)
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {([25, 50] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  aria-pressed={listPageSize === size}
                  onClick={() => {
                    setListPageSize(size)
                    setListPage(1)
                  }}
                  className={`min-h-11 px-3 py-0.5 rounded-full font-bold text-[11px] ${
                    listPageSize === size
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'bg-transparent text-[var(--color-ink)] hover:bg-[var(--color-surface-alt)]'
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
                    aria-label="Edellinen tapahtumasivu"
                    className="min-h-11 min-w-11 rounded-full text-[var(--color-ink)] font-semibold hover:bg-[var(--color-surface-alt)] disabled:opacity-40"
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
                    aria-label="Seuraava tapahtumasivu"
                    className="min-h-11 min-w-11 rounded-full text-[var(--color-ink)] font-semibold hover:bg-[var(--color-surface-alt)] disabled:opacity-40"
                  >
                    →
                  </button>
                </div>
              )}
            </div>
          </div>
          {paginatedBottomEvents.length === 0 ? (
            <div className="bg-white rounded-xl p-4 border border-slate-200 text-xs text-slate-500 text-center">
              Ei tapahtumia haulla ja alueella {getPksCityFilterLabel(activeCityFilter)}.
            </div>
          ) : (
            <div className="space-y-2">
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
                    <div className="font-semibold text-slate-900 truncate">{event.title}</div>
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
