import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CityKey = 'helsinki' | 'espoo' | 'vantaa'

const LINKED_ENDPOINTS: Record<
  CityKey,
  { label: string; eventUrl: string; locationUrl: string }
> = {
  helsinki: {
    label: 'Helsinki',
    eventUrl: 'https://api.hel.fi/linkedevents/v1/event/',
    locationUrl: 'https://api.hel.fi/linkedevents/v1/location/',
  },
  espoo: {
    label: 'Espoo',
    eventUrl: 'https://api.espoo.fi/linkedevents/v1/event/',
    locationUrl: 'https://api.espoo.fi/linkedevents/v1/location/',
  },
  vantaa: {
    label: 'Vantaa',
    eventUrl: 'https://api.vantaa.fi/linkedevents/v1/event/',
    locationUrl: 'https://api.vantaa.fi/linkedevents/v1/location/',
  },
}

function pickFi(val: unknown): string {
  if (!val) return ''
  if (typeof val === 'string') return val.trim()
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>
    const out = obj.fi ?? obj.sv ?? obj.en ?? Object.values(obj)[0]
    return typeof out === 'string' ? out.trim() : ''
  }
  return ''
}

function parseCoords(position: unknown): [number, number] | null {
  if (!position || typeof position !== 'object') return null
  const coords = (position as { coordinates?: unknown }).coordinates
  if (!Array.isArray(coords) || coords.length < 2) return null
  const lng = coords[0]
  const lat = coords[1]
  return typeof lat === 'number' && typeof lng === 'number' ? [lat, lng] : null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const kind = searchParams.get('kind') === 'locations' ? 'locations' : 'events'
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1)
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(searchParams.get('pageSize') || '50', 10) || 50),
  )
  const includeSuper = searchParams.get('includeSuper') !== 'false'

  const citiesParam = (searchParams.get('cities') || 'helsinki,espoo,vantaa')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter((c): c is CityKey => c in LINKED_ENDPOINTS)

  const targetCities: CityKey[] =
    citiesParam.length > 0 ? citiesParam : ['helsinki', 'espoo', 'vantaa']

  const batches = await Promise.all(
    targetCities.map(async (cityKey) => {
      const cfg = LINKED_ENDPOINTS[cityKey]
      const url = new URL(kind === 'events' ? cfg.eventUrl : cfg.locationUrl)
      url.searchParams.set('format', 'json')
      url.searchParams.set('page_size', String(pageSize))
      url.searchParams.set('page', String(page))

      if (kind === 'events') {
        url.searchParams.set('include', 'location,keywords')
        url.searchParams.set('start', 'now')
        url.searchParams.set('sort', 'start_time')
        if (!includeSuper) {
          url.searchParams.set('super_event_type', 'none')
        }
      }

      const t0 = Date.now()
      try {
        const res = await fetch(url.toString(), {
          cache: 'no-store',
          signal: AbortSignal.timeout(10000),
        })
        const ms = Date.now() - t0
        if (!res.ok) {
          return {
            cityKey,
            label: cfg.label,
            status: res.status,
            ms,
            metaCount: 0,
            hasNext: false,
            items: [],
            error: `HTTP_${res.status}`,
          }
        }

        const json = (await res.json()) as {
          meta?: { count?: number; next?: string | null }
          data?: Record<string, unknown>[]
        }
        const rows = Array.isArray(json.data) ? json.data : []

        const items = rows.map((row) => {
          if (kind === 'locations') {
            return {
              id: String(row.id ?? ''),
              title: pickFi(row.name) || '(nimetön paikka)',
              city: pickFi(row.address_locality) || cfg.label,
              placeOrAddress: [pickFi(row.street_address), row.postal_code]
                .filter(Boolean)
                .join(', '),
              timeOrInfo: pickFi(row.info_url) || 'Location',
              coords: parseCoords(row.position),
              raw: row,
            }
          }

          const loc =
            row.location && typeof row.location === 'object'
              ? (row.location as Record<string, unknown>)
              : {}
          return {
            id: String(row.id ?? ''),
            title: pickFi(row.name) || '(nimetön)',
            city: pickFi(loc.address_locality) || cfg.label,
            placeOrAddress: [pickFi(loc.name), pickFi(loc.street_address)]
              .filter(Boolean)
              .join(', '),
            timeOrInfo: typeof row.start_time === 'string' ? row.start_time : '',
            coords: parseCoords(loc.position),
            raw: row,
          }
        })

        return {
          cityKey,
          label: cfg.label,
          status: res.status,
          ms,
          metaCount: typeof json.meta?.count === 'number' ? json.meta.count : rows.length,
          hasNext: Boolean(json.meta?.next),
          items,
        }
      } catch (err) {
        return {
          cityKey,
          label: cfg.label,
          status: null,
          ms: Date.now() - t0,
          metaCount: 0,
          hasNext: false,
          items: [],
          error: err instanceof Error ? err.message : 'FETCH_FAILED',
        }
      }
    }),
  )

  return NextResponse.json(
    {
      kind,
      page,
      pageSize,
      batches,
      totalReturned: batches.reduce((acc, b) => acc + b.items.length, 0),
    },
    { status: 200 },
  )
}