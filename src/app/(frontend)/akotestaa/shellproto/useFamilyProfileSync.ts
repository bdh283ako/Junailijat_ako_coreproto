'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import {
  AGE_GROUP_OPTIONS,
  BASE_DEFAULT_PROFILE,
  buildInitialProfileForGoogleUser,
  DbCommitFeedEntry,
  DbSyncStatus,
  INITIAL_ATTENDING_IDS,
  NERD_DB_QUIPS,
  normalizeProfile,
  nowClock,
} from './protoData'
import type { AuthenticatedGoogleUser, UserProfileState } from './protoData'

export type FamilyProfile = UserProfileState

export interface UseFamilyProfileSyncOptions {
  currentUser: AuthenticatedGoogleUser | null
}

export interface FamilyProfileSyncState {
  profile: UserProfileState
  setProfile: Dispatch<SetStateAction<UserProfileState>>
  isHydrated: boolean
  setIsHydrated: Dispatch<SetStateAction<boolean>>
  dbSyncStatus: DbSyncStatus
  setDbSyncStatus: Dispatch<SetStateAction<DbSyncStatus>>
  mongoInstanceLabel: string
  setMongoInstanceLabel: Dispatch<SetStateAction<string>>
  mongoUpdatedAt: string
  setMongoUpdatedAt: Dispatch<SetStateAction<string>>
  mongoRevision: number
  setMongoRevision: Dispatch<SetStateAction<number>>
  dbFeedLog: DbCommitFeedEntry[]
  setDbFeedLog: Dispatch<SetStateAction<DbCommitFeedEntry[]>>
  profileSavedToast: boolean
  setProfileSavedToast: Dispatch<SetStateAction<boolean>>
  attendingIds: string[]
  setAttendingIds: Dispatch<SetStateAction<string[]>>
  dismissedIds: string[]
  setDismissedIds: Dispatch<SetStateAction<string[]>>
  saveProfileFeedback: (profileToSave?: UserProfileState) => Promise<boolean>
  saveFamilyProfile: (payload: FamilyProfile) => Promise<FamilyProfile>
  resetTransientData: () => void
}

interface FamilyProfileApiResponse {
  document?: {
    instanceId?: string
    updatedAt?: string
    profile?: unknown
  } | null
  instanceId?: string
  updatedAt?: string
}

export function isFamilyProfileComplete(profile: FamilyProfile | null | undefined): boolean {
  return Boolean(
    profile &&
    profile.onboardingCompleted &&
    profile.familyName.trim() &&
    profile.parentDisplayName.trim() &&
    profile.homeCity.trim() &&
    profile.area.trim() &&
    profile.children.some(
      (child) => child.ageLabel.trim() && AGE_GROUP_OPTIONS.includes(child.group),
    ),
  )
}

