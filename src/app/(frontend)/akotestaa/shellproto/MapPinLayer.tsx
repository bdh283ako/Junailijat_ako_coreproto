'use client'

import React, { useState } from 'react'
import { CircleMarker, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import type { CityOnlyGroup, GeoResolvableEvent, ResolvedMapEvents } from './mapGeoResolver'

type MapPinEvent = GeoResolvableEvent & {
  locationName?: string
}

interface MapPinLayerProps<T extends MapPinEvent> {
  mapData: ResolvedMapEvents<T>
  onSelectEvent?: (eventId: string) => void
}

function createCityListIcon(count: number) {
  return L.divIcon({
    className: 'perhepiiri-city-list-pin',
    html: `<div style="
      background:#F7F6F3;
      color:#2E211B;
      border:2px solid #9E4B16;
      border-radius:9999px;
      padding:3px 8px;
      font-size:11px;
      font-weight:700;
      box-shadow:0 2px 6px rgba(0,0,0,0.18);
      white-space:nowrap;
    ">Lista (${count})</div>`,
    iconSize: [64, 24],
    iconAnchor: [32, 12],
  })
}

export function MapPinLayer<T extends MapPinEvent>({
  mapData,
  onSelectEvent,
}: MapPinLayerProps<T>) {
  const [activeCityGroup, setActiveCityGroup] = useState<CityOnlyGroup<T> | null>(null)

  return (
    <>
      {/* 1. Tarkka karttasijainti: terrakotta */}
      {mapData.exactPins.map((item) => {
        if (!item.plotCoords) return null
        return (
          <CircleMarker
            key={`exact-${item.event.id}`}
            center={item.plotCoords}
            radius={8}
            pathOptions={{
              color: '#6D3514',
              weight: 2,
              fillColor: '#9E4B16',
              fillOpacity: 0.92,
            }}
          >
            <Popup>
              <div className="text-xs space-y-1">
                <div className="font-bold text-[#9E4B16]">Tarkka sijainti</div>
                <div className="font-semibold">{item.event.title}</div>
                {item.event.locationName && <div>{item.event.locationName}</div>}
                {item.city && <div className="text-slate-600">{item.city}</div>}
                {onSelectEvent && (
                  <button
                    type="button"
                    onClick={() => onSelectEvent(item.event.id)}
                    className="mt-1 underline text-[#9E4B16] font-medium"
                  >
                    Avaa tapahtuma
                  </button>
                )}
              </div>
            </Popup>
          </CircleMarker>
        )
      })}

      {/* 2. Kaupunginosa / tunnettu alue: salvia */}
      {mapData.districtPins.map((item) => {
        if (!item.plotCoords) return null
        return (
          <CircleMarker
            key={`district-${item.event.id}`}
            center={item.plotCoords}
            radius={7}
            pathOptions={{
              color: '#2F5D50',
              weight: 2,
              fillColor: '#9CB9B7',
              fillOpacity: 0.85,
            }}
          >
            <Popup>
              <div className="text-xs space-y-1">
                <div className="font-bold text-[#2F5D50]">
                  Alue: {item.district} ({item.city})
                </div>
                <div className="font-semibold">{item.event.title}</div>
                {item.event.locationName && <div>{item.event.locationName}</div>}
                {onSelectEvent && (
                  <button
                    type="button"
                    onClick={() => onSelectEvent(item.event.id)}
                    className="mt-1 underline text-[#2F5D50] font-medium"
                  >
                    Avaa tapahtuma
                  </button>
                )}
              </div>
            </Popup>
          </CircleMarker>
        )
      })}

      {/* 3. Vain kaupunki: yksi yhteinen listamarkkeri per kaupunki */}
      {mapData.cityGroups.map((group) => (
        <Marker
          key={`city-group-${group.city}`}
          position={group.coords}
          icon={createCityListIcon(group.items.length)}
          eventHandlers={{
            click: () => setActiveCityGroup(group),
          }}
        >
          <Popup>
            <div className="text-xs space-y-1">
              <div className="font-bold text-slate-900">
                {group.city} — {group.items.length} kaupunkitason tapahtumaa
              </div>
              <div className="text-slate-600">
                Ei tarkkaa osoitetta tai kaupunginosaa. Klikkaa avataksesi listan.
              </div>
              <button
                type="button"
                onClick={() => setActiveCityGroup(group)}
                className="mt-1 px-2 py-1 rounded bg-[var(--color-accent)] text-white font-semibold"
              >
                Avaa listaus ({group.items.length})
              </button>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Selitteet ja avautuva kaupunkikohtainen lista */}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-700">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#9E4B16] border border-[#6D3514] inline-block" />
          Tarkka sijainti ({mapData.stats.exactCount})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#9CB9B7] border border-[#2F5D50] inline-block" />
          Kaupunginosa / alue ({mapData.stats.districtCount})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded-full border border-[#9E4B16] bg-white text-[var(--color-ink)] font-semibold text-[10px]">
            Lista
          </span>
          Vain kaupunki ({mapData.stats.cityOnlyCount})
        </span>
      </div>

      {activeCityGroup && (
        <div className="mt-2 rounded-lg border border-[#2F5D50]/40 bg-[var(--color-accent-soft)]/30 p-3 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-[var(--color-ink)]">
              {activeCityGroup.city} — vain kaupunkitason tapahtumat ({activeCityGroup.items.length})
            </span>
            <button
              type="button"
              onClick={() => setActiveCityGroup(null)}
              className="text-[#2F5D50] underline font-medium"
            >
              Sulje lista
            </button>
          </div>
          <ul className="space-y-1.5 max-h-48 overflow-y-auto">
            {activeCityGroup.items.map((item) => (
              <li
                key={`city-item-${item.event.id}`}
                className="flex items-center justify-between gap-2 bg-white rounded px-2.5 py-1.5 border border-[var(--color-border)]"
              >
                <div>
                  <div className="font-semibold text-slate-900">{item.event.title}</div>
                  <div className="text-[11px] text-slate-500">
                    {item.event.locationName ||
                      item.event.address ||
                      item.event.streetAddress ||
                      activeCityGroup.city}
                  </div>
                </div>
                {onSelectEvent && (
                  <button
                    type="button"
                    onClick={() => onSelectEvent(item.event.id)}
                    className="shrink-0 text-[#2F5D50] font-semibold underline"
                  >
                    Valitse
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}