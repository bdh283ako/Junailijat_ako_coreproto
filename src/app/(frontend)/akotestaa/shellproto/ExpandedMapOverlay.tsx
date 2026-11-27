'use client'

import { useEffect, useRef, useState } from 'react'
import type { FamilyEvent, FamilyProfile } from './protoData'
import { PksMapView } from './PksMapView'

export type MapOverlaySource = 'events' | 'families'
type MapOverlayLayer = MapOverlaySource | 'all'

interface ExpandedMapOverlayProps {
  source: MapOverlaySource
  events: FamilyEvent[]
  families: FamilyProfile[]
  attendingIds: string[]
  homeCoords: [number, number]
  homeLabel: string
  familyName: string
  shareEventsWithMatches: boolean
  showCloseRelativesInMatches: boolean
  onClose: () => void
  onResetBounds: () => void
}

const MAP_LAYERS: { id: MapOverlayLayer; label: string }[] = [
  { id: 'events', label: 'Tapahtumat' },
  { id: 'families', label: 'Perheet' },
  { id: 'all', label: 'Kaikki' },
]

export function ExpandedMapOverlay({
  source,
  events,
  families,
  attendingIds,
  homeCoords,
  homeLabel,
  familyName,
  shareEventsWithMatches,
  showCloseRelativesInMatches,
  onClose,
  onResetBounds,
}: ExpandedMapOverlayProps) {
  const [activeLayer, setActiveLayer] = useState<MapOverlayLayer>(source)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') return
      const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (!focusableElements?.length) return

      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [onClose])

  const visibleEvents = activeLayer === 'families' ? [] : events
  const visibleFamilies = activeLayer === 'events' ? [] : families

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="expanded-map-heading"
      className="fixed inset-0 z-50 flex min-h-0 flex-col overflow-hidden bg-[var(--color-bg)] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    >
      <header className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto w-full max-w-[430px] px-4 py-3 sm:max-w-2xl sm:px-6 md:max-w-3xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1
                id="expanded-map-heading"
                className="text-base font-bold text-[var(--color-ink)]"
              >
                Kartta
              </h1>
              <p className="text-xs text-[var(--color-ink-muted)]">
                {activeLayer === 'all'
                  ? 'Suodatetut tapahtumat ja perheet'
                  : activeLayer === 'events'
                    ? 'Suodatetut tapahtumat'
                    : 'Suodatetut perheet'}
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="min-h-11 min-w-11 shrink-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-bold text-[var(--color-ink)] hover:bg-[var(--color-bg)]"
            >
              Sulje kartta
            </button>
          </div>
          <div role="group" aria-label="Karttataso" className="grid grid-cols-3 gap-2">
            {MAP_LAYERS.map((layer) => {
              const isActive = activeLayer === layer.id
              return (
                <button
                  key={layer.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setActiveLayer(layer.id)}
                  className={`min-h-11 min-w-0 rounded-full border px-2 text-xs font-bold transition-colors ${
                    isActive
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-bg)]'
                  }`}
                >
                  {layer.label}
                </button>
              )
            })}
          </div>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        <PksMapView
          events={visibleEvents}
          attendingIds={attendingIds}
          matchedFamilies={visibleFamilies}
          homeCoords={homeCoords}
          homeLabel={homeLabel}
          familyName={familyName}
          shareEventsWithMatches={shareEventsWithMatches}
          showCloseRelativesInMatches={showCloseRelativesInMatches}
          focusCoords={null}
          onResetBounds={onResetBounds}
        />
      </div>
    </div>
  )
}