export function useFamilyProfileSync({
  currentUser,
}: UseFamilyProfileSyncOptions): FamilyProfileSyncState {
  const [profile, setProfile] = useState<UserProfileState>(BASE_DEFAULT_PROFILE)
  const [isHydrated, setIsHydrated] = useState(false)
  const [dbSyncStatus, setDbSyncStatus] = useState<DbSyncStatus>('idle')
  const [mongoInstanceLabel, setMongoInstanceLabel] = useState('')
  const [mongoUpdatedAt, setMongoUpdatedAt] = useState('')
  const [mongoRevision, setMongoRevision] = useState(0)
  const [dbFeedLog, setDbFeedLog] = useState<DbCommitFeedEntry[]>([])
  const [profileSavedToast, setProfileSavedToast] = useState(false)
  const [attendingIds, setAttendingIds] = useState<string[]>(INITIAL_ATTENDING_IDS)
  const [dismissedIds, setDismissedIds] = useState<string[]>([])

  const skipNextDbSaveRef = useRef(true)
  const instanceLabelRef = useRef('')
  const revisionRef = useRef(0)
  const lastQuipIdxRef = useRef(-1)
  const savedToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    instanceLabelRef.current = mongoInstanceLabel
  }, [mongoInstanceLabel])

  useEffect(() => {
    revisionRef.current = mongoRevision
  }, [mongoRevision])

  const pickRandomNerdQuip = useCallback((): string => {
    if (NERD_DB_QUIPS.length === 0) return 'COMMITTED -> users.familyProfile'
    let idx = Math.floor(Math.random() * NERD_DB_QUIPS.length)
    if (NERD_DB_QUIPS.length > 1 && idx === lastQuipIdxRef.current) {
      idx = (idx + 1) % NERD_DB_QUIPS.length
    }
    lastQuipIdxRef.current = idx
    return NERD_DB_QUIPS[idx]
  }, [])

  const pushDbFeedEntry = useCallback(
    (
      statusCode: string,
      opLabel: string,
      docKey: string,
      instanceName: string,
      rev: number,
      latencyMs?: number,
    ) => {
      const clock = nowClock()
      const latencySuffix = typeof latencyMs === 'number' ? ` (${latencyMs}ms)` : ''
      const entry: DbCommitFeedEntry = {
        id: `db-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        statusCode,
        terminalLine: `[${statusCode} ${opLabel}] ${docKey} -> PostgreSQL/${instanceName}${latencySuffix}`,
        diffStamp: `Δ persisted @ ${clock} • rev #${rev} • COMMITTED -> users.familyProfile (v${rev})`,
        quip: pickRandomNerdQuip(),
        revision: rev,
      }
      setDbFeedLog((prev) => [entry, ...prev.slice(0, 49)])
    },
    [pickRandomNerdQuip],
  )

  useEffect(() => {
    return () => {
      if (savedToastTimerRef.current) clearTimeout(savedToastTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!currentUser) return
    let cancelled = false
    skipNextDbSaveRef.current = true

    const hydrateForGoogleUser = async () => {
      const userId = currentUser.id
      const docKey = `family-${userId}`
      const baseDefault = buildInitialProfileForGoogleUser(currentUser)
      setAttendingIds(INITIAL_ATTENDING_IDS)
      setDismissedIds([])

      const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
      try {
        const res = await fetch(`/api/family-profile?userId=${encodeURIComponent(userId)}`, {
          cache: 'no-store',
        })
        if (res.ok && !cancelled) {
          const data = (await res.json()) as FamilyProfileApiResponse
          const inst = data?.document?.instanceId || data?.instanceId || 'default-instance'
          setMongoInstanceLabel(inst)
          if (data?.document?.updatedAt) setMongoUpdatedAt(data.document.updatedAt)

          if (data?.document?.profile) {
            const loaded = normalizeProfile(data.document.profile, baseDefault)
            setProfile(loaded)
            const ms = Math.max(
              1,
              Math.round(
                (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0,
              ),
            )
            setMongoRevision(1)
            pushDbFeedEntry('200', 'HYDRATED', docKey, inst, 1, ms)
          } else {
            setProfile(baseDefault)
            const initRes = await fetch('/api/family-profile', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, profile: baseDefault }),
            })
            if (initRes.ok) {
              const initData = (await initRes.json()) as FamilyProfileApiResponse
              const initInst = initData?.document?.instanceId || initData?.instanceId || inst
              setMongoInstanceLabel(initInst)
              if (initData?.document?.updatedAt) setMongoUpdatedAt(initData.document.updatedAt)
              const ms = Math.max(
                1,
                Math.round(
                  (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0,
                ),
              )
              setMongoRevision(1)
              pushDbFeedEntry('201', 'CREATED', docKey, initInst, 1, ms)
            }
          }
        }
      } catch {
        if (!cancelled) {
          setProfile(baseDefault)
          setDbSyncStatus('error')
          pushDbFeedEntry('503', 'STORE_OFFLINE', docKey, 'postgresql', 0)
        }
      } finally {
        if (!cancelled) setIsHydrated(true)
      }
    }

    void hydrateForGoogleUser()
    return () => {
      cancelled = true
    }
  }, [currentUser, pushDbFeedEntry])

  useEffect(() => {
    if (!isHydrated || !currentUser) return
    if (skipNextDbSaveRef.current) {
      skipNextDbSaveRef.current = false
      return
    }

    let cancelled = false
    const userId = currentUser.id
    const docKey = `family-${userId}`
    const timer = setTimeout(async () => {
      setDbSyncStatus('saving')
      const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
      try {
        const res = await fetch('/api/family-profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, profile }),
        })
        if (!cancelled) {
          const ms = Math.max(
            1,
            Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0),
          )
          if (res.ok) {
            const data = (await res.json()) as FamilyProfileApiResponse
            const inst =
              data?.document?.instanceId ||
              data?.instanceId ||
              instanceLabelRef.current ||
              'instance'
            const nextRev = revisionRef.current + 1
            revisionRef.current = nextRev
            instanceLabelRef.current = inst
            setMongoInstanceLabel(inst)
            if (data?.document?.updatedAt) setMongoUpdatedAt(data.document.updatedAt)
            setMongoRevision(nextRev)
            pushDbFeedEntry('201', 'UPSERT_OK', docKey, inst, nextRev, ms)
            setDbSyncStatus('saved')
          } else {
            setDbSyncStatus('error')
            pushDbFeedEntry(
              '500',
              'UPSERT_FAIL',
              docKey,
              instanceLabelRef.current || 'instance',
              revisionRef.current,
              ms,
            )
          }
        }
      } catch {
        if (!cancelled) {
          setDbSyncStatus('error')
          pushDbFeedEntry(
            '503',
            'IO_ERROR',
            docKey,
            instanceLabelRef.current || 'instance',
            revisionRef.current,
          )
        }
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [isHydrated, currentUser, profile, pushDbFeedEntry])

  const saveProfileFeedback = useCallback(
    async (profileToSave = profile) => {
      if (!currentUser) return false
      const userId = currentUser.id
      const docKey = `family-${userId}`
      setDbSyncStatus('saving')
      const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
      try {
        const res = await fetch('/api/family-profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, profile: profileToSave }),
        })
        const ms = Math.max(
          1,
          Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0),
        )
        if (res.ok) {
          const data = (await res.json()) as FamilyProfileApiResponse
          const inst =
            data?.document?.instanceId || data?.instanceId || instanceLabelRef.current || 'instance'
          const nextRev = revisionRef.current + 1
          revisionRef.current = nextRev
          instanceLabelRef.current = inst
          setMongoInstanceLabel(inst)
          if (data?.document?.updatedAt) setMongoUpdatedAt(data.document.updatedAt)
          setMongoRevision(nextRev)
          pushDbFeedEntry('201', 'MANUAL_FLUSH', docKey, inst, nextRev, ms)
          setDbSyncStatus('saved')
          if (profileToSave !== profile) skipNextDbSaveRef.current = true
        } else {
          setDbSyncStatus('error')
          return false
        }
      } catch {
        setDbSyncStatus('error')
        return false
      }
      if (savedToastTimerRef.current) clearTimeout(savedToastTimerRef.current)
      setProfileSavedToast(true)
      savedToastTimerRef.current = setTimeout(() => setProfileSavedToast(false), 2000)
      return true
    },
    [currentUser, profile, pushDbFeedEntry],
  )

  const saveFamilyProfile = useCallback(
    async (payload: FamilyProfile): Promise<FamilyProfile> => {
      if (!currentUser) {
        throw new Error('Perheprofiilin tallentaminen edellyttää kirjautumista.')
      }

      const nextProfile = normalizeProfile(payload, profile)
      const userId = currentUser.id
      const docKey = `family-${userId}`
      skipNextDbSaveRef.current = true
      setProfile(nextProfile)
      setDbSyncStatus('saving')
      const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()

      let response: Response
      try {
        response = await fetch('/api/family-profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, profile: nextProfile }),
        })
      } catch (error) {
        setDbSyncStatus('error')
        pushDbFeedEntry(
          '503',
          'IO_ERROR',
          docKey,
          instanceLabelRef.current || 'instance',
          revisionRef.current,
        )
        throw error instanceof Error
          ? error
          : new Error('Perheprofiilin tallennus epäonnistui yhteysvirheen vuoksi.')
      }

      const ms = Math.max(
        1,
        Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0),
      )
      if (!response.ok) {
        setDbSyncStatus('error')
        pushDbFeedEntry(
          '500',
          'UPSERT_FAIL',
          docKey,
          instanceLabelRef.current || 'instance',
          revisionRef.current,
          ms,
        )
        throw new Error(`Perheprofiilin tallennus epäonnistui (${response.status}).`)
      }

      let data: FamilyProfileApiResponse
      try {
        data = (await response.json()) as FamilyProfileApiResponse
      } catch (error) {
        setDbSyncStatus('error')
        pushDbFeedEntry(
          '500',
          'UPSERT_FAIL',
          docKey,
          instanceLabelRef.current || 'instance',
          revisionRef.current,
          ms,
        )
        throw error instanceof Error
          ? error
          : new Error('Tallennetun perheprofiilin lukeminen epäonnistui.')
      }

      const instanceName =
        data?.document?.instanceId || data?.instanceId || instanceLabelRef.current || 'instance'
      const savedProfile = normalizeProfile(data?.document?.profile ?? nextProfile, nextProfile)
      const nextRevision = revisionRef.current + 1
      revisionRef.current = nextRevision
      instanceLabelRef.current = instanceName
      skipNextDbSaveRef.current = true
      setProfile(savedProfile)
      setMongoInstanceLabel(instanceName)
      if (data?.document?.updatedAt) setMongoUpdatedAt(data.document.updatedAt)
      setMongoRevision(nextRevision)
      setDbSyncStatus('saved')
      pushDbFeedEntry('201', 'UPSERT_OK', docKey, instanceName, nextRevision, ms)

      if (savedToastTimerRef.current) clearTimeout(savedToastTimerRef.current)
      setProfileSavedToast(true)
      savedToastTimerRef.current = setTimeout(() => setProfileSavedToast(false), 2000)

      return savedProfile
    },
    [currentUser, profile, pushDbFeedEntry],
  )

  const resetTransientData = useCallback(() => {
    setDismissedIds([])
    setAttendingIds(INITIAL_ATTENDING_IDS)
  }, [])

  return {
    profile,
    setProfile,
    isHydrated,
    setIsHydrated,
    dbSyncStatus,
    setDbSyncStatus,
    mongoInstanceLabel,
    setMongoInstanceLabel,
    mongoUpdatedAt,
    setMongoUpdatedAt,
    mongoRevision,
    setMongoRevision,
    dbFeedLog,
    setDbFeedLog,
    profileSavedToast,
    setProfileSavedToast,
    attendingIds,
    setAttendingIds,
    dismissedIds,
    setDismissedIds,
    saveProfileFeedback,
    saveFamilyProfile,
    resetTransientData,
  }
}
