'use client'

import { useRef, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react'

interface MapPeekProps {
  label: string
  itemCount: number
  onExpand: () => void
  children: ReactNode
}

export function MapPeek({ label, itemCount, onExpand, children }: MapPeekProps) {
  const pinchStartDistanceRef = useRef<number | null>(null)

  const getTouchDistance = (event: ReactTouchEvent<HTMLElement>) => {
    if (event.touches.length !== 2) return null
    const first = event.touches[0]
    const second = event.touches[1]
    if (!first || !second) return null
    return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY)
  }

  const handleTouchStart = (event: ReactTouchEvent<HTMLElement>) => {
    pinchStartDistanceRef.current = getTouchDistance(event)
  }

  const handleTouchMove = (event: ReactTouchEvent<HTMLElement>) => {
    const startDistance = pinchStartDistanceRef.current
    const currentDistance = getTouchDistance(event)
    if (startDistance === null || currentDistance === null) return

    if (currentDistance - startDistance >= Math.max(24, startDistance * 0.18)) {
      pinchStartDistanceRef.current = null
      onExpand()
    }
  }

  const resetPinch = () => {
    pinchStartDistanceRef.current = null
  }

  return (
    <section
      aria-label={`${label}, ${itemCount} kohdetta`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={resetPinch}
      onTouchCancel={resetPinch}
      className="relative mx-auto my-3 h-32 min-w-0 w-full touch-pan-y overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] sm:my-4 sm:h-36"
    >
      <div
        aria-hidden="true"
        inert
        className="pointer-events-none absolute inset-0 z-0 isolate [&_.leaflet-control-container]:hidden"
      >
        {children}
      </div>
      <span className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/95 px-2.5 py-1 text-[11px] font-semibold text-[var(--color-ink)]">
        {itemCount} kohdetta
      </span>
      <span className="pointer-events-none absolute bottom-2 right-2 z-10 rounded bg-[var(--color-surface)]/95 px-1.5 py-0.5 text-[9px] text-[var(--color-ink)]">
        © Esri / OSM
      </span>
      <button
        type="button"
        onClick={onExpand}
        className="absolute right-2 top-2 z-10 min-h-11 min-w-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 px-3 text-xs font-bold text-[var(--color-ink)] shadow-sm hover:bg-[var(--color-bg)]"
      >
        Laajenna kartta
      </button>
    </section>
  )
}
