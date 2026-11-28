'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const SHELLPROTO_ROUTE_URL = '/api/events'
const PER_CITY_TARGET = 25

interface DebugEventRow {
  id: string
  title: string
  city?: string
  locationName?: string
  venue?: string
  startDate?: string
  source?: string
  tags?: string[]
  coordinates?: { lat: number; lng: number }
  coords?: [number, number]
  ageRangeLabel?: string
  ageGroup?: string
  description?: string
  address?: string
  price?: string
  raw?: Record<string, unknown>
}

interface LahellaDebugPayload {
  configured?: boolean
  url?: string
  status?: number | null
  error?: string
  rawItems?: number
  hasMore?: boolean
  pksItems?: number
  familyItems?: number
  filteredItems?: number
  pagesFetched?: number
  elapsedMs?: number
  items?: Array<Record<string, unknown>>
}

interface ApiEventsPayload {
  events?: DebugEventRow[]
  total?: number
  isFallback?: boolean
  warning?: string
  fetchedAt?: string
  sourceUrl?: string
  sources?: {
    karoCount?: number
    linkedEventsCount?: number
    byEndpoint?: {
      helsinki?: number
      espoo?: number
      vantaa?: number
      kauniainen?: number
    }
    byCity?: Record<string, number>
  }
  lahellaDebug?: LahellaDebugPayload
  sourceTiming?: {
    lahellaTimeoutMs?: number
    linkedEventsTimeoutMs?: number
    eventPulseTimeoutMs?: number
    kauniainenTimeoutMs?: number
  }
  cacheDebug?: {
    ttlMs?: number
    updatedAt?: number
    ageMs?: number | null
    fresh?: boolean
    refreshing?: boolean
    sourceStatus?: {
      lahella: number | null
      linked: number | null
      eventPulse: number | null
      kauniainen: number | null
    }
    sourceElapsedMs?: {
      lahella: number | null
      linked: number | null
      eventPulse: number | null
      kauniainen: number | null
    }
  }
}

interface ConsoleEntry {
  id: string
  ts: string
  level: 'INFO' | 'OK' | 'WARN' | 'ERR'
  msg: string
  source: 'API' | 'Lähellä.fi' | 'Linked Events' | 'EventPulse' | 'Kauniainen'
}

const KARO_DIRECT_URL =
  'https://eventpulsebyjunailijat.ai.studio/api/events/feed.jsonld'

const CITY_LINKED_ENDPOINTS = [
  {
    key: 'helsinki' as const,
    label: 'Helsinki Linked Events',
    city: 'Helsinki',
    url: `https://api.hel.fi/linkedevents/v1/event/?format=json&division=kunta:helsinki&include=location,keywords&start=now&sort=start_time&super_event_type=none&page_size=${PER_CITY_TARGET}`,
  },
  {
    key: 'espoo' as const,
    label: 'Espoo Linked Events',
    city: 'Espoo',
    url: `https://api.hel.fi/linkedevents/v1/event/?format=json&division=kunta:espoo&include=location,keywords&start=now&sort=start_time&super_event_type=none&page_size=${PER_CITY_TARGET}`,
  },
  {
    key: 'vantaa' as const,
    label: 'Vantaa Linked Events',
    city: 'Vantaa',
    url: `https://api.hel.fi/linkedevents/v1/event/?format=json&division=kunta:vantaa&include=location,keywords&start=now&sort=start_time&super_event_type=none&page_size=${PER_CITY_TARGET}`,
  },
] as const

const KAUNIAINEN_WEB_URL = 'https://www.kauniainen.fi/tapahtumat/'

function nowStamp(): string {
  return new Date().toLocaleTimeString('fi-FI', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  })
}

function getCoordsTuple(evt: DebugEventRow): [number, number] | null {
  if (
    evt.coordinates &&
    typeof evt.coordinates.lat === 'number' &&
    typeof evt.coordinates.lng === 'number'
  ) {
    return [evt.coordinates.lat, evt.coordinates.lng]
  }
  if (
    Array.isArray(evt.coords) &&
    typeof evt.coords[0] === 'number' &&
    typeof evt.coords[1] === 'number'
  ) {
    return [evt.coords[0], evt.coords[1]]
  }
  return null
}

function isSameCity(evtCity: string | undefined, targetCity: string): boolean {
  return (evtCity || '').trim().toLowerCase() === targetCity.trim().toLowerCase()
}

function matchesCity(evtCity: string | undefined, filter: string): boolean {
  if (filter === 'all') return true
  return isSameCity(evtCity, filter)
}

function pickText(val: unknown): string {
  if (typeof val === 'string') return val.trim()
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>
    for (const lang of ['fi', 'en', 'sv']) {
      if (typeof obj[lang] === 'string' && (obj[lang] as string).trim()) {
        return (obj[lang] as string).trim()
      }
    }
  }
  return ''
}

function stringList(val: unknown): string[] {
  return Array.isArray(val) ? val.filter((item): item is string => typeof item === 'string') : []
}

