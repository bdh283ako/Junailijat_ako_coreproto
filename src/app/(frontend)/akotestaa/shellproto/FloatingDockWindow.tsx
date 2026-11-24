'use client'

import React, { useRef } from 'react'
import type { FloatingPos } from './protoData'

export function FloatingDockWindow({
  title,
  badge,
  pos,
  onPosChange,
  onClose,
  headerToneClass,
  borderToneClass,
  children,
}: {
  title: string
  badge: string
  pos: FloatingPos | null
  onPosChange: (next: FloatingPos) => void
  onClose: () => void
  headerToneClass: string
  borderToneClass: string
  children: React.ReactNode
}) {
  const dragStateRef = useRef<{
    startX: number
    startY: number
    origX: number
    origY: number
    boxW: number
    boxH: number
  } | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    const rect = cardRef.current?.getBoundingClientRect()
    const currentX = pos ? pos.x : rect ? rect.left : 16
    const currentY = pos ? pos.y : rect ? rect.top : 16
    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: currentX,
      origY: currentY,
      boxW: rect ? rect.width : 300,
      boxH: rect ? rect.height : 180,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragStateRef.current
    if (!d || typeof window === 'undefined') return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    const maxX = Math.max(8, window.innerWidth - d.boxW - 8)
    const maxY = Math.max(8, window.innerHeight - d.boxH - 8)
    onPosChange({
      x: Math.min(maxX, Math.max(8, d.origX + dx)),
      y: Math.min(maxY, Math.max(8, d.origY + dy)),
    })
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current) {
      dragStateRef.current = null
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // Ohitetaan jos capture ei ollut aktiivinen
      }
    }
  }

  return (
    <div
      ref={cardRef}
      style={
        pos
          ? { position: 'fixed', left: `${pos.x}px`, top: `${pos.y}px`, right: 'auto' }
          : undefined
      }
      className={`fixed right-3 z-40 w-[290px] sm:w-[320px] rounded-2xl shadow-2xl border ${borderToneClass} bg-zinc-950/95 text-zinc-100 overflow-hidden backdrop-blur-sm`}
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`${headerToneClass} px-3 py-2 flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing select-none touch-none border-b border-white/10`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] opacity-75">⠿</span>
          <span className="font-mono text-[10px] font-bold tracking-wider truncate">{title}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-black/35 text-zinc-200">
            {badge}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-1.5 py-0.5 rounded bg-black/35 hover:bg-black/60 text-[10px] font-bold"
            aria-label="Piilota paneeli"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="p-3 space-y-2">{children}</div>
    </div>
  )
}
