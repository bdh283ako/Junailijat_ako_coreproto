import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export interface NormalizedFeedEvent {
  id: string
  title: string
  startDate: string
  time: string
  locationName: string
  venue: string
  address?: string
  city: string
  coordinates?: { lat: number; lng: number }
  coords?: [number, number]
  ageRangeLabel: string
  ageGroup: string
  price: string
  description?: string
  url?: string
  tags: string[]
  source: string
}

const KARO_EVENTPULSE_URL =
  process.env.KARO_EVENTPULSE_URL?.trim() ||
  'https://eventpulsebyjunailijat.ai.studio/api/events/feed.jsonld?horizon=all'

// YSO-asiasanat Linked Eventsissä: lapset (p4354), perheet (p13050), vauvat (p11185), leikki-ikäiset (p20513)
const FAMILY_YSO_KEYWORDS = 'yso:p4354,yso:p13050,yso:p11185,yso:p20513'

const LINKED_EVENTS_ENDPOINTS = [
  {
    key: 'helsinki' as const,
    city: 'Helsinki',
    sourceTag: 'linked-events-helsinki',
    division: 'kunta:helsinki',
    baseUrl: 'https://api.hel.fi/linkedevents/v1/event/',
    defaultPageSize: 25,
  },
  {
    key: 'espoo' as const,
    city: 'Espoo',
    sourceTag: 'linked-events-espoo',
    division: 'kunta:espoo',
    baseUrl: 'https://api.hel.fi/linkedevents/v1/event/',
    defaultPageSize: 25,
  },
  {
    key: 'vantaa' as const,
    city: 'Vantaa',
    sourceTag: 'linked-events-vantaa',
    division: 'kunta:vantaa',
    baseUrl: 'https://api.hel.fi/linkedevents/v1/event/',
    defaultPageSize: 25,
  },
] as const

const KAUNIAINEN_EVENTS_URL = 'https://www.kauniainen.fi/tapahtumat/'

function pickLocalizedText(field: unknown): string {
  if (!field) return ''
  if (typeof field === 'string') return field.trim()
  if (typeof field === 'object') {
    const obj = field as Record<string, unknown>
    const val = obj.fi ?? obj.sv ?? obj.en ?? Object.values(obj)[0]
    return typeof val === 'string' ? val.trim() : ''
  }
  return ''
}

function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatFinnishDateTime(iso?: string): string {
  if (!iso) return 'Aika tarkentuu'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('fi-FI', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Helsinki',
  })
}

function normalizeCityName(rawLocality: string, fallbackCity: string): string {
  const lower = rawLocality.toLowerCase()
  if (lower.includes('espoo') || lower.includes('esbo')) return 'Espoo'
  if (lower.includes('vantaa') || lower.includes('vanda')) return 'Vantaa'
  if (lower.includes('kauniainen') || lower.includes('grankulla')) return 'Kauniainen'
  if (lower.includes('helsinki') || lower.includes('helsingfors')) return 'Helsinki'
  return fallbackCity
}

function extractAgeLabel(raw: Record<string, unknown>, title: string, desc: string): string {
  const minAge = typeof raw.audience_min_age === 'number' ? raw.audience_min_age : null
  const maxAge = typeof raw.audience_max_age === 'number' ? raw.audience_max_age : null
  if (minAge !== null && maxAge !== null) return `${minAge}–${maxAge} v`
  if (minAge !== null) return `${minAge}+ v`
  if (maxAge !== null) return `alle ${maxAge} v`

  const combined = `${title} ${desc}`.toLowerCase()
  if (/vauva|taapero|0[-–]3/.test(combined)) return '0–3 v'
  if (/leikki-ikä|4[-–]6/.test(combined)) return '4–6 v'
  if (/koululai|7[-–]12/.test(combined)) return '7–12 v'
  return 'Lapset & perheet'
}

function extractPriceLabel(raw: Record<string, unknown>): string {
  const offers = Array.isArray(raw.offers) ? raw.offers : []
  const firstOffer = offers[0] as Record<string, unknown> | undefined
  if (!firstOffer) return 'Maksuton / tarkista'
  if (firstOffer.is_free === true) return 'Maksuton'
  const priceText = pickLocalizedText(firstOffer.price)
  return priceText || 'Maksullinen'
}

