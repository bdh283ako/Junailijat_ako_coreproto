'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  AGE_GROUP_OPTIONS,
  AREA_COORDS,
  type AuthenticatedGoogleUser,
  type ChildItem,
  type UserProfileState,
} from '@shellproto/protoData'
import type { PendingEnrollmentIntent } from '@/hooks/useEnrollmentFlow'

interface FamilyEnrollmentModalProps {
  isOpen: boolean
  contextTitle: string | null
  currentUser: AuthenticatedGoogleUser | null
  initialProfile: UserProfileState
  pendingIntent: PendingEnrollmentIntent | null
  error: string | null
  onComplete: (profile: UserProfileState) => Promise<void>
  onCancel: () => void
}

const CITY_OPTIONS = ['Espoo', 'Helsinki', 'Vantaa', 'Kauniainen', 'Muu']
const AGE_GROUP_LABELS: Record<string, string> = {
  '0-3v': '0–3 v',
  '4-6v': '4–6 v',
  '7-12v': '7–12 v',
  '13+v': '13+ v',
}

function getCityChoice(city: string): string {
  return CITY_OPTIONS.includes(city) ? city : 'Muu'
}

function getChildren(profile: UserProfileState): ChildItem[] {
  const children = profile.children.slice(0, 4).map((child, index) => ({
    ...child,
    id: child.id || `child-${index + 1}`,
    group: AGE_GROUP_OPTIONS.includes(child.group) ? child.group : AGE_GROUP_OPTIONS[1],
  }))
  return children.length > 0
    ? children
    : [
        {
          id: 'child-1',
          ageLabel: AGE_GROUP_LABELS[AGE_GROUP_OPTIONS[1]],
          group: AGE_GROUP_OPTIONS[1],
        },
      ]
}

