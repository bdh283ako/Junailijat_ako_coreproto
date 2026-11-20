import { INITIAL_EVENTS, type FamilyEvent } from './protoData'

export interface EventCoordinates {
  lat: number
  lng: number
}

export interface NormalizedEvent {
  id: string
  title: string
  startDate: string // ISO-8601
  endDate?: string // ISO-8601
  locationName?: string
  address?: string
  city?: string
  coordinates?: EventCoordinates
  description?: string
  url?: string
  imageUrl?: string
  ageRangeLabel: string // esim. "2–6 v" tai "Kaikki ikäryhmät"
  tags: string[]
  source: string
}

export interface FetchEventsOptions {
  feedUrl?: string
  timeoutMs?: number
  revalidateSeconds?: number
}

export interface FetchEventsResult {
  events: NormalizedEvent[]
  sourceUrl: string
  fetchedAt: string
  isFallback: boolean
  httpStatus?: number | null
  error?: string
  sources?: {
    karoCount: number
    linkedEventsCount: number
  }
}

export interface KaroEventsFeedResult {
  events: FamilyEvent[]
  sourceStatus: 'live-api' | 'fallback'
  httpStatus: number | null
  errorDetail?: string
  rawCount: number
  sources?: {
    karoCount: number
    linkedEventsCount: number
  }
}

export const DEFAULT_FEED_URL =
  'https://eventpulsebyjunailijat.ai.studio/api/events/feed.jsonld'

const AGE_TAG_REGEX =
  /^(?:ikä\s*:?\s*)?(\d{1,2}\s*[-–]\s*\d{1,2}\s*v?|\d{1,2}\s*\+\s*v?|alle\s+\d{1,2}\s*v?)$/i

const VENUE_COORDS_LOOKUP: Record<string, EventCoordinates> = {
  oodi: { lat: 60.1741, lng: 24.9381 },
  'keskustakirjasto oodi': { lat: 60.1741, lng: 24.9381 },
  kiasma: { lat: 60.1717, lng: 24.9369 },
  annantalo: { lat: 60.1683, lng: 24.9333 },
  kaapelitehdas: { lat: 60.1622, lng: 24.9041 },
  sello: { lat: 60.2179, lng: 24.8124 },
  'sellon kirjasto': { lat: 60.2179, lng: 24.8124 },
  'isoon omenaan': { lat: 60.1613, lng: 24.7385 },
  'iso omena': { lat: 60.1613, lng: 24.7385 },
  tapiola: { lat: 60.1755, lng: 24.8054 },
  'espoon kulttuurikeskus': { lat: 60.1758, lng: 24.8047 },
  emma: { lat: 60.1786, lng: 24.7944 },
  weegee: { lat: 60.1786, lng: 24.7944 },
  heureka: { lat: 60.2876, lng: 25.0405 },
  tiksi: { lat: 60.2934, lng: 25.0378 },
  tikkurila: { lat: 60.2934, lng: 25.0378 },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }
  return undefined
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function normalizeIsoDate(value: unknown): string | undefined {
  const str = asNonEmptyString(value)
  if (!str) return undefined
  const parsed = new Date(str)
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed.toISOString()
}

function normalizeAgeText(rawText: string): string {
  const cleaned = rawText.replace(/^ikä\s*:?\s*/i, '').trim()

  const rangeMatch = cleaned.match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})\s*v?$/i)
  if (rangeMatch) {
    return `${rangeMatch[1]}–${rangeMatch[2]} v`
  }

  const plusMatch = cleaned.match(/^(\d{1,2})\s*\+\s*v?$/i)
  if (plusMatch) {
    return `${plusMatch[1]}+ v`
  }

  const underMatch = cleaned.match(/^alle\s+(\d{1,2})\s*v?$/i)
  if (underMatch) {
    return `alle ${underMatch[1]} v`
  }

  return cleaned
}

function extractFromAudience(audience: unknown): string | undefined {
  if (!audience) return undefined

  if (Array.isArray(audience)) {
    for (const item of audience) {
      const found = extractFromAudience(item)
      if (found) return found
    }
    return undefined
  }

  if (typeof audience === 'string') {
    const trimmed = audience.trim()
    return trimmed ? normalizeAgeText(trimmed) : undefined
  }

  if (isRecord(audience)) {
    const minAge =
      asFiniteNumber(audience.suggestedMinAge) ??
      asFiniteNumber(audience.minAge)
    const maxAge =
      asFiniteNumber(audience.suggestedMaxAge) ??
      asFiniteNumber(audience.maxAge)

    if (minAge !== undefined && maxAge !== undefined) {
      return `${minAge}–${maxAge} v`
    }
    if (minAge !== undefined) {
      return `${minAge}+ v`
    }
    if (maxAge !== undefined) {
      return `alle ${maxAge} v`
    }

    const audienceType = asNonEmptyString(audience.audienceType)
    if (audienceType) return normalizeAgeText(audienceType)

    const name = asNonEmptyString(audience.name)
    if (name) return normalizeAgeText(name)
  }

  return undefined
}