function extractCollectionItems(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((x): x is Record<string, unknown> => Boolean(x && typeof x === 'object'))
  }
  if (!payload || typeof payload !== 'object') return []
  const obj = payload as Record<string, unknown>

  for (const key of ['events', 'items', 'data', 'content', 'results', 'hits']) {
    if (Array.isArray(obj[key])) {
      return (obj[key] as unknown[]).filter((x): x is Record<string, unknown> =>
        Boolean(x && typeof x === 'object'),
      )
    }
  }

  if (Array.isArray(obj['@graph'])) {
    return obj['@graph'].filter(
      (x): x is Record<string, unknown> => Boolean(x && typeof x === 'object'),
    )
  }

  if (Array.isArray(obj.itemListElement)) {
    return obj.itemListElement
      .map((el) => {
        if (el && typeof el === 'object' && 'item' in el) {
          return (el as { item?: unknown }).item
        }
        return el
      })
      .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === 'object'))
  }

  if (obj['@type'] === 'Event' || typeof obj.name === 'string' || typeof obj.title === 'string') {
    return [obj]
  }
  return []
}

function parseCoords(
  item: Record<string, unknown>,
  locObj: Record<string, unknown> | null,
): { lat: number; lng: number } | undefined {
  const candidates = [
    item.coordinates,
    item.location,
    locObj?.geo,
    locObj?.coordinates,
    locObj?.position,
  ]

  for (const cand of candidates) {
    if (!cand || typeof cand !== 'object') continue
    const cObj = cand as Record<string, unknown>
    if (typeof cObj.lat === 'number' && typeof cObj.lng === 'number') {
      return { lat: cObj.lat, lng: cObj.lng }
    }
    if (typeof cObj.latitude === 'number' && typeof cObj.longitude === 'number') {
      return { lat: cObj.latitude, lng: cObj.longitude }
    }
    if (Array.isArray(cObj.coordinates) && cObj.coordinates.length >= 2) {
      const a = cObj.coordinates[0]
      const b = cObj.coordinates[1]
      if (typeof a === 'number' && typeof b === 'number') {
        return a > 20 && a < 32 && b > 59 && b < 71
          ? { lat: b, lng: a }
          : { lat: a, lng: b }
      }
    }
  }
  return undefined
}