export function FamilyEnrollmentModal({
  isOpen,
  contextTitle,
  currentUser,
  initialProfile,
  pendingIntent,
  error,
  onComplete,
  onCancel,
}: FamilyEnrollmentModalProps) {
  const [parentDisplayName, setParentDisplayName] = useState('')
  const [cityChoice, setCityChoice] = useState('Espoo')
  const [customCity, setCustomCity] = useState('')
  const [children, setChildren] = useState<ChildItem[]>([])
  const [interestsText, setInterestsText] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const isSavingRef = useRef(isSaving)
  isSavingRef.current = isSaving
  const dialogRef = useRef<HTMLElement>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const city = initialProfile.homeCity.trim()
    setParentDisplayName(
      initialProfile.parentDisplayName.trim() ||
        currentUser?.displayName ||
        currentUser?.email.split('@')[0] ||
        '',
    )
    setCityChoice(getCityChoice(city))
    setCustomCity(getCityChoice(city) === 'Muu' ? city : '')
    setChildren(getChildren(initialProfile))
    setInterestsText(initialProfile.interests.join(', '))

    const previouslyFocused = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    firstFieldRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!isSavingRef.current) onCancel()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
        ),
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [currentUser, initialProfile, isOpen, onCancel])

  if (!isOpen) return null

  const addChild = () => {
    if (children.length >= 4) return
    setChildren((current) => [
      ...current,
      {
        id: `child-${Date.now()}-${current.length}`,
        ageLabel: AGE_GROUP_LABELS[AGE_GROUP_OPTIONS[1]],
        group: AGE_GROUP_OPTIONS[1],
      },
    ])
  }

  const updateChildGroup = (childId: string, group: string) => {
    setChildren((current) =>
      current.map((child) =>
        child.id === childId
          ? { ...child, group, ageLabel: AGE_GROUP_LABELS[group] ?? group }
          : child,
      ),
    )
  }

  const submitEnrollment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSaving) return
    setIsSaving(true)

    const selectedCity = cityChoice === 'Muu' ? customCity.trim() : cityChoice
    const selectedArea = Object.entries(AREA_COORDS).find(
      ([, metadata]) => metadata.city === selectedCity,
    )
    const interests = interestsText
      .split(/[,\n]/)
      .map((interest) => interest.trim())
      .filter(Boolean)

    try {
      await onComplete({
        ...initialProfile,
        parentDisplayName: parentDisplayName.trim(),
        homeCity: selectedCity,
        area: selectedArea?.[0] ?? initialProfile.area,
        homeCoords: selectedArea?.[1].coords ?? initialProfile.homeCoords,
        children,
        interests: interests.length > 0 ? interests : initialProfile.interests,
        onboardingCompleted: true,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const isEventIntent =
    pendingIntent?.type === 'join_event' || pendingIntent?.type === 'open_event_chat'
  const eventTitle = isEventIntent ? pendingIntent.eventTitle || pendingIntent.eventId : null
  const submitLabel =
    pendingIntent?.type === 'switch_tab'
      ? 'Tallenna perheprofiili'
      : 'Tallenna ja jatka tapahtumaan'

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/60 p-4">
      <section
        ref={dialogRef}
        aria-describedby="family-enrollment-description"
        aria-labelledby="family-enrollment-heading"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
        role="dialog"
      >
        <header className="mb-5">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Perhepiiri</p>
          <h2 id="family-enrollment-heading" className="mt-1 text-lg font-bold text-slate-900">
            Viimeistele perheprofiili ennen osallistumista
          </h2>
          {eventTitle && (
            <p className="mt-2 text-sm font-semibold text-slate-700">Tapahtuma: {eventTitle}</p>
          )}
          <p id="family-enrollment-description" className="mt-2 text-sm text-slate-600">
            {contextTitle
              ? `Profiilin viimeistely auttaa jatkamaan: ${contextTitle}.`
              : 'Tiedot auttavat löytämään sopivaa tekemistä ja muita perheitä.'}
          </p>
        </header>

        <form className="space-y-4" onSubmit={(event) => void submitEnrollment(event)}>
          <div>
            <label
              className="mb-1 block text-xs font-semibold text-slate-700"
              htmlFor="enrollment-parent-name"
            >
              Vanhemman / huoltajan kutsumanimi
            </label>
            <input
              ref={firstFieldRef}
              id="enrollment-parent-name"
              autoComplete="name"
              maxLength={80}
              onChange={(event) => setParentDisplayName(event.target.value)}
              required
              value={parentDisplayName}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
            {currentUser?.email && (
              <p className="mt-1 text-xs text-slate-500">Google-tili: {currentUser.email}</p>
            )}
          </div>

          <div>
            <label
              className="mb-1 block text-xs font-semibold text-slate-700"
              htmlFor="enrollment-city"
            >
              Kotikaupunki / alue
            </label>
            <select
              id="enrollment-city"
              onChange={(event) => setCityChoice(event.target.value)}
              required
              value={cityChoice}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              {CITY_OPTIONS.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            {cityChoice === 'Muu' && (
              <input
                aria-label="Muu kotikaupunki tai alue"
                autoComplete="address-level2"
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                maxLength={80}
                onChange={(event) => setCustomCity(event.target.value)}
                placeholder="Kirjoita kaupunki tai alue"
                required
                value={customCity}
              />
            )}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-slate-700">Lapset (1–4)</legend>
            {children.map((child, index) => (
              <div key={child.id} className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`enrollment-child-${child.id}`}>
                  Lapsen {index + 1} ikäryhmä
                </label>
                <select
                  id={`enrollment-child-${child.id}`}
                  onChange={(event) => updateChildGroup(child.id, event.target.value)}
                  required
                  value={child.group}
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                >
                  {AGE_GROUP_OPTIONS.map((group) => (
                    <option key={group} value={group}>
                      {AGE_GROUP_LABELS[group] ?? group}
                    </option>
                  ))}
                </select>
                <button
                  aria-label={`Poista lapsi ${index + 1}`}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={children.length <= 1 || isSaving}
                  onClick={() =>
                    setChildren((current) => current.filter((item) => item.id !== child.id))
                  }
                  type="button"
                >
                  Poista
                </button>
              </div>
            ))}
            <button
              className="rounded-lg border border-emerald-700 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={children.length >= 4 || isSaving}
              onClick={addChild}
              type="button"
            >
              Lisää lapsi
            </button>
          </fieldset>

          <div>
            <label
              className="mb-1 block text-xs font-semibold text-slate-700"
              htmlFor="enrollment-interests"
            >
              Lyhyt esittely tai kiinnostuksen kohteet (vapaaehtoinen)
            </label>
            <textarea
              id="enrollment-interests"
              maxLength={240}
              onChange={(event) => setInterestsText(event.target.value)}
              placeholder="Esim. puistot, retkeily ja lukeminen"
              rows={2}
              value={interestsText}
              className="w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {error && (
            <p
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
              role="alert"
            >
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse justify-end gap-2 border-t border-slate-100 pt-4 sm:flex-row">
            <button
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              disabled={isSaving}
              onClick={onCancel}
              type="button"
            >
              Peruuta
            </button>
            <button
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
              disabled={isSaving}
              type="submit"
            >
              {isSaving ? 'Tallennetaan...' : submitLabel}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
