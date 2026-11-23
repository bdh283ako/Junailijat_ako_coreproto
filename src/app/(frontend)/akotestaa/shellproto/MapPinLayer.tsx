'use client'

import React, { useState } from 'react'
import { CircleMarker, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import type { CityGroupedEvents, MapPlottableEvent, ResolvedMapData } from './mapGeoResolver'

interface MapPinLayerProps {
  mapData: ResolvedMapData
  onSelectEvent?: (eventId: string) => void
}

function createCityListIcon(count: number) {
  return L.divIcon({
    className: 'perhepiiri-city-list-pin',
    html: `<div style="
      background:#ffffff;
      color:#065f46;
      border:2px solid #059669;
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

export function MapPinLayer({ mapData, onSelectEvent }: MapPinLayerProps) {
  const [activeCityGroup, setActiveCityGroup] = useState<CityGroupedEvents | null>(null)

  return (
    <>
      {/* 1. Tarkka karttasijainti: vahva emerald-vihreä */}
      {mapData.exactPins.map((evt: MapPlottableEvent) => {
        if (!evt.plotCoordinates) return null
        return (
          <CircleMarker
            key={`exact-${evt.id}`}
            center={[evt.plotCoordinates.lat, evt.plotCoordinates.lng]}
            radius={8}
            pathOptions={{
              color: '#064e3b',
              weight: 2,
              fillColor: '#059669',
              fillOpacity: 0.92,
            }}
          >
            <Popup>
              <div className="text-xs space-y-1">
                <div className="font-bold text-emerald-800">Tarkka sijainti</div>
                <div className="font-semibold">{evt.title}</div>
                {evt.locationName && <div>{evt.locationName}</div>}
                {evt.city && <div className="text-slate-600">{evt.city}</div>}
                {onSelectEvent && (
                  <button
                    type="button"
                    onClick={() => onSelectEvent(evt.id)}
                    className="mt-1 underline text-emerald-700 font-medium"
                  >
                    Avaa tapahtuma
                  </button>
                )}
              </div>
            </Popup>
          </CircleMarker>
        )
      })}

      {/* 2. Kaupunginosa / tunnettu alue: vaaleanvihreä */}
      {mapData.districtPins.map((evt: MapPlottableEvent) => {
        if (!evt.plotCoordinates) return null
        return (
          <CircleMarker
            key={`district-${evt.id}`}
            center={[evt.plotCoordinates.lat, evt.plotCoordinates.lng]}
            radius={7}
            pathOptions={{
              color: '#15803d',
              weight: 1.5,
              fillColor: '#86efac',
              fillOpacity: 0.85,
            }}
          >
            <Popup>
              <div className="text-xs space-y-1">
                <div className="font-bold text-green-800">
                  Alue: {evt.district} ({evt.city})
                </div>
                <div className="font-semibold">{evt.title}</div>
                {evt.locationName && <div>{evt.locationName}</div>}
                {onSelectEvent && (
                  <button
                    type="button"
                    onClick={() => onSelectEvent(evt.id)}
                    className="mt-1 underline text-green-800 font-medium"
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
          position={[group.coordinates.lat, group.coordinates.lng]}
          icon={createCityListIcon(group.events.length)}
          eventHandlers={{
            click: () => setActiveCityGroup(group),
          }}
        >
          <Popup>
            <div className="text-xs space-y-1">
              <div className="font-bold text-slate-900">
                {group.city} — {group.events.length} kaupunkitason tapahtumaa
              </div>
              <div className="text-slate-600">
                Ei tarkkaa osoitetta tai kaupunginosaa. Klikkaa avataksesi listan.
              </div>
              <button
                type="button"
                onClick={() => setActiveCityGroup(group)}
                className="mt-1 px-2 py-1 rounded bg-emerald-600 text-white font-semibold"
              >
                Avaa listaus ({group.events.length})
              </button>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Selitteet ja avautuva kaupunkikohtainen lista */}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-700">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-600 border border-emerald-950 inline-block" />
          Tarkka sijainti ({mapData.stats.exactCount})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-200 border border-green-700 inline-block" />
          Kaupunginosa / alue ({mapData.stats.districtCount})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded-full border border-emerald-600 bg-white text-emerald-800 font-semibold text-[10px]">
            Lista
          </span>
          Vain kaupunki ({mapData.stats.cityOnlyCount})
        </span>
      </div>

      {activeCityGroup && (
        <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-emerald-950">
              {activeCityGroup.city} — vain kaupunkitason tapahtumat ({activeCityGroup.events.length})
            </span>
            <button
              type="button"
              onClick={() => setActiveCityGroup(null)}
              className="text-emerald-800 underline font-medium"
            >
              Sulje lista
            </button>
          </div>
          <ul className="space-y-1.5 max-h-48 overflow-y-auto">
            {activeCityGroup.events.map((item) => (
              <li
                key={`city-item-${item.id}`}
                className="flex items-center justify-between gap-2 bg-white rounded px-2.5 py-1.5 border border-emerald-100"
              >
                <div>
                  <div className="font-semibold text-slate-900">{item.title}</div>
                  <div className="text-[11px] text-slate-500">
                    {item.locationName || item.address || activeCityGroup.city}
                  </div>
                </div>
                {onSelectEvent && (
                  <button
                    type="button"
                    onClick={() => onSelectEvent(item.id)}
                    className="shrink-0 text-emerald-700 font-semibold underline"
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