function collectRawTags(rawEvent: Record<string, unknown>): string[] {
  const collected: string[] = []

  const pushStringOrArray = (field: unknown) => {
    if (Array.isArray(field)) {
      for (const item of field) {
        if (typeof item === 'string' && item.trim()) {
          collected.push(item.trim())
        } else if (
          isRecord(item) &&
          typeof item.name === 'string' &&
          item.name.trim()
        ) {
          collected.push(item.name.trim())
        }
      }
    } else if (typeof field === 'string' && field.trim()) {
      for (const part of field.split(',')) {
        const trimmed = part.trim()
        if (trimmed) collected.push(trimmed)
      }
    }
  }

  pushStringOrArray(rawEvent.tags)
  pushStringOrArray(rawEvent.keywords)
  pushStringOrArray(rawEvent.category)

  return collected
}

export function extractAgeAndCleanTags(
  rawEvent: Record<string, unknown>,
  rawTags: string[],
): { ageRangeLabel: string; cleanedTags: string[] } {
  let detectedAge: string | undefined

  const explicitLabel =
    asNonEmptyString(rawEvent.ageRangeLabel) ??
    asNonEmptyString(rawEvent.typicalAgeRange) ??
    asNonEmptyString(rawEvent.ageRange)

  if (explicitLabel) {
    detectedAge = normalizeAgeText(explicitLabel)
  } else {
    const minAge = asFiniteNumber(rawEvent.minAge)
    const maxAge = asFiniteNumber(rawEvent.maxAge)

    if (minAge !== undefined && maxAge !== undefined) {
      detectedAge = `${minAge}–${maxAge} v`
    } else if (minAge !== undefined) {
      detectedAge = `${minAge}+ v`
    } else if (maxAge !== undefined) {
      detectedAge = `alle ${maxAge} v`
    } else {
      detectedAge = extractFromAudience(rawEvent.audience)
    }
  }

  const seenTags = new Set<string>()
  const cleanedTags: string[] = []

  for (const tag of rawTags) {
    const trimmed = tag.trim()
    if (!trimmed) continue

    if (AGE_TAG_REGEX.test(trimmed)) {
      if (!detectedAge) {
        detectedAge = normalizeAgeText(trimmed)
      }
      continue
    }

    const dedupeKey = trimmed.toLowerCase()
    if (!seenTags.has(dedupeKey)) {
      seenTags.add(dedupeKey)
      cleanedTags.push(trimmed)
    }
  }

  return {
    ageRangeLabel: detectedAge ?? 'Kaikki ikäryhmät',
    cleanedTags,
  }
}

function lookupVenueCoordinates(searchText: string): EventCoordinates | undefined {
  const normalized = searchText.toLowerCase().trim()
  if (!normalized) return undefined

  for (const [key, coords] of Object.entries(VENUE_COORDS_LOOKUP)) {
    if (normalized.includes(key)) {
      return coords
    }
  }

  return undefined
}

function extractLocation(rawLocation: unknown): {
  locationName?: string
  address?: string
  city?: string
  coordinates?: EventCoordinates
} {
  if (!rawLocation) return {}

  if (typeof rawLocation === 'string') {
    const locationName = rawLocation.trim()
    return {
      locationName,
      coordinates: lookupVenueCoordinates(locationName),
    }
  }

  if (!isRecord(rawLocation)) return {}

  const locationName = asNonEmptyString(rawLocation.name)

  let address: string | undefined
  let city: string | undefined

  if (typeof rawLocation.address === 'string') {
    address = rawLocation.address.trim()
  } else if (isRecord(rawLocation.address)) {
    const street = asNonEmptyString(rawLocation.address.streetAddress)
    const locality = asNonEmptyString(rawLocation.address.addressLocality)
    city = locality
    address = [street, locality].filter(Boolean).join(', ') || undefined
  }

  let coordinates: EventCoordinates | undefined
  if (isRecord(rawLocation.geo)) {
    const lat = asFiniteNumber(rawLocation.geo.latitude ?? rawLocation.geo.lat)
    const lng = asFiniteNumber(rawLocation.geo.longitude ?? rawLocation.geo.lng)
    if (lat !== undefined && lng !== undefined) {
      coordinates = { lat, lng }
    }
  }

  if (!coordinates) {
    coordinates = lookupVenueCoordinates(
      [locationName, address].filter(Boolean).join(' '),
    )
  }

  return {
    locationName,
    address,
    city,
    coordinates,
  }
}

