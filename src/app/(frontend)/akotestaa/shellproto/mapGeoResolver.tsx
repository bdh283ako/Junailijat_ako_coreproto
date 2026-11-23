import {
  DEFAULT_PKS_COORDS as PKS_DEFAULT_COORDS,
  PKS_AREAS,
  PKS_CITY_CENTERS,
  type LatLngTuple,
  type PksAreaEntry,
  type PksCityName,
} from './pksAreas'

export const DEFAULT_PKS_COORDS: LatLngTuple = PKS_DEFAULT_COORDS ?? [60.2055, 24.6559]
export type { LatLngTuple }

export type PinPrecision = 'exact' | 'district' | 'city-only'

export interface GeoResolvableEvent {
  id: string
  title: string
  venue?: string
  locationName?: string
  address?: string
  streetAddress?: string
  district?: string
  neighborhood?: string
  city?: string
  time?: string
  startDate?: string
  ageGroup?: string
  ageRangeLabel?: string
  price?: string
  description?: string
  url?: string
  coords?: unknown
  coordinates?: unknown
  keywords?: string[]
  tags?: string[]
}

export interface ResolvedEventItem<T extends GeoResolvableEvent = GeoResolvableEvent> {
  event: T
  city: string
  district?: string
  precision: PinPrecision
  hasExactCoords: boolean
  effectiveCoords: LatLngTuple
  plotCoords?: LatLngTuple
}

export interface CityOnlyGroup<T extends GeoResolvableEvent = GeoResolvableEvent> {
  city: string
  coords: LatLngTuple
  items: ResolvedEventItem<T>[]
}

