'use client'

import React, { useEffect, useRef, useState } from 'react'
import { FamilyEvent, FamilyProfile, PKS_DEFAULT_BOUNDS } from './protoData'

interface LeafletCircleMarker {
  addTo: (map: LeafletMapInstance) => LeafletCircleMarker
  bindPopup: (html: string) => LeafletCircleMarker
  on: (event: string, handler: () => void) => LeafletCircleMarker
}

interface LeafletMapInstance {
  remove: () => void
  setView: (coords: [number, number], zoom: number) => void
  fitBounds: (bounds: unknown, options?: { padding?: [number, number] }) => void
}

interface LeafletGlobal {
  map: (container: HTMLElement, options?: { zoomSnap?: number }) => LeafletMapInstance
  tileLayer: (
    url: string,
    options?: { attribution?: string; maxZoom?: number },
  ) => { addTo: (map: LeafletMapInstance) => void }
  latLngBounds: (sw: [number, number], ne: [number, number]) => unknown
  circleMarker: (
    coords: [number, number],
    options: {
      radius: number
      fillColor: string
      color: string
      weight: number
      fillOpacity: number
    },
  ) => LeafletCircleMarker
}

interface PksMapViewProps {
  events: FamilyEvent[]
  attendingIds: string[]
  matchedFamilies: FamilyProfile[]
  homeCoords: [number, number]
  homeLabel: string
  familyName: string
  shareEventsWithMatches: boolean
  showCloseRelativesInMatches: boolean
  focusCoords: [number, number] | null
  onResetBounds: () => void
}

export function PksMapView({
  events,
  attendingIds,
  matchedFamilies,
  homeCoords,
  homeLabel,
  familyName,
  shareEventsWithMatches,
  showCloseRelativesInMatches,
  focusCoords,
  onResetBounds,
}: PksMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<LeafletMapInstance | null>(null)
  const [mapError, setMapError] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setMapError(false)

    const initLeaflet = () => {
      const L = (window as unknown as { L?: LeafletGlobal }).L
      if (!L || !mapContainerRef.current) {
        setMapError(true)
        return
      }

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }

      const map = L.map(mapContainerRef.current, { zoomSnap: 0.25 })
      mapInstanceRef.current = map

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        { attribution: '© Esri / OSM', maxZoom: 19 },
      ).addTo(map)

      const defaultBounds = L.latLngBounds(PKS_DEFAULT_BOUNDS[0], PKS_DEFAULT_BOUNDS[1])

      if (focusCoords) {
        map.setView(focusCoords, 14)
      } else {
        map.fitBounds(defaultBounds, { padding: [16, 16] })
      }

      L.circleMarker(homeCoords, {
        radius: 12,
        fillColor: '#f97316',
        color: '#fff',
        weight: 3,
        fillOpacity: 0.98,
      })
        .addTo(map)
        .bindPopup(
          `<strong>🟠 Oma koti (${familyName})</strong><br/>${homeLabel}<br/><span style="font-size:11px;color:#ea580c;">Klikkaus zoomaa oletusnäkymään</span>`,
        )
        .on('click', () => {
          map.fitBounds(defaultBounds, { padding: [16, 16] })
          onResetBounds()
        })

      events.forEach((evt) => {
        const isGoing = attendingIds.includes(evt.id)
        const descHtml = evt.description
          ? `<br/><span style="font-size:11px;color:#475569;">${evt.description}</span>`
          : ''
        const linkHtml = evt.url
          ? `<br/><a href="${evt.url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:4px;font-size:11px;font-weight:700;color:#2563eb;text-decoration:underline;">Lisätiedot ↗</a>`
          : ''

        L.circleMarker(evt.coords, {
          radius: 10,
          fillColor: '#2563eb',
          color: '#fff',
          weight: 2.5,
          fillOpacity: 0.95,
        })
          .addTo(map)
          .bindPopup(
            `<strong>📅 ${evt.title}</strong><br/>${evt.venue}<br/>${
              isGoing ? '✅ Olet menossa mukaan' : evt.time
            }${descHtml}${linkHtml}`,
          )
      })

      matchedFamilies.forEach((fam) => {
        const eventNote =
          shareEventsWithMatches && fam.attendingEventId
            ? `<br/><span style="font-size:11px;color:#059669;">Tapahtuma: ${
                events.find((e) => e.id === fam.attendingEventId)?.title || ''
              }</span>`
            : ''

        const relativesNote =
          showCloseRelativesInMatches && fam.hasCloseRelatives && fam.closeRelativesSummary
            ? `<br/><span style="font-size:11px;color:#475569;">🫂 Läheiset: ${fam.closeRelativesSummary}</span>`
            : ''

        L.circleMarker(fam.coords, {
          radius: 11,
          fillColor: '#059669',
          color: '#fff',
          weight: 2.5,
          fillOpacity: 0.95,
        })
          .addTo(map)
          .bindPopup(
            `<strong>🤝 ${fam.name}</strong><br/>${fam.area} (${fam.childrenAges})${eventNote}${relativesNote}`,
          )
      })
    }

    if ((window as unknown as { L?: LeafletGlobal }).L) {
      initLeaflet()
      return
    }

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.async = true
    script.onload = initLeaflet
    script.onerror = () => setMapError(true)
    document.body.appendChild(script)
  }, [
    events,
    attendingIds,
    matchedFamilies,
    homeCoords,
    homeLabel,
    familyName,
    shareEventsWithMatches,
    showCloseRelativesInMatches,
    focusCoords,
    onResetBounds,
  ])

  return (
    <div className="h-full flex flex-col relative">
      {mapError ? (
        <div className="flex-1 flex items-center justify-center p-6 text-center text-xs text-slate-600 bg-slate-100">
          Karttakirjaston lataus ei onnistunut. Tarkista verkkoyhteys ja avaa kartta uudelleen.
        </div>
      ) : (
        <div ref={mapContainerRef} className="flex-1 w-full" />
      )}
      <div className="bg-white border-t border-slate-200 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-2 text-xs shrink-0">
        <div className="flex flex-wrap gap-3 font-medium text-slate-700">
          <span>🟠 Oma koti</span>
          <span>🔵 Tapahtumat ({events.length})</span>
          <span>🟢 Osumat ({matchedFamilies.length})</span>
        </div>
        <button
          type="button"
          onClick={onResetBounds}
          className="px-2.5 py-1 rounded-lg bg-slate-100 font-semibold text-slate-800 shrink-0"
        >
          Koko PKS
        </button>
      </div>
    </div>
  )
}