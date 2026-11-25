'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FamilyProfile } from '@/hooks/useFamilyProfileSync'
import { isFamilyProfileComplete } from '@/hooks/useFamilyProfileSync'

export { isFamilyProfileComplete } from '@/hooks/useFamilyProfileSync'

export type PendingEnrollmentIntent =
  | { type: 'join_event'; eventId: string; eventTitle?: string }
  | { type: 'open_event_chat'; eventId: string; eventTitle?: string }
  | { type: 'switch_tab'; tab: 'families' | 'conversations' }

export interface EnrollmentFlowOptions {
  authStatus: 'loading' | 'authenticated' | 'unauthenticated'
  currentUser: { id: string } | null
  profile: FamilyProfile
  isProfileHydrated: boolean
  saveFamilyProfile: (payload: FamilyProfile) => Promise<FamilyProfile>
  startGoogleSignIn: () => Promise<void>
  onFulfillPendingIntent: (intent: PendingEnrollmentIntent) => void | Promise<void>
}

export const PENDING_INTENT_STORAGE_KEY = 'junailijat_pending_intent'

function isPendingEnrollmentIntent(value: unknown): value is PendingEnrollmentIntent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const intent = value as Record<string, unknown>
  if (
    (intent.type === 'join_event' || intent.type === 'open_event_chat') &&
    typeof intent.eventId === 'string' &&
    intent.eventId.trim().length > 0
  ) {
    return intent.eventTitle === undefined || typeof intent.eventTitle === 'string'
  }
  return (
    intent.type === 'switch_tab' && (intent.tab === 'families' || intent.tab === 'conversations')
  )
}

export function readPendingIntent(): PendingEnrollmentIntent | null {
  if (typeof window === 'undefined') return null

  let rawIntent: string | null
  try {
    rawIntent = window.sessionStorage.getItem(PENDING_INTENT_STORAGE_KEY)
  } catch {
    throw new Error('Tallennetun toiminnon lukeminen selaimesta epäonnistui.')
  }
  if (!rawIntent) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(rawIntent)
  } catch {
    clearPendingIntent()
    return null
  }
  if (isPendingEnrollmentIntent(parsed)) return parsed

  clearPendingIntent()
  return null
}

export function writePendingIntent(intent: PendingEnrollmentIntent): void {
  if (typeof window === 'undefined') return
  if (!isPendingEnrollmentIntent(intent)) {
    throw new Error('Tallennettava toiminto ei ole kelvollinen.')
  }

  try {
    window.sessionStorage.setItem(PENDING_INTENT_STORAGE_KEY, JSON.stringify(intent))
  } catch {
    throw new Error('Toimintoa ei voitu tallentaa selaimen istuntoon.')
  }
}

export function clearPendingIntent(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(PENDING_INTENT_STORAGE_KEY)
  } catch {
    throw new Error('Tallennetun toiminnon poistaminen epäonnistui.')
  }
}