export interface ResolvedMapEvents<T extends GeoResolvableEvent = GeoResolvableEvent> {
  all: ResolvedEventItem<T>[]
  exactPins: ResolvedEventItem<T>[]
  districtPins: ResolvedEventItem<T>[]
  cityGroups: CityOnlyGroup<T>[]
  stats: {
    total: number
    exactCount: number
    districtCount: number
    cityOnlyCount: number
    plottedSingleCount: number
  }
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function extractExactTuple(coords: unknown): LatLngTuple | undefined {
  if (Array.isArray(coords) && coords.length >= 2) {
    const a = toFiniteNumber(coords[0])
    const b = toFiniteNumber(coords[1])
    if (a !== null && b !== null && Math.abs(a) <= 90 && Math.abs(b) <= 180) {
      return [a, b]
    }
  }

  if (coords && typeof coords === 'object') {
    const obj = coords as Record<string, unknown>
    const lat = toFiniteNumber(obj.lat ?? obj.latitude)
    const lng = toFiniteNumber(obj.lng ?? obj.lon ?? obj.longitude)
    if (lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return [lat, lng]
    }
  }

  return undefined
}

export function resolveCoordsTuple(
  coords: unknown,
  fallback: LatLngTuple = DEFAULT_PKS_COORDS,
): LatLngTuple {
  return extractExactTuple(coords) ?? fallback
}

function deterministicJitter(seed: string, radiusDeg = 0.0022): LatLngTuple {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  const h1 = ((hash >>> 0) % 10000) / 10000
  const h2 = (((hash >>> 13) ^ (hash >>> 3)) % 10000) / 10000
  return [(h1 - 0.5) * 2 * radiusDeg, (h2 - 0.5) * 2 * radiusDeg * 1.6]
}

function collectLocationHaystack(evt: GeoResolvableEvent): string {
  const rec = evt as unknown as Record<string, unknown>
  const nestedLoc =
    rec.location && typeof rec.location === 'object'
      ? JSON.stringify(rec.location)
      : typeof rec.location === 'string'
        ? rec.location
        : ''

  const parts = [
    evt.district ?? '',
    evt.neighborhood ?? '',
    evt.locationName ?? '',
    evt.venue ?? '',
    evt.address ?? '',
    evt.streetAddress ?? '',
    evt.city ?? '',
    evt.title ?? '',
    Array.isArray(evt.keywords) ? evt.keywords.join(' ') : '',
    Array.isArray(evt.tags) ? evt.tags.join(' ') : '',
    nestedLoc,
  ]

  return parts.join(' ').toLowerCase()
}

function normalizeCity(rawCity?: string, haystack = ''): string {
  const clean = (rawCity || '').trim()
  if (/helsinki|helsingfors/i.test(clean)) return 'Helsinki'
  if (/espoo|esbo/i.test(clean)) return 'Espoo'
  if (/vantaa|vanda/i.test(clean)) return 'Vantaa'
  if (/kauniainen|grankulla/i.test(clean)) return 'Kauniainen'
  if (clean) return clean

  if (/\bespoo\b|\besbo\b|\bespoossa\b|\bespooseen\b/.test(haystack)) return 'Espoo'
  if (/\bvantaa\b|\bvanda\b|\bvantaalla\b|\bvantaalle\b/.test(haystack)) return 'Vantaa'
  if (/\bkauniainen\b|\bgrankulla\b|\bkauniaisissa\b/.test(haystack)) return 'Kauniainen'
  return 'Helsinki'
}

function matchesAliasInText(textLower: string, alias: string): boolean {
  const cleanAlias = alias.trim().toLowerCase()
  if (!cleanAlias) return false

  const escaped = cleanAlias.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

  const stemMatch = cleanAlias.match(/^(.*?)([aäeioöy])$/)
  if (stemMatch && cleanAlias.length >= 4) {
    const base = stemMatch[1].replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
    const vowel = stemMatch[2].replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
    const pattern = `(?:^|[^a-zäöå0-9_-])(?:${escaped}|${base}${vowel}(?:ssa|ssä|lla|llä|sta|stä|lle|lta|ltä|an|än|en|in|hun|hyn|hon|hön|seen|tiin|na|nä)?)(?:$|[^a-zäöå0-9_-])`
    return new RegExp(pattern, 'i').test(textLower)
  }

  return new RegExp(`(?:^|[^a-zäöå0-9_-])${escaped}(?:$|[^a-zäöå0-9_-])`, 'i').test(textLower)
}

function findPksArea(haystackLower: string, city: string): PksAreaEntry | undefined {
  const ordered = [
    ...PKS_AREAS.filter((a) => a.city === city),
    ...PKS_AREAS.filter((a) => a.city !== city),
  ]

  for (const area of ordered) {
    if (area.aliases.some((alias) => matchesAliasInText(haystackLower, alias))) {
      return area
    }
  }

  return undefined
}

export function resolveEventsForMap<T extends GeoResolvableEvent>(
  events: T[],
  fallbackCoords: LatLngTuple = DEFAULT_PKS_COORDS,
): ResolvedMapEvents<T> {
  const all: ResolvedEventItem<T>[] = []
  const exactPins: ResolvedEventItem<T>[] = []
  const districtPins: ResolvedEventItem<T>[] = []
  const cityGroupMap = new Map<string, CityOnlyGroup<T>>()

  for (const evt of events) {
    const exact = extractExactTuple(evt.coords ?? evt.coordinates)
    const haystack = collectLocationHaystack(evt)
    const city = normalizeCity(evt.city, haystack)

    if (exact) {
      const item: ResolvedEventItem<T> = {
        event: evt,
        city,
        precision: 'exact',
        hasExactCoords: true,
        effectiveCoords: exact,
        plotCoords: exact,
      }
      all.push(item)
      exactPins.push(item)
      continue
    }

    const area = findPksArea(haystack, city)
    if (area) {
      const [dLat, dLng] = deterministicJitter(`${evt.id}-${evt.title}`, 0.002)
      const plot: LatLngTuple = [area.coords[0] + dLat, area.coords[1] + dLng]
      const item: ResolvedEventItem<T> = {
        event: evt,
        city: area.city,
        district: area.name,
        precision: 'district',
        hasExactCoords: false,
        effectiveCoords: plot,
        plotCoords: plot,
      }
      all.push(item)
      districtPins.push(item)
      continue
    }

    const knownCityCenter = PKS_CITY_CENTERS[city as PksCityName]
    const cityCenter = knownCityCenter ?? resolveCoordsTuple(fallbackCoords, DEFAULT_PKS_COORDS)
    const [gLat, gLng] = deterministicJitter(`city-list-${city}`, 0.0025)
    const groupCoords: LatLngTuple = [cityCenter[0] + gLat, cityCenter[1] + gLng]

    const item: ResolvedEventItem<T> = {
      event: evt,
      city,
      precision: 'city-only',
      hasExactCoords: false,
      effectiveCoords: groupCoords,
    }
    all.push(item)

    const existing = cityGroupMap.get(city)
    if (existing) {
      existing.items.push(item)
    } else {
      cityGroupMap.set(city, {
        city,
        coords: groupCoords,
        items: [item],
      })
    }
  }

  const cityGroups = Array.from(cityGroupMap.values())
  const cityOnlyCount = cityGroups.reduce((sum, g) => sum + g.items.length, 0)

  return {
    all,
    exactPins,
    districtPins,
    cityGroups,
    stats: {
      total: events.length,
      exactCount: exactPins.length,
      districtCount: districtPins.length,
      cityOnlyCount,
      plottedSingleCount: exactPins.length + districtPins.length,
    },
  }
}