function extractImageUrl(rawImage: unknown): string | undefined {
  if (typeof rawImage === 'string' && rawImage.trim()) {
    return rawImage.trim()
  }
  if (Array.isArray(rawImage)) {
    for (const entry of rawImage) {
      const found = extractImageUrl(entry)
      if (found) return found
    }
  }
  if (isRecord(rawImage)) {
    return asNonEmptyString(rawImage.url ?? rawImage.contentUrl)
  }
  return undefined
}

function extractRawItems(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord)
  }

  if (!isRecord(payload)) {
    return []
  }

  if (Array.isArray(payload['@graph'])) {
    return payload['@graph'].filter(isRecord)
  }

  if (Array.isArray(payload.itemListElement)) {
    return payload.itemListElement
      .map((entry) => {
        if (isRecord(entry) && isRecord(entry.item)) {
          return entry.item
        }
        return entry
      })
      .filter(isRecord)
  }

  if (Array.isArray(payload.events)) {
    return payload.events.filter(isRecord)
  }

  if (Array.isArray(payload.items)) {
    return payload.items.filter(isRecord)
  }

  if (payload.name || payload.title || payload.startDate) {
    return [payload]
  }

  return []
}

function buildStableId(
  rawEvent: Record<string, unknown>,
  title: string,
  startDate: string,
  locationName?: string,
): string {
  const explicitId =
    asNonEmptyString(rawEvent['@id']) ?? asNonEmptyString(rawEvent.id)
  if (explicitId) return explicitId

  const base = `${title}|${startDate}|${locationName ?? ''}`
    .toLowerCase()
    .replace(/[^a-z0-9äöå|:-]+/g, '-')
  return `evt-${base}`
}

export function normalizeRawEvent(
  rawEvent: Record<string, unknown>,
  sourceLabel = 'karo-eventpulse-feed',
): NormalizedEvent | null {
  const title =
    asNonEmptyString(rawEvent.name) ?? asNonEmptyString(rawEvent.title)
  const startDate = normalizeIsoDate(
    rawEvent.startDate ?? rawEvent.start_date ?? rawEvent.startsAt,
  )

  if (!title || !startDate) {
    return null
  }

  const endDate = normalizeIsoDate(
    rawEvent.endDate ?? rawEvent.end_date ?? rawEvent.endsAt,
  )
  const description = asNonEmptyString(rawEvent.description)
  const url = asNonEmptyString(rawEvent.url ?? rawEvent['@id'])
  const imageUrl = extractImageUrl(rawEvent.image)

  let { locationName, address, city, coordinates } = extractLocation(
    rawEvent.location ?? rawEvent.venue,
  )

  if (!locationName) {
    locationName = asNonEmptyString(rawEvent.locationName)
  }
  if (!address) {
    address = asNonEmptyString(rawEvent.address)
  }
  if (!city) {
    city = asNonEmptyString(rawEvent.city)
  }
  if (!coordinates && isRecord(rawEvent.coordinates)) {
    const lat = asFiniteNumber(rawEvent.coordinates.lat ?? rawEvent.coordinates.latitude)
    const lng = asFiniteNumber(rawEvent.coordinates.lng ?? rawEvent.coordinates.longitude)
    if (lat !== undefined && lng !== undefined) {
      coordinates = { lat, lng }
    }
  }
  if (!coordinates) {
    coordinates = lookupVenueCoordinates(
      [locationName, address, city].filter(Boolean).join(' '),
    )
  }

  const rawTags = collectRawTags(rawEvent)
  const { ageRangeLabel, cleanedTags } = extractAgeAndCleanTags(
    rawEvent,
    rawTags,
  )

  const id = buildStableId(rawEvent, title, startDate, locationName)
  const resolvedSource = asNonEmptyString(rawEvent.source) ?? sourceLabel

  return {
    id,
    title,
    startDate,
    endDate,
    locationName,
    address,
    city,
    coordinates,
    description,
    url,
    imageUrl,
    ageRangeLabel,
    tags: cleanedTags,
    source: resolvedSource,
  }
}

