'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

type ResourceKind = 'events' | 'locations'
type CityKey = 'helsinki' | 'espoo' | 'vantaa'

interface InspectedRow {
  id: string
  title: string
  city: string
  placeOrAddress: string
  timeOrInfo: string
  coords: [number, number] | null
  raw: Record<string, unknown>
}

interface ServerBatchResult {
  cityKey: CityKey
  label: string
  status: number | null
  ms: number
  metaCount: number
  hasNext: boolean
  items: InspectedRow[]
  error?: string
}

interface AllEventsApiPayload {
  kind?: ResourceKind
  page?: number
  pageSize?: number
  batches?: ServerBatchResult[]
  totalReturned?: number
}

const CITY_LABELS: Record<CityKey, string> = {
  helsinki: 'Helsinki',
  espoo: 'Espoo',
  vantaa: 'Vantaa',
}

export default function AllEventsAndLocationsDebugPage() {
  const [kind, setKind] = useState<ResourceKind>('events')
  const [selectedCities, setSelectedCities] = useState<Record<CityKey, boolean>>({
    helsinki: true,
    espoo: true,
    vantaa: true,
  })
  const [page, setPage] = useState<number>(1)
  const pageSize = 50

  const [includeSuperEvents, setIncludeSuperEvents] = useState<boolean>(true)
  const [onlyMissingCoords, setOnlyMissingCoords] = useState<boolean>(false)
  const [search, setSearch] = useState<string>('')
  const [selectedRow, setSelectedRow] = useState<InspectedRow | null>(null)

  const [batches, setBatches] = useState<ServerBatchResult[]>([])
  const [statusState, setStatusState] = useState<{
    phase: 'idle' | 'loading' | 'ok' | 'error'
    requestedUrl: string
    httpStatus: number | null
    totalMs: number | null
    totalReturned: number
    detail: string
  }>({
    phase: 'idle',
    requestedUrl: '/api/allevents',
    httpStatus: null,
    totalMs: null,
    totalReturned: 0,
    detail: 'Odotetaan ensimmäistä hakua...',
  })

  const loading = statusState.phase === 'loading'

  const toggleCity = (key: CityKey) => {
    setSelectedCities((prev) => ({ ...prev, [key]: !prev[key] }))
    setPage(1)
  }

  const fetchViaServerRoute = useCallback(async () => {
    const activeKeys = (['helsinki', 'espoo', 'vantaa'] as CityKey[]).filter(
      (k) => selectedCities[k],
    )
    if (activeKeys.length === 0) {
      setBatches([])
      setStatusState({
        phase: 'error',
        requestedUrl: '(ei valittuja kaupunkeja)',
        httpStatus: null,
        totalMs: 0,
        totalReturned: 0,
        detail: 'Valitse vähintään yksi kaupunki (Helsinki, Espoo tai Vantaa).',
      })
      return
    }

    const params = new URLSearchParams()
    params.set('kind', kind)
    params.set('page', String(page))
    params.set('pageSize', String(pageSize))
    params.set('cities', activeKeys.join(','))
    if (kind === 'events') {
      params.set('includeSuper', includeSuperEvents ? 'true' : 'false')
    }

    const endpoint = `/api/allevents?${params.toString()}`
    setStatusState((prev) => ({
      ...prev,
      phase: 'loading',
      requestedUrl: endpoint,
      detail: `Haetaan palvelimelta: ${endpoint}`,
    }))

    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()

    try {
      const res = await fetch(endpoint, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      const totalMs = Math.round(
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0,
      )
      const rawText = await res.text()

      if (!res.ok) {
        setBatches([])
        setStatusState({
          phase: 'error',
          requestedUrl: endpoint,
          httpStatus: res.status,
          totalMs,
          totalReturned: 0,
          detail: `HTTP ${res.status} — Tarkista että src/app/api/allevents/route.ts on olemassa. Vastaus: ${rawText.slice(0, 180)}`,
        })
        return
      }

      let data: AllEventsApiPayload
      try {
        data = JSON.parse(rawText) as AllEventsApiPayload
      } catch {
        setBatches([])
        setStatusState({
          phase: 'error',
          requestedUrl: endpoint,
          httpStatus: res.status,
          totalMs,
          totalReturned: 0,
          detail: `Vastaus ei ollut JSONia (mahdollinen middleware/auth-uudelleenohjaus): ${rawText.slice(0, 180)}`,
        })
        return
      }

      const nextBatches = Array.isArray(data.batches) ? data.batches : []
      const returned = Number(data.totalReturned ?? 0)
      setBatches(nextBatches)
      setStatusState({
        phase: 'ok',
        requestedUrl: endpoint,
        httpStatus: res.status,
        totalMs,
        totalReturned: returned,
        detail: `OK • Palautettiin ${returned} riviä (${nextBatches.length} kuntaa) ajassa ${totalMs} ms`,
      })
    } catch (err) {
      const totalMs = Math.round(
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0,
      )
      setBatches([])
      setStatusState({
        phase: 'error',
        requestedUrl: endpoint,
        httpStatus: null,
        totalMs,
        totalReturned: 0,
        detail: `Verkkovirhe: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }, [selectedCities, kind, page, pageSize, includeSuperEvents])

  useEffect(() => {
    void fetchViaServerRoute()
  }, [fetchViaServerRoute])

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    const merged = batches.flatMap((b) => b.items)
    return merged.filter((item) => {
      if (onlyMissingCoords && item.coords !== null) return false
      if (!q) return true
      return [item.id, item.title, item.city, item.placeOrAddress, item.timeOrInfo]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [batches, onlyMissingCoords, search])

  const anyHasNext = batches.some((b) => b.hasNext)
  const totalWithCoords = visibleItems.filter((i) => i.coords !== null).length

  const statusBannerStyle =
    statusState.phase === 'loading'
      ? 'bg-amber-950/70 border-amber-500/60 text-amber-200'
      : statusState.phase === 'ok'
        ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-200'
        : statusState.phase === 'error'
          ? 'bg-rose-950/80 border-rose-500/70 text-rose-200'
          : 'bg-slate-900 border-slate-700 text-slate-300'

  const statusDotStyle =
    statusState.phase === 'loading'
      ? 'bg-amber-400 animate-ping'
      : statusState.phase === 'ok'
        ? 'bg-emerald-400'
        : statusState.phase === 'error'
          ? 'bg-rose-500'
          : 'bg-slate-400'

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <header className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[11px] font-bold">
                /akotestaa/allevents
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[11px] font-bold">
                SERVER ROUTE: /api/allevents
              </span>
              <h1 className="text-lg sm:text-xl font-extrabold text-white">
                All Events & Locations Lab (50 / kaupunki)
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Hakee tiedot palvelinpuolen <code className="font-mono text-cyan-300">/api/allevents</code>{' '}
              -reitin kautta ilman selaimen suoria rajapintakutsuja.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setKind('events')
                setPage(1)
                setSelectedRow(null)
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold ${
                kind === 'events'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              📅 Events (50/kunta)
            </button>
            <button
              type="button"
              onClick={() => {
                setKind('locations')
                setPage(1)
                setSelectedRow(null)
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold ${
                kind === 'locations'
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              📍 Locations (50/kunta)
            </button>
          </div>
        </header>

        {/* AINA NÄKYVÄ STATUSINDIKAATTORI */}
        <section
          className={`rounded-2xl border px-4 py-3 flex flex-wrap items-center justify-between gap-2 font-mono text-xs ${statusBannerStyle}`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDotStyle}`} />
            <div className="min-w-0">
              <div className="font-bold uppercase">
                STATUS: {statusState.phase}
                {statusState.httpStatus !== null ? ` (HTTP ${statusState.httpStatus})` : ''}
                {statusState.totalMs !== null ? ` • ${statusState.totalMs} ms` : ''}
              </div>
              <div className="text-[11px] opacity-90 break-all">{statusState.detail}</div>
            </div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void fetchViaServerRoute()}
            className="px-3 py-1.5 rounded-xl bg-black/40 hover:bg-black/60 border border-white/15 font-bold text-xs shrink-0 disabled:opacity-50"
          >
            {loading ? 'Haetaan...' : '↻ Aja haku nyt'}
          </button>
        </section>

        {/* Suodattimet ja sivutus */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {(['helsinki', 'espoo', 'vantaa'] as CityKey[]).map((key) => (
                <label
                  key={key}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer font-semibold"
                >
                  <input
                    type="checkbox"
                    checked={selectedCities[key]}
                    onChange={() => toggleCity(key)}
                    className="accent-emerald-500"
                  />
                  <span>{CITY_LABELS[key]}</span>
                </label>
              ))}

              {kind === 'events' && (
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSuperEvents}
                    onChange={(e) => {
                      setIncludeSuperEvents(e.target.checked)
                      setPage(1)
                    }}
                    className="accent-cyan-500"
                  />
                  <span>Sisällytä sarja-/ylätason tapahtumat</span>
                </label>
              )}

              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyMissingCoords}
                  onChange={(e) => setOnlyMissingCoords(e.target.checked)}
                  className="accent-amber-500"
                />
                <span>Vain ilman koordinaatteja</span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={loading || page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold disabled:opacity-40"
              >
                ← Sivu {Math.max(1, page - 1)}
              </button>
              <span className="font-mono font-bold px-2 text-cyan-300">
                Sivu {page} (max {pageSize}/kunta)
              </span>
              <button
                type="button"
                disabled={loading || !anyHasNext}
                onClick={() => setPage((p) => p + 1)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold disabled:opacity-40"
              >
                Seuraava 50 →
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suodata tuloksia nimellä, paikalla, kaupungilla tai ID:llä..."
              className="w-full sm:w-80 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder:text-slate-500"
            />
            <div className="font-mono text-[11px] text-slate-400">
              Palvelimelta: <strong className="text-white">{statusState.totalReturned}</strong> •
              Näkyvissä: <strong className="text-white">{visibleItems.length}</strong> •
              Koordinaatit: <strong className="text-emerald-300">{totalWithCoords}</strong>/
              {visibleItems.length}
            </div>
          </div>
        </section>

        {/* Kuntakohtaiset erätila-kortit */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {batches.map((b) => (
            <div
              key={b.cityKey}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 text-xs space-y-1.5"
            >
              <div className="flex items-center justify-between font-mono">
                <span className="font-bold text-white">{b.label}</span>
                <span className="text-cyan-300">
                  HTTP {b.status ?? 'ERR'} • {b.ms} ms
                </span>
              </div>
              <div className="font-mono text-[11px] text-slate-300">
                Sivulla: <strong>{b.items.length}</strong> / Kanta yht.:{' '}
                <strong>{b.metaCount}</strong>
              </div>
              {b.error && <div className="font-mono text-[11px] text-rose-400">{b.error}</div>}
            </div>
          ))}
        </section>

        {/* Tulokset + JSON-inspektori */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          <div className="lg:col-span-2 space-y-2">
            {visibleItems.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">
                {loading
                  ? 'Ladataan aineistoa palvelimelta...'
                  : 'Ei näytettäviä rivejä — tarkista yllä oleva STATUS-palkki.'}
              </div>
            ) : (
              visibleItems.map((item) => {
                const active = selectedRow?.id === item.id && selectedRow?.city === item.city
                return (
                  <button
                    key={`${item.city}-${item.id}`}
                    type="button"
                    onClick={() => setSelectedRow(item)}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition-colors ${
                      active
                        ? 'bg-slate-800 border-cyan-400'
                        : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                      <span className="text-cyan-300 font-bold">
                        {item.city} • {item.id}
                      </span>
                      <span className={item.coords ? 'text-emerald-400' : 'text-amber-400'}>
                        {item.coords
                          ? `${item.coords[0].toFixed(4)}, ${item.coords[1].toFixed(4)}`
                          : 'EI KOORDINAATTEJA'}
                      </span>
                    </div>
                    <div className="font-bold text-sm text-white mt-0.5">{item.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {item.placeOrAddress} • {item.timeOrInfo}
                    </div>
                  </button>
                )
              })
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs sticky top-4">
            <div className="font-mono font-bold text-cyan-300">
              {selectedRow ? `JSON: ${selectedRow.id}` : 'Valitse rivi nähdäksesi raakadatan'}
            </div>
            {selectedRow ? (
              <pre className="p-3 rounded-xl bg-black border border-slate-800 font-mono text-[10px] text-cyan-200 overflow-x-auto max-h-[480px]">
                {JSON.stringify(selectedRow.raw, null, 2)}
              </pre>
            ) : (
              <p className="text-slate-500 text-xs py-6">
                Klikkaa vasemmalta tapahtumaa tai sijaintia tarkastellaksesi kenttiä.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}