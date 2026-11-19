import { FamilyEvent, INITIAL_EVENTS, PKS_HOME_AREAS } from './protoData'

const VENUE_COORDS_LOOKUP: Record<string, { coords: [number, number]; city: string }> = {
  oodi: { coords: [60.1741, 24.9382], city: 'Helsinki' },
  annantalo: { coords: [60.1681, 24.9336], city: 'Helsinki' },
  pasila: { coords: [60.1986, 24.9338], city: 'Helsinki' },
  töölö: { coords: [60.1805, 24.9182], city: 'Helsinki' },
  lauttasaari: { coords: [60.1589, 24.8772], city: 'Helsinki' },
  tapiola: { coords: [60.1773, 24.8042], city: 'Espoo' },
  'espoon kulttuurikeskus': { coords: [60.1773, 24.8042], city: 'Espoo' },
  oittaa: { coords: [60.2392, 24.6565], city: 'Espoo' },
  sello: { coords: [60.2182, 24.8131], city: 'Espoo' },
  leppävaara: { coords: [60.2189, 24.8124], city: 'Espoo' },
  'iso omena': { coords: [60.1614, 24.7385], city: 'Espoo' },
  'espoon keskus': { coords: [60.2055, 24.6685], city: 'Espoo' },
  kauniainen: { coords: [60.2114, 24.7265], city: 'Kauniainen' },
  tikkurila: { coords: [60.2934, 25.0378], city: 'Vantaa' },
  myyrmäki: { coords: [60.2618, 24.8535], city: 'Vantaa' },
}

function resolveEventLocation(
  rawCity?: string,
  rawVenue?: string,
  rawCoords?: unknown,
): { coords: [number, number]; city: string; inferred: boolean } {
  if (Array.isArray(rawCoords) && rawCoords.length >= 2) {
    const a = Number(rawCoords[0])
    const b = Number(rawCoords[1])
    if (a >= 60.0 && a <= 60.5 && b >= 24.3 && b <= 25.4) {
      return { coords: [a, b], city: rawCity || 'PKS', inferred: false }
    }
    if (b >= 60.0 && b <= 60.5 && a >= 24.3 && a <= 25.4) {
      return { coords: [b, a], city: rawCity || 'PKS', inferred: false }
    }
  }

  const searchStr = `${rawCity || ''} ${rawVenue || ''}`.toLowerCase()
  for (const [key, data] of Object.entries(VENUE_COORDS_LOOKUP)) {
    if (searchStr.includes(key)) {
      return { coords: data.coords, city: rawCity || data.city, inferred: true }
    }
  }

  for (const preset of PKS_HOME_AREAS) {
    if (searchStr.includes(preset.city.toLowerCase())) {
      return { coords: preset.coords, city: preset.city, inferred: true }
    }
  }

  return { coords: [60.192, 24.85], city: rawCity || 'PKS', inferred: true }
}

function extractRawEventList(payload: any): any[] {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.['@graph'])) return payload['@graph']
  if (Array.isArray(payload?.itemListElement)) {
    return payload.itemListElement.map((el: any) => el?.item || el)
  }
  if (Array.isArray(payload?.events)) return payload.events
  if (Array.isArray(payload?.data)) return payload.data
  if (payload?.['@type'] === 'Event') return [payload]
  return []
}