function lahellaRawSummary(item: Record<string, unknown>) {
  const traits =
    item.traits && typeof item.traits === 'object'
      ? (item.traits as Record<string, unknown>)
      : {}
  const channels = Array.isArray(traits.channels) ? traits.channels : []
  const firstChannel =
    channels.find((channel) => channel && typeof channel === 'object') as
      | Record<string, unknown>
      | undefined
  const address =
    firstChannel?.address && typeof firstChannel.address === 'object'
      ? (firstChannel.address as Record<string, unknown>)
      : {}
  const map =
    firstChannel?.map && typeof firstChannel.map === 'object'
      ? (firstChannel.map as Record<string, unknown>)
      : {}
  const center =
    map.center && typeof map.center === 'object'
      ? (map.center as Record<string, unknown>)
      : {}
  const coords = Array.isArray(center.coordinates) ? center.coordinates : []
  const lat = typeof coords[1] === 'number' ? coords[1] : null
  const lng = typeof coords[0] === 'number' ? coords[0] : null
  const isPks =
    lat !== null &&
    lng !== null &&
    lat >= 59.8 &&
    lat <= 60.5 &&
    lng >= 24.3 &&
    lng <= 25.3
  const fi =
    traits.translations && typeof traits.translations === 'object'
      ? ((traits.translations as Record<string, unknown>).fi as
          | Record<string, unknown>
          | undefined)
      : undefined
  return {
    title:
      typeof traits.name === 'string'
        ? traits.name
        : typeof fi?.name === 'string'
          ? fi.name
          : '(Nimetön Lähellä-kohde)',
    demographic: stringList(traits.demographic),
    theme: stringList(traits.theme),
    format: stringList(traits.format),
    pricing: stringList(traits.pricing),
    group: typeof item.group === 'string' ? item.group : '-',
    city: typeof address.city === 'string' ? address.city : '-',
    street: typeof address.street === 'string' ? address.street : '-',
    lat,
    lng,
    coordinateMode: isPks ? 'suora PKS-koordinaatti' : 'PKS-fallback / koordinaatti puuttuu tai alueen ulkopuolella',
  }
}

async function fetchCityTopUp(
  key: 'helsinki' | 'espoo' | 'vantaa',
  city: string,
  url: string,
  limit: number,
): Promise<DebugEventRow[]> {
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`${city} HTTP ${res.status}`)
  }

  const parsed = (await res.json()) as { data?: Array<Record<string, unknown>> }
  const rows = Array.isArray(parsed.data) ? parsed.data.slice(0, limit) : []

  return rows.map((item, idx) => {
    const loc = (item.location as Record<string, unknown> | undefined) ?? {}
    const pos = (loc.position as { coordinates?: [number, number] } | undefined)?.coordinates
    const venue = pickText(loc.name) || 'Tuntematon paikka'
    const resolvedCity = pickText(loc.address_locality) || city
    const rawId = typeof item.id === 'string' ? item.id : `${key}-${idx}`

    return {
      id: `debug-topup-${key}-${rawId}`,
      title: pickText(item.name) || '(Nimetön tapahtuma)',
      city: resolvedCity,
      locationName: venue,
      venue,
      startDate: typeof item.start_time === 'string' ? item.start_time : '',
      source: `linked-events-${key}`,
      tags: [`linked-events-${key}`, 'debug-topup-25'],
      coordinates:
        Array.isArray(pos) && typeof pos[1] === 'number' && typeof pos[0] === 'number'
          ? { lat: pos[1], lng: pos[0] }
          : undefined,
    }
  })
}