export async function fetchNormalizedEvents(
  options: FetchEventsOptions = {},
): Promise<FetchEventsResult> {
  const feedUrl = options.feedUrl ?? DEFAULT_FEED_URL
  const timeoutMs = options.timeoutMs ?? 8000
  const fetchedAt = new Date().toISOString()

  try {
    const response = await fetch(feedUrl, {
      cache: 'no-store',
      headers: {
        Accept: 'application/ld+json, application/json;q=0.9',
      },
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!response.ok) {
      return {
        events: [],
        sourceUrl: feedUrl,
        fetchedAt,
        isFallback: true,
        httpStatus: response.status,
        error: `Feed request failed with HTTP ${response.status}`,
      }
    }

    const payload: unknown = await response.json()
    const rawItems = extractRawItems(payload)

    const dedupeMap = new Map<string, NormalizedEvent>()

    for (const item of rawItems) {
      const normalized = normalizeRawEvent(item)
      if (!normalized) continue

      const dedupeKey = `${normalized.title.toLowerCase()}|${normalized.startDate}|${(
        normalized.locationName ?? ''
      ).toLowerCase()}`

      if (!dedupeMap.has(dedupeKey)) {
        dedupeMap.set(dedupeKey, normalized)
      }
    }

    const events = Array.from(dedupeMap.values()).sort(
      (a, b) =>
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
    )

    const payloadIsFallback =
      isRecord(payload) && typeof payload.isFallback === 'boolean'
        ? payload.isFallback
        : false

    const payloadWarning =
      isRecord(payload) ? asNonEmptyString(payload.warning) : undefined

    const payloadSources =
      isRecord(payload) && isRecord(payload.sources)
        ? {
            karoCount: asFiniteNumber(payload.sources.karoCount) ?? 0,
            linkedEventsCount: asFiniteNumber(payload.sources.linkedEventsCount) ?? 0,
          }
        : undefined

    return {
      events,
      sourceUrl: feedUrl,
      fetchedAt,
      isFallback: payloadIsFallback || events.length === 0,
      httpStatus: response.status,
      error: payloadWarning,
      sources: payloadSources,
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown error fetching event feed'

    return {
      events: [],
      sourceUrl: feedUrl,
      fetchedAt,
      isFallback: true,
      httpStatus: null,
      error: message,
    }
  }
}

function formatEventTime(startIso?: string, endIso?: string): string {
  if (!startIso) return 'Katso ajankohta'
  const start = new Date(startIso)
  if (Number.isNaN(start.getTime())) return startIso

  const datePart = start.toLocaleDateString('fi-FI', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
  })
  const startTimePart = start.toLocaleTimeString('fi-FI', {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (endIso) {
    const end = new Date(endIso)
    if (!Number.isNaN(end.getTime())) {
      const endTimePart = end.toLocaleTimeString('fi-FI', {
        hour: '2-digit',
        minute: '2-digit',
      })
      return `${datePart} klo ${startTimePart}–${endTimePart}`
    }
  }

  return `${datePart} klo ${startTimePart}`
}

function toFamilyEvent(evt: NormalizedEvent): FamilyEvent {
  const isFree = evt.tags.some((t) => t.toLowerCase().includes('maksuton'))
  const coordsTuple: [number, number] | undefined = evt.coordinates
    ? [evt.coordinates.lat, evt.coordinates.lng]
    : undefined

  return {
    id: evt.id,
    title: evt.title,
    city: evt.city || 'Helsinki',
    venue: evt.locationName || evt.address || 'Pääkaupunkiseutu',
    time: formatEventTime(evt.startDate, evt.endDate),
    ageGroup: evt.ageRangeLabel || 'Lapset & perheet',
    price: isFree ? 'Maksuton' : 'Katso tiedot',
    coords: coordsTuple as [number, number],
    url: evt.url,
    description: evt.description,
  }
}

export async function fetchKaroEventsFeed(
  endpointOrOptions: string | FetchEventsOptions = '/api/events',
): Promise<KaroEventsFeedResult> {
  const options: FetchEventsOptions =
    typeof endpointOrOptions === 'string'
      ? { feedUrl: endpointOrOptions }
      : endpointOrOptions

  const result = await fetchNormalizedEvents({
    feedUrl: options.feedUrl ?? '/api/events',
    timeoutMs: options.timeoutMs ?? 8000,
    revalidateSeconds: options.revalidateSeconds,
  })

  const mapped = result.events.map(toFamilyEvent)
  const isLive = !result.isFallback && mapped.length > 0

  return {
    events: mapped.length > 0 ? mapped : INITIAL_EVENTS,
    sourceStatus: isLive ? 'live-api' : 'fallback',
    httpStatus: result.httpStatus ?? null,
    errorDetail: result.error,
    rawCount: mapped.length,
    sources: result.sources,
  }
}