export function useEnrollmentFlow({
  authStatus,
  currentUser,
  profile,
  isProfileHydrated,
  saveFamilyProfile,
  startGoogleSignIn,
  onFulfillPendingIntent,
}: EnrollmentFlowOptions) {
  const [pendingIntent, setPendingIntent] = useState<PendingEnrollmentIntent | null>(null)
  const [isEnrollmentModalOpen, setIsEnrollmentModalOpen] = useState(false)
  const [enrollmentContextTitle, setEnrollmentContextTitle] = useState<string | null>(null)
  const [enrollmentError, setEnrollmentError] = useState<string | null>(null)
  const pendingActionRef = useRef<(() => void | Promise<void>) | null>(null)
  const handledIntentRef = useRef<PendingEnrollmentIntent | null>(null)
  const shouldRedirectForPendingIntentRef = useRef(false)
  const intentHandlerRef = useRef(onFulfillPendingIntent)
  intentHandlerRef.current = onFulfillPendingIntent

  const runAction = useCallback(async (action: () => void | Promise<void>) => {
    try {
      await action()
    } catch (error) {
      setEnrollmentError(error instanceof Error ? error.message : 'Toimintoa ei voitu suorittaa.')
    }
  }, [])

  const requireEnrolledAction = useCallback(
    async (intent: PendingEnrollmentIntent, onReady: () => void | Promise<void>): Promise<void> => {
      setEnrollmentError(null)
      try {
        writePendingIntent(intent)
      } catch (error) {
        setEnrollmentError(error instanceof Error ? error.message : 'Toimintoa ei voitu tallentaa.')
        return
      }

      pendingActionRef.current = onReady
      setPendingIntent(intent)

      if (authStatus === 'loading') {
        shouldRedirectForPendingIntentRef.current = true
        return
      }

      shouldRedirectForPendingIntentRef.current = false
      if (authStatus !== 'authenticated' || !currentUser) {
        pendingActionRef.current = null
        await runAction(startGoogleSignIn)
        return
      }

      if (!isProfileHydrated) return
      if (!isFamilyProfileComplete(profile)) {
        handledIntentRef.current = intent
        setEnrollmentContextTitle(intent.type === 'switch_tab' ? null : (intent.eventTitle ?? null))
        setIsEnrollmentModalOpen(true)
        return
      }

      handledIntentRef.current = intent
      pendingActionRef.current = null
      setPendingIntent(null)
      try {
        clearPendingIntent()
      } catch (error) {
        setEnrollmentError(
          error instanceof Error ? error.message : 'Tallennetun toiminnon poistaminen epäonnistui.',
        )
      }
      await runAction(onReady)
    },
    [authStatus, currentUser, isProfileHydrated, profile, runAction, startGoogleSignIn],
  )

  useEffect(() => {
    if (authStatus === 'authenticated') {
      shouldRedirectForPendingIntentRef.current = false
      return
    }
    if (authStatus !== 'unauthenticated' || !shouldRedirectForPendingIntentRef.current) return

    shouldRedirectForPendingIntentRef.current = false
    pendingActionRef.current = null
    void runAction(startGoogleSignIn)
  }, [authStatus, runAction, startGoogleSignIn])

  useEffect(() => {
    if (authStatus !== 'authenticated' || !currentUser || !isProfileHydrated) return

    let intent = pendingIntent
    if (!intent) {
      try {
        intent = readPendingIntent()
        if (intent) clearPendingIntent()
      } catch (error) {
        setEnrollmentError(
          error instanceof Error
            ? error.message
            : 'Tallennetun toiminnon palauttaminen epäonnistui.',
        )
        return
      }
      if (!intent) return
      pendingActionRef.current = null
      setPendingIntent(intent)
    }

    if (handledIntentRef.current === intent) return
    handledIntentRef.current = intent

    if (!isFamilyProfileComplete(profile)) {
      setEnrollmentContextTitle(intent.type === 'switch_tab' ? null : (intent.eventTitle ?? null))
      setIsEnrollmentModalOpen(true)
      return
    }

    const pendingAction = pendingActionRef.current
    pendingActionRef.current = null
    setPendingIntent(null)
    void runAction(() => (pendingAction ? pendingAction() : intentHandlerRef.current(intent)))
  }, [authStatus, currentUser, isProfileHydrated, pendingIntent, profile, runAction])

  const completeEnrollment = useCallback(
    async (profilePayload: FamilyProfile): Promise<void> => {
      const completedProfile: FamilyProfile = {
        ...profilePayload,
        familyName: profilePayload.familyName.trim(),
        parentDisplayName: profilePayload.parentDisplayName.trim(),
        homeCity: profilePayload.homeCity.trim(),
        onboardingCompleted: true,
      }
      if (!isFamilyProfileComplete(completedProfile)) {
        setEnrollmentError(
          'Täytä perheen nimi, kutsumanimi, kotikaupunki ja lisää lapsen ikäryhmä.',
        )
        return
      }

      setEnrollmentError(null)
      let savedProfile: FamilyProfile
      try {
        savedProfile = await saveFamilyProfile({
          ...completedProfile,
          onboardingCompleted: true,
        })
      } catch {
        setEnrollmentError('Perheprofiilin tallennus epäonnistui. Yritä uudelleen.')
        return
      }
      if (!isFamilyProfileComplete(savedProfile)) {
        setEnrollmentError('Tallennettu perheprofiili ei ole vielä valmis.')
        return
      }

      const intent = pendingIntent
      const pendingAction = pendingActionRef.current
      pendingActionRef.current = null
      setIsEnrollmentModalOpen(false)
      setPendingIntent(null)
      handledIntentRef.current = intent
      try {
        clearPendingIntent()
      } catch (error) {
        setEnrollmentError(
          error instanceof Error ? error.message : 'Tallennetun toiminnon poistaminen epäonnistui.',
        )
      }

      if (intent) {
        await runAction(() => (pendingAction ? pendingAction() : intentHandlerRef.current(intent)))
      }
    },
    [pendingIntent, runAction, saveFamilyProfile],
  )

  const cancelEnrollment = useCallback(() => {
    setIsEnrollmentModalOpen(false)
    setPendingIntent(null)
    pendingActionRef.current = null
    handledIntentRef.current = null
    try {
      clearPendingIntent()
    } catch (error) {
      setEnrollmentError(
        error instanceof Error ? error.message : 'Tallennetun toiminnon poistaminen epäonnistui.',
      )
    }
  }, [])

  return {
    pendingIntent,
    isEnrollmentModalOpen,
    enrollmentContextTitle,
    enrollmentError,
    setEnrollmentError,
    requireEnrolledAction,
    completeEnrollment,
    cancelEnrollment,
  }
}