function formatEventTime(rawDate: unknown): string {
  if (typeof rawDate !== 'string' || !rawDate.trim()) return 'Tarkista aika'
  const parsed = new Date(rawDate)
  if (Number.isNaN(parsed.getTime())) return rawDate
  return parsed.toLocaleString('fi-FI', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function cleanDescription(raw: unknown, maxLen = 140): string | undefined {
  const text =
    typeof raw === 'string'
      ? raw
      : typeof (raw as { fi?: string })?.fi === 'string'
        ? (raw as { fi?: string }).fi
        : ''
  if (!text) return undefined
  const plain = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!plain) return undefined
  return plain.length > maxLen ? `${plain.slice(0, maxLen - 1).trimEnd()}…` : plain
}

function resolveEventUrl(item: any, offer: any): string | undefined {
  const candidate =
    item?.url ||
    item?.sameAs ||
    offer?.url ||
    (typeof item?.['@id'] === 'string' && item['@id'].startsWith('http') ? item['@id'] : undefined)

  if (typeof candidate !== 'string') return undefined
  const trimmed = candidate.trim()
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : undefined
}

export interface EventFeedResult {
  events: FamilyEvent[]
  sourceStatus: 'live-api' | 'fallback'
  rawCount: number
  httpStatus: number | null
  errorDetail?: string
}

export async function fetchKaroEventsFeed(endpoint = '/api/events'): Promise<EventFeedResult> {
  try {
    const res = await fetch(endpoint, { cache: 'no-store' })
    if (!res.ok) {
      let errorDetail = res.statusText || 'HTTP-virhe'
      try {
        const errBody = await res.json()
        if (errBody?.error) errorDetail = String(errBody.error)
      } catch {
        // Jos runko ei ole JSONia, pidetään statusText
      }
      return {
        events: INITIAL_EVENTS,
        sourceStatus: 'fallback',
        rawCount: 0,
        httpStatus: res.status,
        errorDetail,
      }
    }

    const payload = await res.json()
    const rawList = extractRawEventList(payload)

    if (rawList.length === 0) {
      return {
        events: INITIAL_EVENTS,
        sourceStatus: 'fallback',
        rawCount: 0,
        httpStatus: res.status,
        errorDetail: 'Tyhjä tai tunnistamaton tapahtumalista vastauksessa',
      }
    }

    const normalized: FamilyEvent[] = rawList.map((item: any, idx: number) => {
      const title =
        typeof item?.title === 'string'
          ? item.title
          : typeof item?.name === 'string'
            ? item.name
            : item?.name?.fi || 'Perhetapahtuma'

      const loc = item?.location
      const addr = loc?.address

      const venue =
        typeof item?.venue === 'string'
          ? item.venue
          : typeof loc === 'string'
            ? loc
            : loc?.name?.fi ||
              loc?.name ||
              (typeof addr === 'string' ? addr : addr?.streetAddress) ||
              'Pääkaupunkiseutu'

      const rawCity =
        typeof item?.city === 'string'
          ? item.city
          : typeof addr === 'object' && addr?.addressLocality
            ? String(addr.addressLocality)
            : item?.municipality || ''

      const geoLat = loc?.geo?.latitude ?? item?.latitude ?? item?.lat
      const geoLng = loc?.geo?.longitude ?? item?.longitude ?? item?.lng
      const rawCoords =
        geoLat != null && geoLng != null
          ? [Number(geoLat), Number(geoLng)]
          : item?.coords || item?.coordinates || loc?.position?.coordinates

      const resolved = resolveEventLocation(rawCity, venue, rawCoords)

      const time =
        typeof item?.time === 'string'
          ? item.time
          : formatEventTime(item?.startDate || item?.start_time)

      const offer = Array.isArray(item?.offers) ? item.offers[0] : item?.offers
      let price = 'Katso tiedot'
      if (typeof item?.price === 'string') {
        price = item.price
      } else if (item?.isAccessibleForFree === true || item?.isFree === true) {
        price = 'Maksuton'
      } else if (offer?.price !== undefined && offer?.price !== null) {
        price =
          Number(offer.price) === 0
            ? 'Maksuton'
            : `${offer.price} ${offer.priceCurrency || '€'}`
      }

      const ageGroup =
        item?.ageGroup ||
        item?.targetGroup ||
        item?.audience?.audienceType ||
        item?.typicalAgeRange ||
        'Lapsiperheet'

      const description = cleanDescription(item?.description || item?.short_description)
      const url = resolveEventUrl(item, offer)

      return {
        id: String(item?.id || item?.['@id'] || `karo-evt-${idx}`),
        title,
        venue,
        city: resolved.city,
        time,
        ageGroup: String(ageGroup),
        price,
        coords: resolved.coords,
        description,
        url,
      }
    })

    return {
      events: normalized,
      sourceStatus: 'live-api',
      rawCount: rawList.length,
      httpStatus: res.status,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Verkkovirhe / JSON-jäsennysvirhe'
    return {
      events: INITIAL_EVENTS,
      sourceStatus: 'fallback',
      rawCount: 0,
      httpStatus: null,
      errorDetail: message,
    }
  }
}