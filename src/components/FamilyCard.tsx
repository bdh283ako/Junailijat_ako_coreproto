'use client'

import React, { useState } from 'react'

export interface FamilyProfile {
  id: string
  name: string
  location: string
  childrenAges: string
  interests: string[]
  bio: string
}

interface FamilyCardProps {
  currentFamilyId: string
  families: FamilyProfile[]
}

export default function FamilyCard({ currentFamilyId, families }: FamilyCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [matchBanner, setMatchBanner] = useState< string | null >(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentTarget = families[currentIndex]

  const handleAction = async (action: 'liked' | 'passed') => {
    if (!currentTarget || isSubmitting) return
    setIsSubmitting(true)
    setMatchBanner(null)

    try {
      const res = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromFamilyId: currentFamilyId,
          toFamilyId: currentTarget.id,
          action,
        }),
      })

      if (res.ok) {
        const result = await res.json()
        if (result.match) {
          setMatchBanner(`Uusi osuma! ${currentTarget.name} haluaa myös verkostoitua.`)
        }
      }
    } catch (err) {
      console.error('Yhteysvirhe mätsäyksessä:', err)
    } finally {
      setIsSubmitting(false)
      setCurrentIndex((prev) => prev + 1)
    }
  }

  if (!currentTarget) {
    return (
      <div className="p-8 text-center bg-gray-50 rounded-2xl border border-gray-200 max-w-md mx-auto">
        <h3 className="text-lg font-semibold text-gray-800">Ei enää uusia perheitä alueella</h3>
        <p className="text-sm text-gray-500 mt-2">Olet käynyt läpi kaikki ehdotukset.</p>
        <button
          onClick={() => setCurrentIndex(0)}
          className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm"
        >
          Aloita demokierros alusta
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto">
      {matchBanner && (
        <div className="mb-4 p-4 bg-emerald-100 border border-emerald-400 text-emerald-900 rounded-xl font-medium text-center">
          🎉 {matchBanner}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{currentTarget.name}</h2>
            <p className="text-sm text-gray-500">📍 {currentTarget.location}</p>
          </div>
          <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
            Lapset: {currentTarget.childrenAges}
          </span>
        </div>

        <p className="mt-4 text-gray-700 leading-relaxed">{currentTarget.bio}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {currentTarget.interests.map((interest) => (
            <span
              key={interest}
              className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-md"
            >
              #{interest}
            </span>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4">
          <button
            onClick={() => handleAction('passed')}
            disabled={isSubmitting}
            className="py-3 px-4 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-50"
          >
            Ohita
          </button>
          <button
            onClick={() => handleAction('liked')}
            disabled={isSubmitting}
            className="py-3 px-4 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            Verkostoidu
          </button>
        </div>
      </div>
    </div>
  )
}