async function fetchKaroEventPulse(): Promise<{
  events: NormalizedFeedEvent[]
  debug: { url: string; status: number | null; error?: string; rawItems: number }
}> {
  try {
    const res = await fetch(KARO_EVENTPULSE_URL, {
      headers: {
        Accept: 'application/ld+json, application/json;q=0.9, */*;q=0.8',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    })

    if (!res.ok) {
      return {
        events: [],
        debug: {
          url: KARO_EVENTPULSE_URL,
          status: res.status,
          error: `HTTP_${res.status}`,
          rawItems: 0,
        },
      }
    }

    const rawText = await res.text()
    let json: unknown
    try {
      json = JSON.parse(rawText)
    } catch {
      return {
        events: [],
        debug: {
          url: KARO_EVENTPULSE_URL,
          status: res.status,
          error: `NON_JSON_RESPONSE (${rawText.slice(0, 80).replace(/\s+/g, ' ')})`,
          rawItems: 0,
        },
      }
    }

    const list = extractCollectionItems(json)

    const events = list.map((item, idx) => {
      const id = String(item.id ?? item['@id'] ?? `urn:eventpulse:item-${idx}`)
      const title = stripHtml(
        String(item.title ?? pickLocalizedText(item.name) ?? 'Perhetapahtuma'),
      )
      const startDate = String(item.startDate ?? item.start_time ?? '')

      const locObj =
        item.location && typeof item.location === 'object'
          ? (item.location as Record<string, unknown>)
          : null

      const locAddrObj =
        locObj?.address && typeof locObj.address === 'object'
          ? (locObj.address as Record<string, unknown>)
          : item.address && typeof item.address === 'object'
            ? (item.address as Record<string, unknown>)
            : null

      const locationName = stripHtml(
        String(
          item.locationName ??
            item.venue ??
            pickLocalizedText(locObj?.name) ??
            'Pääkaupunkiseutu',
        ),
      )

      const rawAddress =
        typeof item.address === 'string'
          ? item.address
          : typeof locObj?.address === 'string'
            ? locObj.address
            : locAddrObj
              ? [locAddrObj.streetAddress, locAddrObj.addressLocality].filter(Boolean).join(', ')
              : undefined

      const localityCandidate = String(
        item.city ?? locAddrObj?.addressLocality ?? rawAddress ?? locationName ?? '',
      )
      const city = normalizeCityName(localityCandidate, 'Helsinki')

      const descriptionRaw =
        typeof item.description === 'string'
          ? item.description
          : pickLocalizedText(item.description)
      const description = descriptionRaw ? stripHtml(descriptionRaw) : undefined

      const url =
        typeof item.url === 'string'
          ? item.url
          : typeof item['@id'] === 'string' && item['@id'].startsWith('http')
            ? item['@id']
            : undefined

      const ageLabel = String(
        item.ageRangeLabel ?? item.typicalAgeRange ?? item.ageGroup ?? 'All ages',
      )

      const rawTags = Array.isArray(item.tags)
        ? item.tags
        : Array.isArray(item.keywords)
          ? item.keywords
          : typeof item.keywords === 'string'
            ? item.keywords.split(',').map((s) => s.trim())
            : ['EventPulse']
      const tags = rawTags.map(String).filter(Boolean)

      const coords = parseCoords(item, locObj)

      return {
        id,
        title,
        startDate,
        time: formatFinnishDateTime(startDate),
        locationName,
        venue: locationName,
        address: rawAddress,
        city,
        ...(coords
          ? {
              coordinates: coords,
              coords: [coords.lat, coords.lng] as [number, number],
            }
          : {}),
        ageRangeLabel: ageLabel,
        ageGroup: ageLabel,
        price:
          typeof item.isAccessibleForFree === 'boolean'
            ? item.isAccessibleForFree
              ? 'Maksuton'
              : 'Maksullinen'
            : 'Maksuton / tarkista',
        description,
        url,
        tags,
        source: 'karo-eventpulse-feed',
      }
    })

    return {
      events,
      debug: {
        url: KARO_EVENTPULSE_URL,
        status: res.status,
        rawItems: list.length,
      },
    }
  } catch (err) {
    return {
      events: [],
      debug: {
        url: KARO_EVENTPULSE_URL,
        status: null,
        error: err instanceof Error ? err.message : 'FETCH_FAILED',
        rawItems: 0,
      },
    }
  }
}

function mapLinkedEventRows(
  rows: Record<string, unknown>[],
  config: { city: string; sourceTag: string },
  limit: number,
): NormalizedFeedEvent[] {
  const results: NormalizedFeedEvent[] = []

  for (const row of rows.slice(0, limit)) {
    const rawId = String(row.id ?? '')
    if (!rawId) continue

    const title = pickLocalizedText(row.name)
    if (!title) continue

    const startDate = typeof row.start_time === 'string' ? row.start_time : ''
    const description = stripHtml(
      pickLocalizedText(row.short_description) || pickLocalizedText(row.description),
    ).slice(0, 260)

    const loc = (row.location && typeof row.location === 'object'
      ? row.location
      : {}) as Record<string, unknown>

    const locationName = pickLocalizedText(loc.name) || config.city
    const streetAddress = pickLocalizedText(loc.street_address)
    const locality = pickLocalizedText(loc.address_locality)
    const city = normalizeCityName(locality, config.city)

    const position = loc.position as { coordinates?: [number, number] } | undefined
    const geoCoords = Array.isArray(position?.coordinates) ? position.coordinates : undefined
    const lat = geoCoords && typeof geoCoords[1] === 'number' ? geoCoords[1] : undefined
    const lng = geoCoords && typeof geoCoords[0] === 'number' ? geoCoords[0] : undefined

    const infoUrl = pickLocalizedText(row.info_url)
    const ageLabel = extractAgeLabel(row, title, description)

    results.push({
      id: `le-${rawId}`,
      title,
      startDate,
      time: formatFinnishDateTime(startDate),
      locationName,
      venue: locationName,
      address: [streetAddress, city].filter(Boolean).join(', '),
      city,
      ...(typeof lat === 'number' && typeof lng === 'number'
        ? {
            coordinates: { lat, lng },
            coords: [lat, lng] as [number, number],
          }
        : {}),
      ageRangeLabel: ageLabel,
      ageGroup: ageLabel,
      price: extractPriceLabel(row),
      description: description || undefined,
      url: infoUrl || undefined,
      tags: ['linked-events', config.sourceTag],
      source: 'linked-events-pks',
    })
  }

  return results
}

async function fetchLinkedEventsForMunicipality(
  config: {
    city: string
    sourceTag: string
    division: string
    baseUrl: string
    defaultPageSize: number
  },
  options: { rawUnfiltered: boolean; page: number; pageSize: number },
): Promise<{ events: NormalizedFeedEvent[]; metaCount: number; hasNextPage: boolean }> {
  try {
    if (options.rawUnfiltered) {
      const url = new URL(config.baseUrl)
      url.searchParams.set('format', 'json')
      url.searchParams.set('include', 'location,keywords')
      url.searchParams.set('start', 'now')
      url.searchParams.set('sort', 'start_time')
      url.searchParams.set('page_size', String(options.pageSize))
      url.searchParams.set('page', String(options.page))
      url.searchParams.set('division', config.division)

      const res = await fetch(url.toString(), {
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) {
        return { events: [], metaCount: 0, hasNextPage: false }
      }

      const payload = (await res.json()) as {
        meta?: { count?: number; next?: string | null }
        data?: Record<string, unknown>[]
      }
      const rows = Array.isArray(payload?.data) ? payload.data : []
      const metaCount = typeof payload?.meta?.count === 'number' ? payload.meta.count : rows.length
      const hasNextPage = Boolean(payload?.meta?.next)

      return {
        events: mapLinkedEventRows(rows, config, options.pageSize),
        metaCount,
        hasNextPage,
      }
    }

    const targetSize = config.defaultPageSize
    const buildDefaultUrl = (useFamilyKeywords: boolean) => {
      const url = new URL(config.baseUrl)
      url.searchParams.set('format', 'json')
      url.searchParams.set('include', 'location,keywords')
      url.searchParams.set('start', 'now')
      url.searchParams.set('sort', 'start_time')
      url.searchParams.set('super_event_type', 'none')
      url.searchParams.set('page_size', String(targetSize))
      url.searchParams.set('division', config.division)
      if (useFamilyKeywords) {
        url.searchParams.set('keyword', FAMILY_YSO_KEYWORDS)
      }
      return url.toString()
    }

    const res = await fetch(buildDefaultUrl(true), {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    const payload = res.ok
      ? ((await res.json()) as { meta?: { count?: number }; data?: Record<string, unknown>[] })
      : { data: [] }
    const rows = Array.isArray(payload?.data) ? [...payload.data] : []
    let metaCount = typeof payload?.meta?.count === 'number' ? payload.meta.count : rows.length

    if (rows.length < targetSize) {
      const fallbackRes = await fetch(buildDefaultUrl(false), {
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      })
      if (fallbackRes.ok) {
        const fbPayload = (await fallbackRes.json()) as {
          meta?: { count?: number }
          data?: Record<string, unknown>[]
        }
        if (typeof fbPayload?.meta?.count === 'number') {
          metaCount = fbPayload.meta.count
        }
        const fbRows = Array.isArray(fbPayload?.data) ? fbPayload.data : []
        const seenIds = new Set(rows.map((r) => String(r.id ?? '')))
        for (const r of fbRows) {
          const id = String(r.id ?? '')
          if (id && !seenIds.has(id)) {
            seenIds.add(id)
            rows.push(r)
          }
          if (rows.length >= targetSize) break
        }
      }
    }

    return {
      events: mapLinkedEventRows(rows, config, targetSize),
      metaCount,
      hasNextPage: metaCount > targetSize,
    }
  } catch {
    return { events: [], metaCount: 0, hasNextPage: false }
  }
}

async function fetchKauniainenWebEvents(): Promise<NormalizedFeedEvent[]> {
  try {
    const res = await fetch(KAUNIAINEN_EVENTS_URL, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return []
    const html = await res.text()

    const matches = Array.from(
      html.matchAll(
        /<a[^>]+href="(https:\/\/www\.kauniainen\.fi\/tapahtuma\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
      ),
    )

    const seen = new Set<string>()
    const items: NormalizedFeedEvent[] = []

    for (const m of matches) {
      const link = m[1]
      const title = stripHtml(m[2])
      if (!link || !title || title.length < 4 || seen.has(link)) continue
      seen.add(link)
      const slug = link.replace(/\/+$/, '').split('/').pop() || String(items.length + 1)

      items.push({
        id: `grani-web-${slug}`,
        title,
        startDate: new Date().toISOString(),
        time: 'Katso ajankohta sivulta',
        locationName: 'Kauniainen (Grani)',
        venue: 'Kauniainen',
        city: 'Kauniainen',
        ageRangeLabel: 'Koko perhe',
        ageGroup: 'Koko perhe',
        price: 'Tarkista sivulta',
        url: link,
        tags: ['kauniainen-web'],
        source: 'kauniainen-web',
      })

      if (items.length >= 6) break
    }

    return items
  } catch {
    return []
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode') === 'raw' ? 'raw' : 'default'
  const rawUnfiltered = mode === 'raw'

  const parsedPage = Number.parseInt(searchParams.get('page') || '1', 10)
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1

  const parsedPageSize = Number.parseInt(
    searchParams.get('pageSize') || (rawUnfiltered ? '50' : '25'),
    10,
  )
  const pageSize =
    Number.isFinite(parsedPageSize) && parsedPageSize >= 1
      ? Math.min(100, parsedPageSize)
      : rawUnfiltered
        ? 50
        : 25

  const cityParam = (searchParams.get('city') || 'all').trim()

  const [karoResult, helsinkiRes, espooRes, vantaaRes, kauniainenEvents] = await Promise.all([
    fetchKaroEventPulse(),
    fetchLinkedEventsForMunicipality(LINKED_EVENTS_ENDPOINTS[0], {
      rawUnfiltered,
      page,
      pageSize,
    }),
    fetchLinkedEventsForMunicipality(LINKED_EVENTS_ENDPOINTS[1], {
      rawUnfiltered,
      page,
      pageSize,
    }),
    fetchLinkedEventsForMunicipality(LINKED_EVENTS_ENDPOINTS[2], {
      rawUnfiltered,
      page,
      pageSize,
    }),
    fetchKauniainenWebEvents(),
  ])

  const dedupedMap = new Map<string, NormalizedFeedEvent>()
  for (const evt of [
    ...karoResult.events,
    ...espooRes.events,
    ...helsinkiRes.events,
    ...vantaaRes.events,
    ...kauniainenEvents,
  ]) {
    if (
      cityParam !== 'all' &&
      (evt.city || '').toLowerCase() !== cityParam.toLowerCase()
    ) {
      continue
    }
    if (!dedupedMap.has(evt.id)) {
      dedupedMap.set(evt.id, evt)
    }
  }

  const combined = Array.from(dedupedMap.values())

  const byCity: Record<string, number> = {}
  for (const evt of combined) {
    byCity[evt.city] = (byCity[evt.city] ?? 0) + 1
  }

  const linkedEventsTotal =
    helsinkiRes.events.length +
    espooRes.events.length +
    vantaaRes.events.length +
    kauniainenEvents.length

  const hasMorePages =
    helsinkiRes.hasNextPage || espooRes.hasNextPage || vantaaRes.hasNextPage

  return NextResponse.json(
    {
      mode,
      events: combined,
      total: combined.length,
      pagination: {
        page,
        pageSize,
        hasNextPage: hasMorePages,
        hasPrevPage: page > 1,
        metaCountByCity: {
          helsinki: helsinkiRes.metaCount,
          espoo: espooRes.metaCount,
          vantaa: vantaaRes.metaCount,
          kauniainen: kauniainenEvents.length,
        },
      },
      sources: {
        karoCount: karoResult.events.length,
        lahellaCount: 0,
        linkedEventsCount: linkedEventsTotal,
        byEndpoint: {
          helsinki: helsinkiRes.events.length,
          espoo: espooRes.events.length,
          vantaa: vantaaRes.events.length,
          kauniainen: kauniainenEvents.length,
        },
        byCity,
      },
      karoDebug: karoResult.debug,
      lahellaDebug: null,
      isFallback: combined.length === 0,
    },
    { status: 200 },
  )
}