export default function EventSourcesDebugPage() {
  const [loadingApi, setLoadingApi] = useState(false)
  const [loadingKaro, setLoadingKaro] = useState(false)
  const [loadingLinked, setLoadingLinked] = useState(false)

  const [cityFilter, setCityFilter] = useState('all')
  const [events, setEvents] = useState<DebugEventRow[]>([])
  const [meta, setMeta] = useState<{
    httpStatus: number | null
    durationMs: number | null
    isFallback: boolean | null
    karoCount: number
    linkedEventsCount: number
    byEndpoint: {
      helsinki: number
      espoo: number
      vantaa: number
      kauniainen: number
    }
    byCity: Record<string, number>
    warning?: string
  }>({
    httpStatus: null,
    durationMs: null,
    isFallback: null,
    karoCount: 0,
    linkedEventsCount: 0,
    byEndpoint: { helsinki: 0, espoo: 0, vantaa: 0, kauniainen: 0 },
    byCity: {},
  })

  const [lahellaDebug, setLahellaDebug] = useState<LahellaDebugPayload | null>(null)
  const [sourceTiming, setSourceTiming] = useState<ApiEventsPayload['sourceTiming'] | null>(null)
  const [cacheDebug, setCacheDebug] = useState<ApiEventsPayload['cacheDebug'] | null>(null)
  const [lahellaSearch, setLahellaSearch] = useState('')

  const [logs, setLogs] = useState<ConsoleEntry[]>([])
  const [copied, setCopied] = useState(false)
  const [logLevelFilter, setLogLevelFilter] = useState<'ALL' | ConsoleEntry['level']>('ALL')
  const [logSourceFilter, setLogSourceFilter] = useState<'ALL' | ConsoleEntry['source']>('ALL')
  const [logQuery, setLogQuery] = useState('')
  const [consoleOpen, setConsoleOpen] = useState(true)
  const consoleEndRef = useRef<HTMLDivElement>(null)

  const log = useCallback((level: ConsoleEntry['level'], msg: string, source?: ConsoleEntry['source']) => {
    const inferredSource =
      source ??
      (/Lähellä/i.test(msg)
        ? 'Lähellä.fi'
        : /Linked/i.test(msg)
          ? 'Linked Events'
          : /Karo/i.test(msg)
            ? 'EventPulse'
            : /Kauniainen/i.test(msg)
              ? 'Kauniainen'
              : 'API')
    setLogs((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ts: nowStamp(),
        level,
        msg,
        source: inferredSource,
      },
    ])
  }, [])

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const runApiDiagnostics = useCallback(async () => {
    setLoadingApi(true)
    const query = cityFilter !== 'all' ? `?city=${encodeURIComponent(cityFilter)}` : ''
    const endpoint = `${SHELLPROTO_ROUTE_URL}${query}`

    log('INFO', `>>> GET ${endpoint}`)
    const t0 = performance.now()

    try {
      const res = await fetch(endpoint, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      const ms = Math.round(performance.now() - t0)
      log(res.ok ? 'OK' : 'ERR', `API HTTP ${res.status} (${ms} ms)`)

      const rawText = await res.text()
      log('INFO', `API payload-koko: ${rawText.length} tavua`)

      let data: ApiEventsPayload
      try {
        data = JSON.parse(rawText) as ApiEventsPayload
      } catch (parseErr) {
        log(
          'ERR',
          `API JSON.parse epäonnistui: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
        )
        log('WARN', `API raakavastauksen alku: ${rawText.slice(0, 260)}`)
        setLoadingApi(false)
        return
      }

      const rawList = Array.isArray(data.events) ? data.events : []
      let mergedList = [...rawList]

      const targetCities: Array<{
        key: 'helsinki' | 'espoo' | 'vantaa'
        city: string
        url: string
      }> =
        cityFilter === 'all'
          ? [...CITY_LINKED_ENDPOINTS]
          : CITY_LINKED_ENDPOINTS.filter((c) => isSameCity(c.city, cityFilter))

      for (const tc of targetCities) {
        const existingForCity = mergedList.filter((e) => isSameCity(e.city, tc.city))
        if (existingForCity.length < PER_CITY_TARGET) {
          try {
            const topUpRows = await fetchCityTopUp(tc.key, tc.city, tc.url, PER_CITY_TARGET)
            const otherCitiesRows = mergedList.filter((e) => !isSameCity(e.city, tc.city))
            const seenIds = new Set(existingForCity.map((e) => e.id))
            const cappedCityRows = [...existingForCity]

            for (const row of topUpRows) {
              if (cappedCityRows.length >= PER_CITY_TARGET) break
              if (!seenIds.has(row.id)) {
                seenIds.add(row.id)
                cappedCityRows.push(row)
              }
            }

            mergedList = [...otherCitiesRows, ...cappedCityRows]
            log(
              'OK',
              `[Debug top-up] ${tc.city}: näytetään ${cappedCityRows.length} / ${PER_CITY_TARGET} tapahtumaa`,
            )
          } catch (topUpErr) {
            log(
              'WARN',
              `[Debug top-up] ${tc.city} täydennys epäonnistui: ${topUpErr instanceof Error ? topUpErr.message : String(topUpErr)}`,
            )
          }
        } else if (existingForCity.length > PER_CITY_TARGET) {
          const otherCitiesRows = mergedList.filter((e) => !isSameCity(e.city, tc.city))
          mergedList = [...otherCitiesRows, ...existingForCity.slice(0, PER_CITY_TARGET)]
        }
      }

      const list = mergedList.filter((e) => matchesCity(e.city, cityFilter))

      const helCount = list.filter((e) => isSameCity(e.city, 'Helsinki')).length
      const espCount = list.filter((e) => isSameCity(e.city, 'Espoo')).length
      const vanCount = list.filter((e) => isSameCity(e.city, 'Vantaa')).length
      const kauCount = list.filter((e) => isSameCity(e.city, 'Kauniainen')).length

      const karoCount = list.filter((e) => (e.source || '').toLowerCase().includes('karo')).length
      const linkedEventsCount = helCount + espCount + vanCount + kauCount

      const byEndpoint = {
        helsinki: helCount,
        espoo: espCount,
        vantaa: vanCount,
        kauniainen: kauCount,
      }

      const byCity = list.reduce<Record<string, number>>((acc, evt) => {
        const c = (evt.city || 'Tuntematon').trim() || 'Tuntematon'
        acc[c] = (acc[c] ?? 0) + 1
        return acc
      }, {})

      setEvents(list)
      setMeta({
        httpStatus: res.status,
        durationMs: ms,
        isFallback: typeof data.isFallback === 'boolean' ? data.isFallback : null,
        karoCount,
        linkedEventsCount,
        byEndpoint,
        byCity,
        warning: data.warning,
      })
      setLahellaDebug(data.lahellaDebug ?? null)
      setSourceTiming(data.sourceTiming ?? null)
      setCacheDebug(data.cacheDebug ?? null)

      log(
        'INFO',
        `isFallback = ${String(data.isFallback)} | total = ${list.length} (apiRaw=${rawList.length})`,
      )
      log(
        'INFO',
        `Lähteet: Karo = ${karoCount} kpl | Linked+PKS = ${linkedEventsCount} kpl (HEL:${byEndpoint.helsinki}, ESP:${byEndpoint.espoo}, VAN:${byEndpoint.vantaa}, KAU:${byEndpoint.kauniainen})`,
      )
      log('INFO', `Kaupunkijakauma: ${JSON.stringify(byCity)}`)

      if (data.warning) {
        log('WARN', `API warning: ${data.warning}`)
      }

      const withCoords = list.filter((e) => getCoordsTuple(e) !== null).length
      log('INFO', `Koordinaateilla varustetut tapahtumat: ${withCoords} / ${list.length}`)

      list.slice(0, 8).forEach((evt, idx) => {
        const tuple = getCoordsTuple(evt)
        const coordStr = tuple ? `[${tuple[0].toFixed(4)}, ${tuple[1].toFixed(4)}]` : 'NO_COORDS'
        const venueLabel = evt.locationName || evt.venue || '-'
        log(
          'INFO',
          `  #${idx + 1} [${evt.source ?? 'unknown'}] (${evt.city ?? '?'}) "${evt.title}" @ ${venueLabel} | ${coordStr}`,
        )
      })
    } catch (err) {
      const ms = Math.round(performance.now() - t0)
      log(
        'ERR',
        `API verkkovirhe (${ms} ms): ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setLoadingApi(false)
    }
  }, [cityFilter, log])

  const testKaroDirect = useCallback(async () => {
    setLoadingKaro(true)
    log('INFO', `>>> DIRECT GET ${KARO_DIRECT_URL}`)
    const t0 = performance.now()

    try {
      const res = await fetch(KARO_DIRECT_URL, {
        cache: 'no-store',
        headers: { Accept: 'application/ld+json, application/json;q=0.9' },
      })
      const ms = Math.round(performance.now() - t0)
      const ctype = res.headers.get('content-type') || 'unknown'
      log(res.ok ? 'OK' : 'ERR', `Karo HTTP ${res.status} (${ms} ms) | Content-Type: ${ctype}`)

      const rawText = await res.text()
      log('INFO', `Karo vastauksen koko: ${rawText.length} tavua`)

      try {
        const parsed = JSON.parse(rawText) as unknown
        if (Array.isArray(parsed)) {
          log('OK', `Karo JSON on taulukko (${parsed.length} alkiota)`)
          if (parsed[0] && typeof parsed[0] === 'object') {
            log('INFO', `1. alkion avaimet: ${Object.keys(parsed[0] as object).join(', ')}`)
            log('INFO', `1. alkion näyte: ${JSON.stringify(parsed[0]).slice(0, 320)}`)
          }
        } else if (parsed && typeof parsed === 'object') {
          const obj = parsed as Record<string, unknown>
          log('OK', `Karo JSON-juuren avaimet: ${Object.keys(obj).join(', ')}`)
          const graph = Array.isArray(obj['@graph'])
            ? obj['@graph']
            : Array.isArray(obj.events)
              ? obj.events
              : Array.isArray(obj.itemListElement)
                ? obj.itemListElement
                : null
          if (graph) {
            log('INFO', `Karo tapahtumalistan pituus: ${graph.length}`)
            if (graph[0] && typeof graph[0] === 'object') {
              log('INFO', `1. tapahtuman avaimet: ${Object.keys(graph[0] as object).join(', ')}`)
              log('INFO', `1. tapahtuman näyte: ${JSON.stringify(graph[0]).slice(0, 320)}`)
            }
          } else {
            log(
              'WARN',
              `Karo JSON ei sisältänyt @graph/events/itemListElement-taulukkoa: ${rawText.slice(0, 280)}`,
            )
          }
        }
      } catch {
        log('WARN', 'Karo vastaus ei ole kelvollista JSONia (todennäköisesti HTML/404/login).')
        log('WARN', `Raakavastauksen alku: ${rawText.slice(0, 280)}`)
      }
    } catch (err) {
      const ms = Math.round(performance.now() - t0)
      log(
        'ERR',
        `Karo suora selainhaku estyi (${ms} ms, CORS/verkko): ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setLoadingKaro(false)
    }
  }, [log])

  const testLinkedEventsDirect = useCallback(
    async (specificCity?: 'helsinki' | 'espoo' | 'vantaa' | 'kauniainen') => {
      setLoadingLinked(true)
      const targets = specificCity
        ? CITY_LINKED_ENDPOINTS.filter((c) => c.key === specificCity)
        : CITY_LINKED_ENDPOINTS

      for (const ep of targets) {
        log('INFO', `>>> DIRECT GET [${ep.city}] ${ep.url}`)
        const t0 = performance.now()
        try {
          const res = await fetch(ep.url, {
            cache: 'no-store',
            headers: { Accept: 'application/json' },
          })
          const ms = Math.round(performance.now() - t0)
          log(res.ok ? 'OK' : 'ERR', `[${ep.city}] Linked Events HTTP ${res.status} (${ms} ms)`)

          if (!res.ok) continue

          const parsed = (await res.json()) as {
            meta?: { count?: number }
            data?: Array<Record<string, unknown>>
          }
          const rows = Array.isArray(parsed.data) ? parsed.data : []
          log(
            'OK',
            `[${ep.city}] palautti ${rows.length} riviä (meta.count = ${parsed.meta?.count ?? '?'})`,
          )

          rows.slice(0, 3).forEach((item, idx) => {
            const nameObj = item.name as { fi?: string; en?: string } | undefined
            const title = nameObj?.fi || nameObj?.en || '(ei otsikkoa)'
            const loc = item.location as
              | {
                  name?: { fi?: string }
                  address_locality?: { fi?: string }
                  position?: { coordinates?: [number, number] }
                }
              | undefined
            const city = loc?.address_locality?.fi || ep.city
            const venue = loc?.name?.fi || '-'
            const coords = loc?.position?.coordinates
            const coordText = Array.isArray(coords)
              ? `[lat:${coords[1]?.toFixed(4)}, lng:${coords[0]?.toFixed(4)}]`
              : 'NO_COORDS'
            log('INFO', `  ${ep.city} #${idx + 1}: (${city}) "${title}" @ ${venue} | ${coordText}`)
          })
        } catch (err) {
          const ms = Math.round(performance.now() - t0)
          log(
            'ERR',
            `[${ep.city}] Linked Events verkkovirhe (${ms} ms): ${err instanceof Error ? err.message : String(err)}`,
          )
        }
      }

      if (!specificCity || specificCity === 'kauniainen') {
        log('INFO', `>>> DIRECT GET [Kauniainen] ${KAUNIAINEN_WEB_URL}`)
        const t0 = performance.now()
        try {
          const res = await fetch(KAUNIAINEN_WEB_URL, { cache: 'no-store' })
          const ms = Math.round(performance.now() - t0)
          const html = await res.text()
          log(
            res.ok ? 'OK' : 'WARN',
            `[Kauniainen] HTTP ${res.status} (${ms} ms) • HTML ${html.length} tavua (selain-CORS voi estää suoran HTML-luvun)`,
          )
        } catch (err) {
          const ms = Math.round(performance.now() - t0)
          log(
            'WARN',
            `[Kauniainen] suora selaintesti (${ms} ms): ${err instanceof Error ? err.message : String(err)}`,
          )
        }
      }

      setLoadingLinked(false)
    },
    [log],
  )

  useEffect(() => {
    void runApiDiagnostics()
  }, [runApiDiagnostics])

  const toggleCityFilter = (target: 'Helsinki' | 'Espoo' | 'Vantaa' | 'Kauniainen') => {
    setCityFilter((prev) => (isSameCity(prev, target) ? 'all' : target))
  }

  const copyConsoleLog = async () => {
    const text = logs.map((l) => `[${l.ts}] [${l.level}] ${l.msg}`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Ohitetaan leikepöydän rajoitukset
    }
  }

  const karoEvents = useMemo(
    () => events.filter((e) => (e.source || '').toLowerCase().includes('karo')),
    [events],
  )

  const linkedEvents = useMemo(
    () =>
      events.filter((e) => {
        const s = (e.source || '').toLowerCase()
        const tags = (e.tags || []).map((t) => t.toLowerCase())
        return (
          s.includes('linked') ||
          s.includes('kauniainen') ||
          tags.some((t) => t.includes('linked-events') || t.includes('kauniainen'))
        )
      }),
    [events],
  )

  const otherEvents = useMemo(
    () =>
      events.filter(
        (e) =>
          !(e.source || '').toLowerCase().includes('karo') &&
          !(e.source || '').toLowerCase().includes('linked') &&
          !(e.source || '').toLowerCase().includes('lahella') &&
          !(e.source || '').toLowerCase().includes('kauniainen') &&
          !(e.tags || []).some(
            (t) => t.toLowerCase().includes('linked-events') || t.toLowerCase().includes('kauniainen'),
          ),
      ),
    [events],
  )

  const lahellaEvents = useMemo(
    () => events.filter((e) => (e.source || '').toLowerCase().includes('lahella')),
    [events],
  )

  const filteredLahellaRawItems = useMemo(() => {
    const query = lahellaSearch.trim().toLowerCase()
    const items = lahellaDebug?.items ?? []
    if (!query) return items
    return items.filter((item) => JSON.stringify(item).toLowerCase().includes(query))
  }, [lahellaDebug, lahellaSearch])

  const filteredLogs = useMemo(() => {
    const query = logQuery.trim().toLowerCase()
    return logs.filter((entry) => {
      if (logLevelFilter !== 'ALL' && entry.level !== logLevelFilter) return false
      if (logSourceFilter !== 'ALL' && entry.source !== logSourceFilter) return false
      return !query || `${entry.source} ${entry.level} ${entry.msg}`.toLowerCase().includes(query)
    })
  }, [logs, logLevelFilter, logSourceFilter, logQuery])

  const cityFilterButtons: Array<{
    city: 'Helsinki' | 'Espoo' | 'Vantaa' | 'Kauniainen'
    count: number
    activeClass: string
    idleClass: string
  }> = [
    {
      city: 'Helsinki',
      count: meta.byEndpoint.helsinki,
      activeClass: 'bg-blue-700 text-white border-blue-800 ring-2 ring-blue-300',
      idleClass: 'bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100',
    },
    {
      city: 'Espoo',
      count: meta.byEndpoint.espoo,
      activeClass: 'bg-cyan-700 text-white border-cyan-800 ring-2 ring-cyan-300',
      idleClass: 'bg-cyan-50 text-cyan-900 border-cyan-200 hover:bg-cyan-100',
    },
    {
      city: 'Vantaa',
      count: meta.byEndpoint.vantaa,
      activeClass: 'bg-teal-700 text-white border-teal-800 ring-2 ring-teal-300',
      idleClass: 'bg-teal-50 text-teal-900 border-teal-200 hover:bg-teal-100',
    },
    {
      city: 'Kauniainen',
      count: meta.byEndpoint.kauniainen,
      activeClass: 'bg-amber-600 text-white border-amber-700 ring-2 ring-amber-300',
      idleClass: 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100',
    },
  ]

  return (
    <main className="min-h-dvh bg-slate-100 text-slate-900 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">
                Tapahtumalähteiden Debug-testisivu
              </h1>
              <p className="text-xs text-slate-500">
                Testaa{' '}
                <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                  {SHELLPROTO_ROUTE_URL}
                </code>{' '}
                -reitin ja varmistaa debug-näkymässä 25 tapahtumaa Helsingistä, Espoosta ja
                Vantaalta.
              </p>
            </div>

            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold self-start sm:self-auto"
            >
              <option value="all">Kaikki kaupungit</option>
              <option value="Helsinki">Helsinki</option>
              <option value="Espoo">Espoo</option>
              <option value="Vantaa">Vantaa</option>
              <option value="Kauniainen">Kauniainen</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={loadingApi}
              onClick={() => void runApiDiagnostics()}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold disabled:opacity-50"
            >
              {loadingApi ? `Haetaan ${SHELLPROTO_ROUTE_URL}...` : `↻ Aja ${SHELLPROTO_ROUTE_URL}`}
            </button>

            <button
              type="button"
              disabled={loadingKaro}
              onClick={() => void testKaroDirect()}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-50"
            >
              {loadingKaro ? 'Haetaan Karo...' : 'Testaa Karon feedi suoraan'}
            </button>

            <button
              type="button"
              disabled={loadingLinked}
              onClick={() => void testLinkedEventsDirect()}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
            >
              {loadingLinked ? 'Haetaan Linked Events...' : 'Testaa kaikki Linked Events'}
            </button>

            <div className="flex flex-wrap items-center gap-1 ml-auto">
              {(['helsinki', 'espoo', 'vantaa', 'kauniainen'] as const).map((cKey) => (
                <button
                  key={cKey}
                  type="button"
                  disabled={loadingLinked}
                  onClick={() => void testLinkedEventsDirect(cKey)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-200 text-[11px] font-mono font-bold text-slate-800 capitalize disabled:opacity-50"
                >
                  {cKey}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500 uppercase">Karon JSON-LD</div>
            <div className="text-2xl font-extrabold text-indigo-700 mt-1">{meta.karoCount}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              tapahtumaa ({SHELLPROTO_ROUTE_URL})
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500 uppercase">Linked Events PKS</div>
            <div className="text-2xl font-extrabold text-emerald-700 mt-1">
              {meta.linkedEventsCount}
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-0.5">
              H:{meta.byEndpoint.helsinki} • E:{meta.byEndpoint.espoo} • V:{meta.byEndpoint.vantaa}{' '}
              • K:{meta.byEndpoint.kauniainen}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500 uppercase">Lähellä.fi PKS</div>
            <div className="text-2xl font-extrabold text-fuchsia-700 mt-1">
              {lahellaDebug?.filteredItems ?? lahellaEvents.length}
            </div>
            <div className="text-[11px] mt-0.5">
              {lahellaDebug?.status ?? '—'} • {lahellaDebug?.elapsedMs ?? '—'} ms
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500 uppercase">Lähteet / HTTP & viive</div>
            <div className="text-[11px] leading-5 text-slate-700 mt-1 font-mono">
              <div>Lähellä: {cacheDebug?.sourceStatus?.lahella ?? lahellaDebug?.status ?? '—'} / {cacheDebug?.sourceElapsedMs?.lahella ?? lahellaDebug?.elapsedMs ?? '—'} ms</div>
              <div>LE: {cacheDebug?.sourceStatus?.linked ?? '—'} / {cacheDebug?.sourceElapsedMs?.linked ?? '—'} ms</div>
              <div>EP: {cacheDebug?.sourceStatus?.eventPulse ?? '—'} / {cacheDebug?.sourceElapsedMs?.eventPulse ?? '—'} ms</div>
              <div>Kauniainen: {cacheDebug?.sourceStatus?.kauniainen ?? '—'} / {cacheDebug?.sourceElapsedMs?.kauniainen ?? '—'} ms</div>
            </div>
          </div>
        </div>

        <section className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Lähellä.fi-diagnostiikka
              </h2>
              <p className="text-[11px] text-slate-500 mt-1">
                {lahellaDebug?.url || 'Lähellä.fi'}
                {lahellaDebug?.status ? ` • HTTP ${lahellaDebug.status}` : ''}
                {lahellaDebug?.elapsedMs !== undefined ? ` • ${lahellaDebug.elapsedMs} ms` : ''}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-[11px] font-bold text-emerald-800">
              Lopulliset osumat: {lahellaDebug?.filteredItems ?? lahellaEvents.length}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              ['Raakarivit', lahellaDebug?.rawItems ?? 0],
              ['PKS-rivit', lahellaDebug?.pksItems ?? 0],
              ['Lapset/perheet/viikko', lahellaDebug?.familyItems ?? 0],
              ['Lopulliset osumat', lahellaDebug?.filteredItems ?? lahellaEvents.length],
              ['Haetut sivut', lahellaDebug?.pagesFetched ?? 0],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-[10px] font-bold text-slate-500 uppercase">{label}</div>
                <div className="mt-1 text-xl font-extrabold text-slate-900">{value as number}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] font-mono text-slate-700">
            {sourceTiming?.lahellaTimeoutMs && (
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1">
                Lähellä timeout: {sourceTiming.lahellaTimeoutMs} ms
              </span>
            )}
            {sourceTiming?.linkedEventsTimeoutMs && (
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1">
                LE timeout: {sourceTiming.linkedEventsTimeoutMs} ms
              </span>
            )}
            {sourceTiming?.eventPulseTimeoutMs && (
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1">
                EP timeout: {sourceTiming.eventPulseTimeoutMs} ms
              </span>
            )}
            {cacheDebug && (
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1">
                Välimuisti: {cacheDebug.fresh ? 'tuore' : 'vanhentunut'}
                {typeof cacheDebug.ageMs === 'number' ? ` • ${cacheDebug.ageMs} ms` : ''}
                {typeof cacheDebug.ttlMs === 'number' ? ` / TTL ${cacheDebug.ttlMs} ms` : ''}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={lahellaSearch}
              onChange={(event) => setLahellaSearch(event.target.value)}
              placeholder="Hae Lähellä-kohteita, tägejä tai raakatietoja..."
              aria-label="Hae Lähellä.fi-kohteita"
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-500"
            />
            {lahellaSearch && (
              <button
                type="button"
                onClick={() => setLahellaSearch('')}
                className="min-h-11 px-3 rounded-xl border border-slate-300 bg-slate-50 text-xs font-bold text-slate-800"
              >
                Tyhjennä haku
              </button>
            )}
          </div>

          {lahellaDebug?.error && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              Lähellä.fi virhe: {lahellaDebug.error}
            </p>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {lahellaEvents.map((evt) => {
              const raw = evt.raw
              return (
                <article
                  key={evt.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-slate-900 break-words">{evt.title}</p>
                    <span className="shrink-0 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-mono">
                      {evt.city || '-'}
                    </span>
                  </div>
                  <p className="text-slate-600">
                    {evt.address || evt.locationName || '-'} • {evt.ageRangeLabel || evt.ageGroup || '-'}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(evt.tags ?? []).map((tag) => (
                      <span key={tag} className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700">
                        {tag}
                      </span>
                    ))}
                  </div>
                  {raw && (
                    <details className="rounded-lg border border-slate-200 bg-white">
                      <summary className="min-h-11 cursor-pointer px-3 py-2 text-xs font-bold text-slate-800">
                        Näytä raakatiedot
                      </summary>
                      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words p-3 text-[10px] leading-relaxed text-slate-700">
                        {JSON.stringify(raw, null, 2)}
                      </pre>
                    </details>
                  )}
                </article>
              )
            })}
          </div>

          {filteredLahellaRawItems.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[11px] font-bold text-slate-700 uppercase">
                Raakakohteet ({filteredLahellaRawItems.length})
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {filteredLahellaRawItems.slice(0, 100).map((item, index) => {
                  const summary = lahellaRawSummary(item)
                  return (
                    <details
                      key={String((item as Record<string, unknown>)._key ?? index)}
                      className="rounded-xl border border-slate-200 bg-slate-50"
                    >
                      <summary className="min-h-11 cursor-pointer px-3 py-2 text-xs font-bold text-slate-900">
                        {summary.title} • {summary.city}
                      </summary>
                      <div className="border-t border-slate-200 p-3 text-[11px] text-slate-700 space-y-1">
                        <p><strong>demographic:</strong> {summary.demographic.join(', ') || '-'}</p>
                        <p><strong>theme:</strong> {summary.theme.join(', ') || '-'}</p>
                        <p><strong>format:</strong> {summary.format.join(', ') || '-'}</p>
                        <p><strong>pricing:</strong> {summary.pricing.join(', ') || '-'}</p>
                        <p><strong>group:</strong> {summary.group}</p>
                        <p><strong>osoite:</strong> {summary.street}, {summary.city}</p>
                        <p><strong>koordinaatit:</strong>{' '}
                          {summary.lat !== null && summary.lng !== null
                            ? `[lat: ${summary.lat}, lng: ${summary.lng}]`
                            : 'ei koordinaatteja'}
                        </p>
                        <p><strong>sijaintitarkkuus:</strong> {summary.coordinateMode}</p>
                      </div>
                    </details>
                  )
                })}
              </div>
            </div>
          )}
        </section>

        {/* Kaupunkikohtaiset syötteet filtterinappeina */}
        <section className="bg-white rounded-2xl p-3.5 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="font-bold text-slate-800">
            Kaupunkifiltteri (klikkaa kaupunkia):
          </div>
          <div className="flex flex-wrap items-center gap-2 font-mono">
            <button
              type="button"
              onClick={() => setCityFilter('all')}
              className={`px-2.5 py-1 rounded-lg border font-bold transition ${
                cityFilter === 'all'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              Kaikki: {events.length}
            </button>

            {cityFilterButtons.map((btn) => {
              const isSelected = isSameCity(cityFilter, btn.city)
              return (
                <button
                  key={btn.city}
                  type="button"
                  onClick={() => toggleCityFilter(btn.city)}
                  className={`px-2.5 py-1 rounded-lg border font-bold transition ${
                    isSelected ? btn.activeClass : btn.idleClass
                  }`}
                >
                  {btn.city}: {btn.count}
                </button>
              )
            })}
          </div>
        </section>

        {consoleOpen && (
          <aside
            aria-label="Tapahtumalähteiden kelluva debug-konsoli"
            className="fixed bottom-4 right-4 z-[2000] w-[min(92vw,34rem)] max-h-[70vh] overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 text-zinc-100 shadow-2xl"
          >
            <div className="flex min-h-11 items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900 px-3 py-2">
              <span className="font-mono text-xs font-bold text-zinc-300">
                DEBUG_CONSOLE // KAUKOLOKI
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void copyConsoleLog()}
                  className="min-h-11 px-2.5 rounded-lg bg-zinc-800 text-[11px] font-bold text-zinc-200"
                >
                  {copied ? '✓' : 'Kopioi'}
                </button>
                <button
                  type="button"
                  onClick={() => setLogs([])}
                  className="min-h-11 px-2.5 rounded-lg bg-zinc-800 text-[11px] font-bold text-zinc-300"
                >
                  Tyhjennä
                </button>
                <button
                  type="button"
                  onClick={() => setConsoleOpen(false)}
                  aria-label="Sulje debug-konsoli"
                  className="min-h-11 min-w-11 rounded-lg bg-zinc-800 text-sm font-bold text-zinc-200"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="space-y-2 border-b border-zinc-800 p-3">
              <input
                type="search"
                value={logQuery}
                onChange={(event) => setLogQuery(event.target.value)}
                placeholder="Hae lokista..."
                aria-label="Hae debug-logista"
                className="min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs text-white placeholder:text-zinc-400"
              />
              <div className="flex flex-wrap gap-1.5">
                {(['ALL', 'INFO', 'OK', 'WARN', 'ERR'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setLogLevelFilter(level)}
                    className={`min-h-11 px-2.5 rounded-lg border text-[10px] font-bold ${
                      logLevelFilter === level
                        ? 'border-amber-300 bg-amber-400 text-zinc-950'
                        : 'border-zinc-700 bg-zinc-900 text-zinc-200'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(['ALL', 'API', 'Lähellä.fi', 'Linked Events', 'EventPulse', 'Kauniainen'] as const).map((source) => (
                  <button
                    key={source}
                    type="button"
                    onClick={() => setLogSourceFilter(source)}
                    className={`min-h-11 px-2.5 rounded-lg border text-[10px] font-bold ${
                      logSourceFilter === source
                        ? 'border-emerald-300 bg-emerald-500 text-zinc-950'
                        : 'border-zinc-700 bg-zinc-900 text-zinc-200'
                    }`}
                  >
                    {source}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[38vh] overflow-y-auto p-3 font-mono text-xs space-y-1 leading-relaxed">
              {filteredLogs.length === 0 ? (
                <p className="text-zinc-400">Ei suodatukseen sopivia lokimerkintöjä.</p>
              ) : (
                filteredLogs.map((entry) => {
                  const colorClass =
                    entry.level === 'ERR'
                      ? 'text-rose-400'
                      : entry.level === 'WARN'
                        ? 'text-amber-300'
                        : entry.level === 'OK'
                          ? 'text-emerald-400'
                          : 'text-zinc-200'
                  return (
                    <div key={entry.id} className={`${colorClass} break-words`}>
                      <span className="text-zinc-500">[{entry.ts}]</span>{' '}
                      <span className="text-fuchsia-300">[{entry.source}]</span>{' '}
                      <span className="font-bold">[{entry.level}]</span> {entry.msg}
                    </div>
                  )
                })
              )}
              <div ref={consoleEndRef} />
            </div>
          </aside>
        )}

        {!consoleOpen && (
          <button
            type="button"
            onClick={() => setConsoleOpen(true)}
            className="fixed bottom-4 right-4 z-[2000] min-h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-xs font-bold text-white shadow-xl"
          >
            Avaa debug-konsoli
          </button>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          <SourceListCard
            title="1. Karon JSON-LD -feedi"
            badgeClass="bg-indigo-100 text-indigo-800"
            items={karoEvents}
            emptyText="Ei tapahtumia Karon feedistä."
          />
          <SourceListCard
            title="2. Linked Events & PKS"
            badgeClass="bg-emerald-100 text-emerald-800"
            items={linkedEvents}
            emptyText="Ei tapahtumia Linked Events -rajapinnasta."
          />
          <SourceListCard
            title="3. Lähellä.fi / PKS-perheet"
            badgeClass="bg-fuchsia-100 text-fuchsia-800"
            items={lahellaEvents}
            emptyText="Ei Lähellä.fi-lapsiperhetapahtumia."
          />
          <SourceListCard
            title="4. Varadata / Muut lähteet"
            badgeClass="bg-amber-100 text-amber-800"
            items={otherEvents}
            emptyText="Ei varadata- tai muita tapahtumia."
          />
        </div>
      </div>
    </main>
  )
}

function SourceListCard({
  title,
  badgeClass,
  items,
  emptyText,
}: {
  title: string
  badgeClass: string
  items: DebugEventRow[]
  emptyText: string
}) {
  return (
    <section className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">{title}</h2>
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${badgeClass}`}>
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">{emptyText}</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {items.map((evt) => {
            const coords = getCoordsTuple(evt)
            return (
              <div
                key={evt.id}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-slate-500">
                  <span>{evt.city || 'Ei kaupunkia'}</span>
                  <span>
                    {coords ? `${coords[0].toFixed(3)}, ${coords[1].toFixed(3)}` : 'ei koord.'}
                  </span>
                </div>
                <p className="font-bold text-slate-900 leading-snug">{evt.title}</p>
                <p className="text-[11px] text-slate-600">
                  📍 {evt.locationName || evt.venue || 'Tuntematon paikka'} • 👶{' '}
                  {evt.ageRangeLabel || evt.ageGroup || '-'}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}