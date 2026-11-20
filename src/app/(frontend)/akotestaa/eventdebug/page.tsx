'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

interface DebugEventRow {
  id: string
  title: string
  city?: string
  locationName?: string
  startDate?: string
  source?: string
  coordinates?: { lat: number; lng: number }
  ageRangeLabel?: string
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
    byCity?: Record<string, number>
  }
}

interface ConsoleEntry {
  id: string
  ts: string
  level: 'INFO' | 'OK' | 'WARN' | 'ERR'
  msg: string
}

const KARO_DIRECT_URL =
  'https://eventpulsebyjunailijat.ai.studio/api/events/feed.jsonld'

const LINKED_EVENTS_DIRECT_URL =
  'https://api.hel.fi/linkedevents/v1/event/?start=today&keyword_OR=yso:p4354,yso:p13050,yso:p4363,yso:p10557,yso:p11017,yso:p2771&include=location,keywords&page_size=15'

function nowStamp(): string {
  return new Date().toLocaleTimeString('fi-FI', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
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
    byCity: Record<string, number>
    warning?: string
  }>({
    httpStatus: null,
    durationMs: null,
    isFallback: null,
    karoCount: 0,
    linkedEventsCount: 0,
    byCity: {},
  })

  const [logs, setLogs] = useState<ConsoleEntry[]>([])
  const [copied, setCopied] = useState(false)
  const consoleEndRef = useRef<HTMLDivElement>(null)

  const log = useCallback((level: ConsoleEntry['level'], msg: string) => {
    setLogs((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ts: nowStamp(),
        level,
        msg,
      },
    ])
  }, [])

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const runApiDiagnostics = useCallback(async () => {
    setLoadingApi(true)
    const query = cityFilter !== 'all' ? `?city=${encodeURIComponent(cityFilter)}` : ''
    const endpoint = `/api/events${query}`

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

      const list = Array.isArray(data.events) ? data.events : []
      const karoCount =
        data.sources?.karoCount ?? list.filter((e) => (e.source || '').includes('karo')).length
      const linkedEventsCount =
        data.sources?.linkedEventsCount ??
        list.filter((e) => (e.source || '').includes('linked')).length
      const byCity = data.sources?.byCity ?? {}

      setEvents(list)
      setMeta({
        httpStatus: res.status,
        durationMs: ms,
        isFallback: typeof data.isFallback === 'boolean' ? data.isFallback : null,
        karoCount,
        linkedEventsCount,
        byCity,
        warning: data.warning,
      })

      log('INFO', `isFallback = ${String(data.isFallback)} | total = ${list.length}`)
      log(
        'INFO',
        `Lähteet: Karo = ${karoCount} kpl | Linked Events = ${linkedEventsCount} kpl`,
      )
      log('INFO', `Kaupunkijakauma: ${JSON.stringify(byCity)}`)

      if (data.warning) {
        log('WARN', `API warning: ${data.warning}`)
      }

      const withCoords = list.filter(
        (e) =>
          e.coordinates &&
          typeof e.coordinates.lat === 'number' &&
          typeof e.coordinates.lng === 'number',
      ).length
      log('INFO', `Koordinaateilla varustetut tapahtumat: ${withCoords} / ${list.length}`)

      list.slice(0, 6).forEach((evt, idx) => {
        const coordStr = evt.coordinates
          ? `[${evt.coordinates.lat.toFixed(4)}, ${evt.coordinates.lng.toFixed(4)}]`
          : 'NO_COORDS'
        log(
          'INFO',
          `  #${idx + 1} [${evt.source ?? 'unknown'}] (${evt.city ?? '?'}) "${evt.title}" @ ${evt.locationName ?? '-'} | ${coordStr}`,
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
            log('WARN', `Karo JSON ei sisältänyt @graph/events/itemListElement-taulukkoa: ${rawText.slice(0, 280)}`)
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

  const testLinkedEventsDirect = useCallback(async () => {
    setLoadingLinked(true)
    log('INFO', `>>> DIRECT GET ${LINKED_EVENTS_DIRECT_URL}`)
    const t0 = performance.now()

    try {
      const res = await fetch(LINKED_EVENTS_DIRECT_URL, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      const ms = Math.round(performance.now() - t0)
      log(res.ok ? 'OK' : 'ERR', `Linked Events HTTP ${res.status} (${ms} ms)`)

      const rawText = await res.text()
      log('INFO', `Linked Events payload-koko: ${rawText.length} tavua`)

      try {
        const parsed = JSON.parse(rawText) as {
          meta?: { count?: number }
          data?: Array<Record<string, unknown>>
        }
        const rows = Array.isArray(parsed.data) ? parsed.data : []
        log(
          'OK',
          `Linked Events palautti ${rows.length} tapahtumaa (meta.count = ${parsed.meta?.count ?? '?'})`,
        )

        rows.slice(0, 5).forEach((item, idx) => {
          const nameObj = item.name as { fi?: string; en?: string } | undefined
          const title = nameObj?.fi || nameObj?.en || '(ei otsikkoa)'
          const loc = item.location as
            | {
                name?: { fi?: string }
                address_locality?: { fi?: string }
                position?: { coordinates?: [number, number] }
              }
            | undefined
          const city = loc?.address_locality?.fi || '?'
          const venue = loc?.name?.fi || '-'
          const coords = loc?.position?.coordinates
          const coordText = Array.isArray(coords)
            ? `[lat:${coords[1]?.toFixed(4)}, lng:${coords[0]?.toFixed(4)}]`
            : 'NO_COORDS'
          log('INFO', `  LE #${idx + 1}: (${city}) "${title}" @ ${venue} | ${coordText}`)
        })
      } catch (parseErr) {
        log(
          'ERR',
          `Linked Events JSON.parse epäonnistui: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
        )
      }
    } catch (err) {
      const ms = Math.round(performance.now() - t0)
      log(
        'ERR',
        `Linked Events verkkovirhe (${ms} ms): ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setLoadingLinked(false)
    }
  }, [log])

  useEffect(() => {
    void runApiDiagnostics()
  }, [runApiDiagnostics])

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

  const karoEvents = events.filter((e) => (e.source || '').includes('karo'))
  const linkedEvents = events.filter((e) => (e.source || '').includes('linked'))
  const otherEvents = events.filter(
    (e) => !(e.source || '').includes('karo') && !(e.source || '').includes('linked'),
  )

  return (
    <main className="min-h-dvh bg-slate-100 text-slate-900 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Ylätunniste ja testipainikkeet */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">
                Tapahtumalähteiden Debug-testisivu
              </h1>
              <p className="text-xs text-slate-500">
                Testaa sekä oman <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">/api/events</code>{' '}
                -reitin että suorat raakakutsut Karon JSON-LD-feediin ja Helsingin Linked Events -rajapintaan.
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
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
            <button
              type="button"
              disabled={loadingApi}
              onClick={() => void runApiDiagnostics()}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold disabled:opacity-50"
            >
              {loadingApi ? 'Haetaan /api/events...' : '↻ Aja /api/events'}
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
              {loadingLinked ? 'Haetaan Linked Events...' : 'Testaa Linked Events suoraan'}
            </button>
          </div>
        </div>

        {/* Yhteenvetokortit per lähde */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500 uppercase">Karon JSON-LD</div>
            <div className="text-2xl font-extrabold text-indigo-700 mt-1">{meta.karoCount}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">tapahtumaa (/api/events)</div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500 uppercase">Linked Events PKS</div>
            <div className="text-2xl font-extrabold text-emerald-700 mt-1">
              {meta.linkedEventsCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">tapahtumaa (/api/events)</div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500 uppercase">Yhteensä / Tila</div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">{events.length}</div>
            <div className="text-[11px] mt-0.5">
              {meta.isFallback === null ? (
                <span className="text-slate-400">—</span>
              ) : meta.isFallback ? (
                <span className="text-amber-700 font-bold">FALLBACK</span>
              ) : (
                <span className="text-emerald-700 font-bold">LIVE API</span>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500 uppercase">HTTP / Viive</div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">
              {meta.httpStatus ?? '—'}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {meta.durationMs !== null ? `${meta.durationMs} ms` : '—'}
            </div>
          </div>
        </div>

        {/* Musta Debug Console -ikkuna */}
        <section className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-lg">
          <div className="bg-zinc-900 px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="font-mono text-xs font-bold text-zinc-300 ml-1">
                DEBUG_CONSOLE // EVENTS_DIAGNOSTICS
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void copyConsoleLog()}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 font-mono text-[11px] text-zinc-200"
              >
                {copied ? '✓ Kopioitu' : 'Kopioi loki'}
              </button>
              <button
                type="button"
                onClick={() => setLogs([])}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 font-mono text-[11px] text-zinc-400"
              >
                Tyhjennä
              </button>
            </div>
          </div>

          <div className="p-4 max-h-80 overflow-y-auto font-mono text-xs space-y-1 leading-relaxed">
            {logs.length === 0 ? (
              <p className="text-zinc-500">Ei lokimerkintöjä...</p>
            ) : (
              logs.map((entry) => {
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
                    <span className="font-bold">[{entry.level}]</span> {entry.msg}
                  </div>
                )
              })
            )}
            <div ref={consoleEndRef} />
          </div>
        </section>

        {/* Tapahtumat listattuna lähteittäin */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          <SourceListCard
            title="1. Karon JSON-LD -feedi"
            badgeClass="bg-indigo-100 text-indigo-800"
            items={karoEvents}
            emptyText="Ei tapahtumia Karon feedistä."
          />
          <SourceListCard
            title="2. Linked Events (PKS)"
            badgeClass="bg-emerald-100 text-emerald-800"
            items={linkedEvents}
            emptyText="Ei tapahtumia Linked Events -rajapinnasta."
          />
          <SourceListCard
            title="3. Varadata / Muut lähteet"
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
          {items.map((evt) => (
            <div
              key={evt.id}
              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1"
            >
              <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-slate-500">
                <span>{evt.city || 'Ei kaupunkia'}</span>
                <span>
                  {evt.coordinates
                    ? `${evt.coordinates.lat.toFixed(3)}, ${evt.coordinates.lng.toFixed(3)}`
                    : 'ei koord.'}
                </span>
              </div>
              <p className="font-bold text-slate-900 leading-snug">{evt.title}</p>
              <p className="text-[11px] text-slate-600">
                📍 {evt.locationName || 'Tuntematon paikka'} • 👶 {evt.ageRangeLabel || '-'}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}