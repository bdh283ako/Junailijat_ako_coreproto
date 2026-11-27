'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CommunityHubPanel, type HubSection } from './CommunityHubPanel'
import { DebugMonitorPanels, type FeedSourcesMeta } from './DebugMonitorPanels'
import { EventChatWindow } from './EventChatWindow'
import { ExpandedMapOverlay, type MapOverlaySource } from './ExpandedMapOverlay'
import { EventsTabPanel, type EventAgeQuickFilter } from './EventsTabPanel'
import { MapPeek } from './MapPeek'
import {
  FamiliesTabPanel,
  FamilyHomeCarousel,
  type FamilySubTab,
} from './FamiliesTabPanel'
import { FamilyMembersPanel } from './FamilyMembersPanel'
import { DEFAULT_PKS_COORDS, resolveCoordsTuple, resolveEventsForMap } from './mapGeoResolver'
import { PksMapView } from './PksMapView'
import { ProfileSettingsPanel } from './ProfileSettingsPanel'
import { StoreInspectorPanel } from './StoreInspectorPanel'
import { useEventsFeed, type EventFeedStatus } from './useEventsFeed'
import { useEventChatAndParticipations } from './hooks/useEventChatAndParticipations'
import { useFamilyProfileSync } from './useFamilyProfileSync'
import { useGoogleSession } from './useGoogleSession'
import { FamilyEnrollmentModal } from '@/components/FamilyEnrollmentModal'
import {
  isFamilyProfileComplete,
  useEnrollmentFlow,
  type PendingEnrollmentIntent,
} from '@/hooks/useEnrollmentFlow'
import {
  buildInviteUrl,
  calcDistanceKm,
  calcFamilyMatch,
  ChildItem,
  CloseRelativeItem,
  CoParentItem,
  DemoSelectionEvent,
  FamilyProfile,
  FloatingPos,
  generateInviteCode,
  inferAgeGroupsFromChildren,
  INITIAL_EVENTS,
  nowClock,
  ProfileSubView,
  TabKey,
  UserProfileState,
} from './protoData'

interface ApiFamilyProfile {
  id: string
  familyName: string
  area: string
  childrenSummary?: string
  bio?: string
  updatedAt: string
  likedByMe: boolean
  likedMe: boolean
  isMutualMatch: boolean
  passedByMe: boolean
  matchChannelId: string
}

type ScoredApiFamily = FamilyProfile &
  ApiFamilyProfile & {
    distanceKm: number
    match: ReturnType<typeof calcFamilyMatch>
  }

const COARSE_CITY_COORDS: Record<string, [number, number]> = {
  Helsinki: [60.1699, 24.9384],
  Espoo: [60.2055, 24.6559],
  Vantaa: [60.2934, 25.0378],
  Kauniainen: [60.212, 24.727],
}

function parseApiFamily(value: unknown): ApiFamilyProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Perheprofiilin vastaus ei kelpaa.')
  }
  const record = value as Record<string, unknown>
  if (
    typeof record.id !== 'string' ||
    typeof record.familyName !== 'string' ||
    typeof record.area !== 'string' ||
    typeof record.updatedAt !== 'string' ||
    typeof record.likedByMe !== 'boolean' ||
    typeof record.likedMe !== 'boolean' ||
    typeof record.isMutualMatch !== 'boolean' ||
    typeof record.passedByMe !== 'boolean' ||
    typeof record.matchChannelId !== 'string' ||
    (record.childrenSummary !== undefined && typeof record.childrenSummary !== 'string') ||
    (record.bio !== undefined && typeof record.bio !== 'string')
  ) {
    throw new Error('Perheprofiilin vastaus sisältää virheellisiä kenttiä.')
  }
  return {
    id: record.id,
    familyName: record.familyName,
    area: record.area,
    updatedAt: record.updatedAt,
    likedByMe: record.likedByMe,
    likedMe: record.likedMe,
    isMutualMatch: record.isMutualMatch,
    passedByMe: record.passedByMe,
    matchChannelId: record.matchChannelId,
    ...(typeof record.childrenSummary === 'string'
      ? { childrenSummary: record.childrenSummary }
      : {}),
    ...(typeof record.bio === 'string' ? { bio: record.bio } : {}),
  }
}

function areApiFamilyProfilesEqual(
  current: ApiFamilyProfile[],
  next: ApiFamilyProfile[],
): boolean {
  return (
    current.length === next.length &&
    current.every((family, index) => {
      const candidate = next[index]
      return (
        family.id === candidate.id &&
        family.familyName === candidate.familyName &&
        family.area === candidate.area &&
        family.childrenSummary === candidate.childrenSummary &&
        family.bio === candidate.bio &&
        family.updatedAt === candidate.updatedAt &&
        family.likedByMe === candidate.likedByMe &&
        family.likedMe === candidate.likedMe &&
        family.isMutualMatch === candidate.isMutualMatch &&
        family.passedByMe === candidate.passedByMe &&
        family.matchChannelId === candidate.matchChannelId
      )
    })
  )
}

function getCoarseCity(area: string, fallbackCity: string): string {
  const normalized = area.toLowerCase()
  if (normalized.includes('helsinki')) return 'Helsinki'
  if (normalized.includes('espoo')) return 'Espoo'
  if (normalized.includes('vantaa')) return 'Vantaa'
  if (normalized.includes('kauniainen')) return 'Kauniainen'
  return fallbackCity in COARSE_CITY_COORDS ? fallbackCity : 'Helsinki'
}

function getAgeGroups(summary?: string): string[] {
  const normalized = (summary ?? '')
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, '')
  return ['0-3v', '4-6v', '7-12v', '13+v'].filter((group) => {
    const digits = group.replace('v', '')
    return normalized.includes(group) || normalized.includes(digits)
  })
}

function matchesEventAgeFilter(ageGroup: string | undefined, filter: EventAgeQuickFilter): boolean {
  if (filter === 'all') return true
  const normalized = (ageGroup || '').toLowerCase().trim()

  if (
    !normalized ||
    normalized.includes('kaikki ikäryhmät') ||
    normalized.includes('koko perhe') ||
    normalized.includes('kaikenikäis') ||
    normalized.includes('all ages')
  ) {
    return filter === 'all-ages'
  }

  if (filter === 'all-ages') return false

  const [bucketMin, bucketMax] = filter === '0-3' ? [0, 3] : filter === '4-6' ? [4, 6] : [7, 12]

  const rangeMatch = normalized.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})/)
  if (rangeMatch) {
    return Number(rangeMatch[1]) <= bucketMax && Number(rangeMatch[2]) >= bucketMin
  }

  const underMatch = normalized.match(/alle\s+(\d{1,2})/)
  if (underMatch) {
    return Number(underMatch[1]) >= bucketMin
  }

  const plusMatch = normalized.match(/(\d{1,2})\s*\+/)
  if (plusMatch) {
    return Number(plusMatch[1]) <= bucketMax
  }

  return false
}

function getSourceStatusBadge(status: EventFeedStatus, sources: FeedSourcesMeta | null) {
  if (status === 'loading') {
    return {
      label: 'Ladataan tapahtumalähteitä...',
      className: 'bg-slate-100 text-slate-700 border-slate-200',
      dotClass: 'bg-slate-400 animate-pulse',
    }
  }

  if (status === 'fallback' || !sources) {
    return {
      label: 'Demo-varadata (0 live-lähdettä)',
      className: 'bg-rose-50 text-rose-700 border-rose-200',
      dotClass: 'bg-rose-500',
    }
  }

  const activeSourceCount = [sources.karoCount > 0, sources.linkedEventsCount > 0].filter(
    Boolean,
  ).length

  const summaryParts = [
    sources.linkedEventsCount > 0
      ? `Linked Events PKS (${sources.linkedEventsCount})`
      : 'Linked Events PKS (0)',
    sources.karoCount > 0 ? `EventPulse (${sources.karoCount})` : 'EventPulse (0)',
  ]

  if (activeSourceCount >= 2) {
    return {
      label: `Live-lähteet aktiivisia: ${summaryParts.join(' + ')}`,
      className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      dotClass: 'bg-emerald-500',
    }
  }

  if (activeSourceCount === 1) {
    return {
      label: `Osittainen syöte (1/2): ${summaryParts.join(' • ')}`,
      className: 'bg-amber-50 text-amber-800 border-amber-200',
      dotClass: 'bg-amber-500',
    }
  }

  return {
    label: 'Demo-varadata (0 tapahtumaa lähteistä)',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
    dotClass: 'bg-amber-500',
  }
}

export default function PerheAppPrototypePage() {
  const [activeTab, setActiveTab] = useState<TabKey>('events')
  const [mapOverlaySource, setMapOverlaySource] = useState<MapOverlaySource | null>(null)
  const [profileSubView, setProfileSubView] = useState<ProfileSubView>('main')
  const [familySubTab, setFamilySubTab] = useState<FamilySubTab>('discover')

  const [hubInitialSection, setHubInitialSection] = useState<HubSection>('board')
  const [hubEventId, setHubEventId] = useState<string | null>(null)
  const [hubDirectTargetId, setHubDirectTargetId] = useState<string | null>(null)
  const [hubMountKey, setHubMountKey] = useState<number>(0)
  const [chatLastReadAt, setChatLastReadAt] = useState<Record<string, string>>({})
  const chatLastReadAtRef = useRef<Record<string, string>>({})
  const [chatReadError, setChatReadError] = useState<string | null>(null)

  const [eventAgeFilter, setEventAgeFilter] = useState<EventAgeQuickFilter>('all')
  const [eventSearchQuery, setEventSearchQuery] = useState<string>('')
  const [ignoreDefaultPresetTemp, setIgnoreDefaultPresetTemp] = useState(false)

  const [inviteParentName, setInviteParentName] = useState('')
  const [inviteParentEmail, setInviteParentEmail] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteBanner, setInviteBanner] = useState<string | null>(null)
  const [previewInviteId, setPreviewInviteId] = useState<string | null>(null)
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null)

  const [newChildAge, setNewChildAge] = useState('')
  const [newChildGroup, setNewChildGroup] = useState('4-6v')
  const [childError, setChildError] = useState('')
  const [newRelativeRole, setNewRelativeRole] = useState('Isovanhempi')
  const [newRelativeNote, setNewRelativeNote] = useState('')

  const [transientResetToast, setTransientResetToast] = useState(false)

  const [showDemoMonitor, setShowDemoMonitor] = useState(true)
  const [showNerdDbFloat, setShowNerdDbFloat] = useState(true)
  const [demoFloatPos, setDemoFloatPos] = useState<FloatingPos | null>(null)
  const [dbFloatPos, setDbFloatPos] = useState<FloatingPos | null>(null)
  const [chatFloatPos, setChatFloatPos] = useState<FloatingPos | null>(null)

  const [demoSelections, setDemoSelections] = useState<DemoSelectionEvent[]>([
    { id: 'init-1', time: '--.--.--', action: 'OAUTH_CHECK', detail: 'checking /api/auth/session' },
  ])

  const [editingChildId, setEditingChildId] = useState<string | null>(null)
  const [editChildAge, setEditChildAge] = useState('')
  const [editChildGroup, setEditChildGroup] = useState('4-6v')

  const [editingRelativeId, setEditingRelativeId] = useState<string | null>(null)
  const [editRelativeRole, setEditRelativeRole] = useState('Isovanhempi')
  const [editRelativeNote, setEditRelativeNote] = useState('')

  const [latestMatch, setLatestMatch] = useState<FamilyProfile | null>(null)
  const [mapFocusCoords, setMapFocusCoords] = useState<[number, number] | null>(null)
  const [apiFamilyProfiles, setApiFamilyProfiles] = useState<ApiFamilyProfile[]>([])
  const [familyApiError, setFamilyApiError] = useState<string | null>(null)
  const [pendingFamilyLikeId, setPendingFamilyLikeId] = useState<string | null>(null)

  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transientToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const recordDemoSelection = useCallback((action: string, detail: string) => {
    setDemoSelections((prev) => [
      {
        id: `sel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        time: nowClock(),
        action,
        detail,
      },
      ...prev.slice(0, 14),
    ])
  }, [])

  const {
    authStatus,
    currentUser,
    authRedirecting,
    authErrorMessage,
    startGoogleSignIn,
    signOutGoogleSession,
  } = useGoogleSession({ onLogSelection: recordDemoSelection })

  const {
    profile,
    setProfile,
    isHydrated: isProfileHydrated,
    profileSavedToast,
    dbSyncStatus,
    mongoInstanceLabel,
    mongoUpdatedAt,
    mongoRevision,
    dbFeedLog,
    attendingIds,
    setAttendingIds,
    dismissedIds,
    setDismissedIds,
    saveProfileFeedback,
    saveFamilyProfile,
    resetTransientData,
  } = useFamilyProfileSync({ currentUser })

  const { events, eventFeedStatus, eventFeedSources, eventFeedDebug, loadEventsFeed } =
    useEventsFeed({ onLogSelection: recordDemoSelection })

  const activeEventIds = useMemo(() => events.map((event) => event.id), [events])
  const eventChat = useEventChatAndParticipations({
    activeEventIds,
    currentUserEmail: currentUser?.email ?? '',
    currentUserName: currentUser?.displayName ?? '',
  })
  const refreshFamilyProfiles = useCallback(async () => {
    if (!currentUser) {
      setApiFamilyProfiles([])
      return
    }

    const response = await fetch('/api/families', { cache: 'no-store' })
    const payload: unknown = await response.json()
    if (!response.ok) {
      const message =
        payload &&
        typeof payload === 'object' &&
        'error' in payload &&
        typeof payload.error === 'string'
          ? payload.error
          : `Perheiden haku epäonnistui (HTTP ${response.status}).`
      throw new Error(message)
    }
    if (
      !payload ||
      typeof payload !== 'object' ||
      !('families' in payload) ||
      !Array.isArray(payload.families)
    ) {
      throw new Error('Perheiden hakuvastaus ei kelpaa.')
    }
    const nextProfiles = payload.families.map(parseApiFamily)
    setApiFamilyProfiles((current) =>
      areApiFamilyProfilesEqual(current, nextProfiles) ? current : nextProfiles,
    )
  }, [currentUser?.id])

  useEffect(() => {
    if (!currentUser) {
      setApiFamilyProfiles([])
      return
    }

    let cancelled = false
    let lastReportedError = ''
    const reportError = (error: unknown) => {
      if (cancelled) return
      const message =
        error instanceof Error ? error.message : 'Perheprofiilin synkronointi epäonnistui.'
      setFamilyApiError(message)
      if (message !== lastReportedError) {
        lastReportedError = message
        recordDemoSelection('FAMILY_API_ERROR', message)
      }
    }
    const loadFamilies = () =>
      refreshFamilyProfiles()
        .then(() => setFamilyApiError(null))
        .catch(reportError)
    void loadFamilies()
    const intervalId = window.setInterval(() => {
      void loadFamilies()
    }, 4000)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [currentUser?.id, recordDemoSelection, refreshFamilyProfiles])

  const eventChatReadStorageKey = `shellproto-event-chat-last-read:${encodeURIComponent(
    eventChat.participantEmail.trim().toLowerCase() || 'demo',
  )}`

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = window.localStorage.getItem(eventChatReadStorageKey)
      const parsed: unknown = saved ? JSON.parse(saved) : null
      const timestamps: Record<string, string> = {}
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        for (const [channelId, timestamp] of Object.entries(parsed)) {
          if (typeof timestamp === 'string') timestamps[channelId] = timestamp
        }
      }
      chatLastReadAtRef.current = timestamps
      setChatLastReadAt(timestamps)
      setChatReadError(null)
    } catch {
      chatLastReadAtRef.current = {}
      setChatLastReadAt({})
      setChatReadError('Lukukuittauksia ei voitu lukea selaimen tallennustilasta.')
    }
  }, [eventChatReadStorageKey])

  const markChatChannelRead = useCallback(
    (channelId: string) => {
      const next = {
        ...chatLastReadAtRef.current,
        [channelId]: new Date().toISOString(),
      }
      chatLastReadAtRef.current = next
      setChatLastReadAt(next)
      try {
        window.localStorage.setItem(eventChatReadStorageKey, JSON.stringify(next))
        setChatReadError(null)
      } catch {
        setChatReadError('Lukukuittausta ei voitu tallentaa selaimen tallennustilaan.')
      }
    },
    [eventChatReadStorageKey],
  )

  const activeChatLastMessageId = eventChat.messages.at(-1)?.id
  useEffect(() => {
    const channelId = eventChat.activeChannel?.id
    if (channelId?.startsWith('event:') || channelId?.startsWith('family:')) {
      markChatChannelRead(channelId)
    }
  }, [eventChat.activeChannel?.id, activeChatLastMessageId, markChatChannelRead])

  const ownGoingEventIds = useMemo(() => {
    const email = eventChat.participantEmail.trim().toLowerCase()
    return new Set(
      eventChat.participations
        .filter(
          (participation) =>
            participation.status === 'going' &&
            participation.participantEmail.trim().toLowerCase() === email,
        )
        .map((participation) => participation.eventId),
    )
  }, [eventChat.participantEmail, eventChat.participations])

  const matchedIds = useMemo(
    () => apiFamilyProfiles.filter((family) => family.isMutualMatch).map((family) => family.id),
    [apiFamilyProfiles],
  )
  const mutualFamilyChannelIds = useMemo(
    () =>
      new Set(
        apiFamilyProfiles
          .filter((family) => family.isMutualMatch)
          .map((family) => family.matchChannelId),
      ),
    [apiFamilyProfiles],
  )

  const unreadChatChannelIds = useMemo(
    () =>
      new Set(
        eventChat.channels
          .filter((channel) => {
            if (!channel.id.startsWith('event:') && !channel.id.startsWith('family:')) {
              return false
            }
            if (channel.id.startsWith('family:') && !mutualFamilyChannelIds.has(channel.id)) {
              return false
            }
            if (
              channel.id.startsWith('event:') &&
              !ownGoingEventIds.has(channel.id.slice('event:'.length))
            ) {
              return false
            }
            if (
              channel.lastSenderEmail.trim().toLowerCase() ===
              eventChat.participantEmail.trim().toLowerCase()
            ) {
              return false
            }
            const lastMessageTime = Date.parse(channel.lastMessageAt)
            const lastReadAt = chatLastReadAt[channel.id]
            if (!lastReadAt) return true
            const lastReadTime = Date.parse(lastReadAt)
            return (
              Number.isNaN(lastReadTime) ||
              (!Number.isNaN(lastMessageTime) && lastMessageTime > lastReadTime)
            )
          })
          .map((channel) => channel.id),
      ),
    [
      eventChat.channels,
      eventChat.participantEmail,
      chatLastReadAt,
      ownGoingEventIds,
      mutualFamilyChannelIds,
    ],
  )

  const openHubChannel = useCallback(
    (
      targetSection: HubSection,
      opts?: { eventId?: string | null; directTargetId?: string | null },
    ) => {
      setHubInitialSection(targetSection)
      setHubEventId(opts?.eventId ?? null)
      setHubDirectTargetId(opts?.directTargetId ?? null)
      setHubMountKey((prev) => prev + 1)
      setActiveTab('hub')
      recordDemoSelection(
        'OPEN_HUB',
        `${targetSection}${opts?.eventId ? `:${opts.eventId}` : ''}${
          opts?.directTargetId ? `:${opts.directTargetId}` : ''
        }`,
      )
    },
    [recordDemoSelection],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    setDemoFloatPos((prev) => prev ?? { x: Math.max(12, window.innerWidth - 336), y: 24 })
    setDbFloatPos((prev) => prev ?? { x: Math.max(12, window.innerWidth - 336), y: 268 })
    setChatFloatPos(
      (prev) =>
        prev ?? {
          x: Math.max(12, window.innerWidth - 336),
          y: Math.max(12, Math.min(180, window.innerHeight - 460)),
        },
    )
  }, [])

  const showTransientBanner = (message: string, ms = 3500) => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
    setInviteBanner(message)
    bannerTimerRef.current = setTimeout(() => setInviteBanner(null), ms)
  }

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
      if (transientToastTimerRef.current) clearTimeout(transientToastTimerRef.current)
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
    }
  }, [])

  const resetTransientDemoData = () => {
    resetTransientData()
    setLatestMatch(null)
    setMapFocusCoords(null)
    setEventAgeFilter('all')
    setEventSearchQuery('')
    setIgnoreDefaultPresetTemp(false)
    setDemoSelections([
      {
        id: `rst-${Date.now()}`,
        time: nowClock(),
        action: 'TRANSIENT_RESET',
        detail: 'no_db_write (swipes/matches/chat cleared)',
      },
    ])

    if (transientToastTimerRef.current) clearTimeout(transientToastTimerRef.current)
    setTransientResetToast(true)
    transientToastTimerRef.current = setTimeout(() => setTransientResetToast(false), 2500)
  }

  const safeEvents = Array.isArray(events) ? events : INITIAL_EVENTS
  const safeHomeCoords = useMemo(
    () => resolveCoordsTuple(profile.homeCoords, DEFAULT_PKS_COORDS),
    [profile.homeCoords],
  )

  const baseAreaSortedEvents = useMemo(() => {
    const resolved = resolveEventsForMap(safeEvents, safeHomeCoords)
    return resolved.all
      .map(({ event: evt, effectiveCoords, hasExactCoords, precision, district }) => ({
        ...evt,
        coords: effectiveCoords,
        hasExactCoords,
        precision,
        district,
        distanceKm: calcDistanceKm(safeHomeCoords, effectiveCoords),
      }))
      .filter((evt) => {
        if (evt.distanceKm > profile.filters.maxDistanceKm) return false
        if (
          profile.filters.targetCity !== 'Kaikki PKS' &&
          (evt.city || '').toLowerCase() !== profile.filters.targetCity.toLowerCase()
        ) {
          return false
        }
        return true
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
  }, [safeEvents, safeHomeCoords, profile.filters.maxDistanceKm, profile.filters.targetCity])

  const activeAgeGroupsForEvents = useMemo(() => {
    if (!profile.defaultPreset.enabled || ignoreDefaultPresetTemp) return []
    if (profile.defaultPreset.useChildrenAgeInference && profile.children.length > 0) {
      return inferAgeGroupsFromChildren(profile.children)
    }
    return profile.filters.targetAgeGroups
  }, [
    profile.defaultPreset.enabled,
    profile.defaultPreset.useChildrenAgeInference,
    profile.children,
    profile.filters.targetAgeGroups,
    ignoreDefaultPresetTemp,
  ])

  const normalizedEventQuery = eventSearchQuery.trim().toLowerCase()

  const filteredSortedEvents = baseAreaSortedEvents.filter((evt) => {
    if (!matchesEventAgeFilter(evt.ageGroup, eventAgeFilter)) {
      return false
    }

    if (profile.defaultPreset.enabled && !ignoreDefaultPresetTemp) {
      if (profile.defaultPreset.onlyFreeEvents && !/maksuton|free/i.test(evt.price || '')) {
        return false
      }
      if (
        profile.defaultPreset.weekendOrEveningFocus &&
        !/la|su|viikonlop|klo\s*(1[7-9]|2[0-2])|ilta/i.test(`${evt.time || ''} ${evt.title}`)
      ) {
        return false
      }
      if (activeAgeGroupsForEvents.length > 0) {
        const evtAgeNorm = (evt.ageGroup || '').toLowerCase()
        const isGeneral =
          !evtAgeNorm ||
          evtAgeNorm.includes('kaikki') ||
          evtAgeNorm.includes('koko perhe') ||
          evtAgeNorm.includes('all ages') ||
          evtAgeNorm.includes('lapset & perheet')
        const matchesAnyGroup = activeAgeGroupsForEvents.some((g) => {
          const clean = g.replace('v', '').trim()
          return evtAgeNorm.includes(clean) || evtAgeNorm.includes(g.toLowerCase())
        })
        if (!isGeneral && !matchesAnyGroup) {
          return false
        }
      }
      if (profile.defaultPreset.favoriteActivities.length > 0) {
        const evtTagsText = [
          ...(evt.tags ?? []),
          ...(evt.keywords ?? []),
          evt.title,
          evt.description ?? '',
        ]
          .join(' ')
          .toLowerCase()
        const matchesActivity = profile.defaultPreset.favoriteActivities.some((act) => {
          const headWord = act.split('&')[0].trim().toLowerCase()
          return evtTagsText.includes(headWord) || evtTagsText.includes(act.toLowerCase())
        })
        if (!matchesActivity && !/perhe|lapset|satutuokio|vauva/i.test(evtTagsText)) {
          return false
        }
      }
    }

    if (normalizedEventQuery) {
      const haystack = [
        evt.title,
        evt.venue,
        evt.city,
        evt.district ?? '',
        evt.ageGroup,
        evt.price,
        evt.description ?? '',
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(normalizedEventQuery)) {
        return false
      }
    }
    return true
  })

  const hasActiveQuickEventFilter = eventAgeFilter !== 'all' || normalizedEventQuery.length > 0

  const sourceBadge = getSourceStatusBadge(eventFeedStatus, eventFeedSources)

  const familiesWithDistance: ScoredApiFamily[] = useMemo(
    () =>
      apiFamilyProfiles.map((family) => {
        const city = getCoarseCity(family.area, profile.homeCity)
        const famCoords = resolveCoordsTuple(COARSE_CITY_COORDS[city], DEFAULT_PKS_COORDS)
        const distanceKm = calcDistanceKm(safeHomeCoords, famCoords)
        const familyProfile: FamilyProfile = {
          id: family.id,
          name: family.familyName,
          area: family.area,
          city,
          coords: famCoords,
          childrenAges: family.childrenSummary || 'Ikäryhmää ei ilmoitettu',
          ageGroups: getAgeGroups(family.childrenSummary),
          bio: family.bio || '',
          interests: [],
          hasCloseRelatives: false,
        }
        const match = calcFamilyMatch(profile, familyProfile, distanceKm, attendingIds)
        return {
          ...family,
          ...familyProfile,
          distanceKm,
          match,
        }
      }),
    [apiFamilyProfiles, profile, safeHomeCoords, attendingIds],
  )

  const filteredDeck = familiesWithDistance
    .filter((fam) => {
      if (!profile.privacy.discoverable) return false
      if (fam.passedByMe || dismissedIds.includes(fam.id) || matchedIds.includes(fam.id)) return false
      if (fam.distanceKm > profile.filters.maxDistanceKm) return false
      if (profile.filters.targetCity !== 'Kaikki PKS' && fam.city !== profile.filters.targetCity) {
        return false
      }
      if (profile.filters.targetAgeGroups.length > 0) {
        const hasMatchingAge = fam.ageGroups.some((g) =>
          profile.filters.targetAgeGroups.includes(g),
        )
        if (!hasMatchingAge) return false
      }
      return true
    })
    .sort((a, b) => b.match.percent - a.match.percent)

  const currentCard = filteredDeck[0]
  const matchedFamilies = useMemo(
    () => familiesWithDistance.filter((family) => family.isMutualMatch),
    [familiesWithDistance],
  )
  const visibleMapFamilies =
    activeTab === 'families' && familySubTab === 'matches' ? matchedFamilies : filteredDeck
  const syncInferredAges = (prev: UserProfileState, nextChildren: ChildItem[]): string[] => {
    if (!prev.defaultPreset.useChildrenAgeInference) {
      return prev.filters.targetAgeGroups
    }
    const inferred = inferAgeGroupsFromChildren(nextChildren)
    return inferred.length > 0 ? inferred : prev.filters.targetAgeGroups
  }

  const sendCoParentInvite = () => {
    const email = inviteParentEmail.trim().toLowerCase()
    const name = inviteParentName.trim() || 'Toinen vanhempi'

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError('Syötä kelvollinen sähköpostiosoite (esim. puoliso@esimerkki.fi).')
      return
    }
    if (profile.coParents.some((p) => p.email.toLowerCase() === email)) {
      setInviteError('Tälle sähköpostiosoitteelle on jo lähetetty kutsu.')
      return
    }

    setInviteError('')
    const newInvite: CoParentItem = {
      id: `cp-${Date.now()}`,
      name,
      email,
      status: 'pending',
      invitedAt: new Date().toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' }),
      inviteCode: generateInviteCode(),
    }

    setProfile((prev) => ({ ...prev, coParents: [...prev.coParents, newInvite] }))
    setInviteParentName('')
    setInviteParentEmail('')
    setPreviewInviteId(newInvite.id)
    recordDemoSelection('COPARENT_INVITE', `${newInvite.inviteCode} (pending)`)
    showTransientBanner(`✉️ Demokutsu ja kutsulinkki luotu (${newInvite.inviteCode})`, 4000)
  }

  const simulateAcceptCoParent = (id: string) => {
    const target = profile.coParents.find((p) => p.id === id)
    setProfile((prev) => ({
      ...prev,
      coParents: prev.coParents.map((p) => (p.id === id ? { ...p, status: 'accepted' } : p)),
    }))
    recordDemoSelection('COPARENT_ACCEPT', target ? `${target.inviteCode} -> accepted` : 'accepted')
    showTransientBanner('✅ Kutsuttu vanhempi liitetty perheprofiiliin (demo)!')
  }

  const resendCoParentInvite = (id: string) => {
    const target = profile.coParents.find((p) => p.id === id)
    if (!target) return
    const nowTime = new Date().toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })
    const nextCode = generateInviteCode()
    setProfile((prev) => ({
      ...prev,
      coParents: prev.coParents.map((p) =>
        p.id === id ? { ...p, invitedAt: nowTime, inviteCode: nextCode } : p,
      ),
    }))
    setPreviewInviteId(id)
    recordDemoSelection('COPARENT_RESEND', nextCode)
    showTransientBanner(`🔁 Uusi kutsulinkki luotu (${nextCode})`)
  }

  const removeCoParent = (id: string) => {
    const target = profile.coParents.find((p) => p.id === id)
    if (previewInviteId === id) setPreviewInviteId(null)
    setProfile((prev) => ({
      ...prev,
      coParents: prev.coParents.filter((p) => p.id !== id),
    }))
    recordDemoSelection('COPARENT_REMOVE', target ? target.inviteCode : 'removed')
  }

  const copyInviteLink = async (invite: CoParentItem) => {
    const link = buildInviteUrl(invite)
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(link)
      } catch {
        // Ohitetaan leikepöydän rajoitukset
      }
    }
    recordDemoSelection('INVITE_COPY', invite.inviteCode)
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
    setCopiedInviteId(invite.id)
    copiedTimerRef.current = setTimeout(() => setCopiedInviteId(null), 2500)
  }

  const addChild = () => {
    const trimmed = newChildAge.trim()
    if (!trimmed) {
      setChildError('Syötä lapsen ikä (esim. 3 v).')
      return
    }
    setChildError('')
    setProfile((prev) => {
      const nextChildren = [
        ...prev.children,
        { id: `c-${Date.now()}`, ageLabel: trimmed, group: newChildGroup },
      ]
      return {
        ...prev,
        children: nextChildren,
        filters: {
          ...prev.filters,
          targetAgeGroups: syncInferredAges(prev, nextChildren),
        },
      }
    })
    setNewChildAge('')
  }

  const startEditChild = (child: ChildItem) => {
    setEditingChildId(child.id)
    setEditChildAge(child.ageLabel)
    setEditChildGroup(child.group)
  }

  const saveEditChild = (id: string) => {
    if (!editChildAge.trim()) return
    setProfile((prev) => {
      const nextChildren = prev.children.map((c) =>
        c.id === id ? { ...c, ageLabel: editChildAge.trim(), group: editChildGroup } : c,
      )
      return {
        ...prev,
        children: nextChildren,
        filters: {
          ...prev.filters,
          targetAgeGroups: syncInferredAges(prev, nextChildren),
        },
      }
    })
    setEditingChildId(null)
  }

  const removeChild = (id: string) => {
    if (editingChildId === id) setEditingChildId(null)
    setProfile((prev) => {
      const nextChildren = prev.children.filter((c) => c.id !== id)
      return {
        ...prev,
        children: nextChildren,
        filters: {
          ...prev.filters,
          targetAgeGroups: syncInferredAges(prev, nextChildren),
        },
      }
    })
  }

  const addCloseRelative = () => {
    setProfile((prev) => ({
      ...prev,
      closeRelatives: [
        ...prev.closeRelatives,
        {
          id: `r-${Date.now()}`,
          relationLabel: newRelativeRole,
          note: newRelativeNote.trim() || 'Läheinen perheenjäsen',
        },
      ],
    }))
    setNewRelativeNote('')
  }

  const startEditRelative = (rel: CloseRelativeItem) => {
    setEditingRelativeId(rel.id)
    setEditRelativeRole(rel.relationLabel)
    setEditRelativeNote(rel.note)
  }

  const saveEditRelative = (id: string) => {
    setProfile((prev) => ({
      ...prev,
      closeRelatives: prev.closeRelatives.map((r) =>
        r.id === id
          ? {
              ...r,
              relationLabel: editRelativeRole,
              note: editRelativeNote.trim() || 'Läheinen perheenjäsen',
            }
          : r,
      ),
    }))
    setEditingRelativeId(null)
  }

  const removeCloseRelative = (id: string) => {
    if (editingRelativeId === id) setEditingRelativeId(null)
    setProfile((prev) => ({
      ...prev,
      closeRelatives: prev.closeRelatives.filter((r) => r.id !== id),
    }))
  }

  const toggleDatabaseParticipation = useCallback(
    async (eventId: string, eventTitle: string) => {
      const result = await eventChat.toggleParticipation(eventId, eventTitle)
      if (!result) return false

      const isGoing = result === 'going'
      setAttendingIds((current) => {
        const alreadyGoing = current.includes(eventId)
        if (alreadyGoing === isGoing) return current
        return isGoing ? [...current, eventId] : current.filter((id) => id !== eventId)
      })
      recordDemoSelection('EVENT_ATTENDANCE', `${eventId} -> ${isGoing ? 'GOING' : 'SKIPPED'}`)
      return result
    },
    [eventChat.toggleParticipation, recordDemoSelection],
  )

  const ensureEventParticipation = useCallback(
    async (eventId: string, eventTitle: string) => {
      if (eventChat.joinedEventIdSet.has(eventId)) return
      const result = await toggleDatabaseParticipation(eventId, eventTitle)
      if (result !== 'going') {
        throw new Error(eventChat.participationError || 'Tapahtumaan liittyminen epäonnistui.')
      }
    },
    [eventChat.joinedEventIdSet, eventChat.participationError, toggleDatabaseParticipation],
  )

  const openPersistedEventChat = useCallback(
    (eventId: string, eventTitle: string) => {
      eventChat.setActiveChannel({ id: `event:${eventId}`, title: eventTitle })
      recordDemoSelection('EVENT_CHAT_OPEN', eventId)
    },
    [eventChat.setActiveChannel, recordDemoSelection],
  )

  const fulfillPendingIntent = useCallback(
    async (intent: PendingEnrollmentIntent) => {
      switch (intent.type) {
        case 'join_event': {
          const eventTitle =
            intent.eventTitle ??
            events.find((event) => event.id === intent.eventId)?.title ??
            intent.eventId
          await ensureEventParticipation(intent.eventId, eventTitle)
          break
        }
        case 'open_event_chat': {
          const eventTitle =
            intent.eventTitle ??
            events.find((event) => event.id === intent.eventId)?.title ??
            intent.eventId
          await ensureEventParticipation(intent.eventId, eventTitle)
          openPersistedEventChat(intent.eventId, eventTitle)
          break
        }
        case 'switch_tab':
          if (intent.tab === 'families') {
            setActiveTab('families')
            recordDemoSelection('TAB_SELECT', 'families')
          } else {
            openHubChannel('event_chat')
            recordDemoSelection('TAB_SELECT', 'hub')
          }
          break
      }
    },
    [events, ensureEventParticipation, openHubChannel, openPersistedEventChat, recordDemoSelection],
  )

  const enrollmentFlow = useEnrollmentFlow({
    authStatus,
    currentUser,
    profile,
    isProfileHydrated,
    saveFamilyProfile,
    startGoogleSignIn,
    onFulfillPendingIntent: fulfillPendingIntent,
  })

  const handleSwipe = (
    liked: boolean,
    selectedCard: ScoredApiFamily | undefined = currentCard,
  ) => {
    if (!selectedCard) return
    if (pendingFamilyLikeId !== null) return
    if (!currentUser) {
      setFamilyApiError('Kirjaudu sisään ennen perheiden selaamista.')
      return
    }

    setPendingFamilyLikeId(selectedCard.id)
    void (async () => {
      try {
        const response = await fetch('/api/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toFamilyId: selectedCard.id,
            action: liked ? 'liked' : 'passed',
          }),
        })
        const payload: unknown = await response.json()
        if (!response.ok) {
          const message =
            payload &&
            typeof payload === 'object' &&
            'error' in payload &&
            typeof payload.error === 'string'
              ? payload.error
              : `Perhevalinnan tallennus epäonnistui (HTTP ${response.status}).`
          throw new Error(message)
        }
        if (!payload || typeof payload !== 'object' || !('match' in payload)) {
          throw new Error('Perhevalinnan palvelinvastaus ei kelpaa.')
        }
        setFamilyApiError(null)
        await refreshFamilyProfiles()
        if (liked && payload.match === true) {
          setLatestMatch(selectedCard)
          recordDemoSelection('FAMILY_MATCH', selectedCard.id)
        } else {
          setLatestMatch(null)
          recordDemoSelection(liked ? 'FAMILY_LIKE' : 'SWIPE_PASS', selectedCard.id)
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Perhevalinnan tallennus epäonnistui.'
        setFamilyApiError(message)
        recordDemoSelection('FAMILY_API_ERROR', message)
      } finally {
        setPendingFamilyLikeId(null)
      }
    })()
  }

  const openOnMap = (coords: [number, number], label = 'coords') => {
    if (label === 'events-map-peek' || label === 'families-map-peek') {
      const source = label === 'events-map-peek' ? 'events' : 'families'
      setMapOverlaySource(source)
      recordDemoSelection('MAP_PEEK_EXPAND', source)
      return
    }

    setMapFocusCoords(resolveCoordsTuple(coords, safeHomeCoords))
    setActiveTab('map')
    recordDemoSelection('MAP_FOCUS', label)
  }

  const closeMapOverlay = useCallback(() => setMapOverlaySource(null), [])

  const handleResetMapBounds = useCallback(() => {
    setMapFocusCoords(null)
    recordDemoSelection('MAP_HOME_ZOOM', 'PKS_SEUTULA_BOUNDS')
  }, [recordDemoSelection])

  const totalParentsCount = 1 + profile.coParents.length
  const activePreviewInvite = profile.coParents.find((p) => p.id === previewInviteId) ?? null
  const latestDbEntry = dbFeedLog[0] ?? null
  const requestProtectedTab = useCallback(
    (tab: 'families' | 'conversations') => {
      enrollmentFlow.requireEnrolledAction({ type: 'switch_tab', tab }, () => {
        if (tab === 'families') {
          setActiveTab('families')
          recordDemoSelection('TAB_SELECT', 'families')
        } else {
          openHubChannel('event_chat')
          recordDemoSelection('TAB_SELECT', 'hub')
        }
      })
    },
    [enrollmentFlow.requireEnrolledAction, openHubChannel, recordDemoSelection],
  )

  const protectedTabPrompt = (tab: 'families' | 'conversations') => (
    <section className="mx-auto my-8 max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
      <h2 className="text-base font-bold text-slate-900">Löydä sopivaa seuraa</h2>
      <p className="mt-2 text-sm text-slate-600">
        Kirjaudu ja luo perheprofiili nähdäksesi sopivat perheet ja liittyäksesi Yhteisöön.
      </p>
      <button
        className="mt-4 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"
        onClick={() => requestProtectedTab(tab)}
        type="button"
      >
        {authStatus === 'authenticated' ? 'Täydennä perheprofiili' : 'Kirjaudu ja jatka'}
      </button>
    </section>
  )

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-zinc-900 px-3.5 py-0 flex justify-center items-center sm:px-6 md:py-5">
      <div className="mx-auto flex h-dvh w-full min-w-0 max-w-[430px] flex-col overflow-hidden border-x border-slate-800 bg-slate-50 shadow-2xl relative transition-all duration-300 sm:max-w-2xl md:max-w-3xl md:h-[92dvh] md:max-h-[1180px] md:rounded-[2rem] md:border-[3px]">
        <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex flex-col">
              <h1 className="text-base md:text-lg font-extrabold text-slate-900 tracking-tight">
                Perhe<span className="text-emerald-600">Piiri</span>
              </h1>
            </div>
            <p className="text-[10px] text-slate-500 truncate md:text-xs">
              🟠 {profile.homeCity} ({profile.area}) • max {profile.filters.maxDistanceKm} km
            </p>
          </div>
          {authStatus === 'authenticated' && currentUser ? (
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt=""
                    className="h-6 w-6 shrink-0 rounded-full"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-800"
                  >
                    {currentUser.displayName.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="max-w-24 truncate text-xs font-semibold text-slate-800">
                  {currentUser.displayName}
                </span>
                <span
                  className={`max-w-[76px] truncate rounded-full px-1.5 py-1 text-[9px] font-bold md:max-w-none md:px-2 md:text-[10px] ${
                    isFamilyProfileComplete(profile)
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {isFamilyProfileComplete(profile) ? 'Profiili valmis' : 'Täydennä profiili'}
                </span>
              </div>
              <div className="hidden items-center gap-1.5 lg:flex">
                <button
                  type="button"
                  onClick={() => setShowDemoMonitor((prev) => !prev)}
                  className="rounded-full bg-zinc-900 px-2 py-1 text-[10px] font-mono font-bold text-amber-400 hover:bg-zinc-800"
                >
                  {showDemoMonitor ? '◼ Demo-Log' : '◻ Demo-Log'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNerdDbFloat((prev) => !prev)}
                  className="rounded-full bg-indigo-950 px-2 py-1 text-[10px] font-mono font-bold text-cyan-300 hover:bg-indigo-900"
                >
                  {showNerdDbFloat ? '◼ DB-Feed' : '◻ DB-Feed'}
                </button>
              </div>
              <button
                type="button"
                disabled={authRedirecting}
                onClick={() => void signOutGoogleSession()}
                className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-60"
              >
                Kirjaudu ulos
              </button>
            </div>
          ) : (
            <div className="flex min-w-0 shrink-0 items-center gap-2">
              <span className="hidden rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 md:inline">
                Vierailija
              </span>
              <button
                type="button"
                disabled={authRedirecting}
                onClick={() => void startGoogleSignIn()}
                className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-60"
              >
                {authRedirecting ? 'Siirrytään...' : 'Kirjaudu Googlella'}
              </button>
            </div>
          )}
        </header>
        {authErrorMessage && (
          <p
            className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800"
            role="alert"
          >
            {authErrorMessage}
          </p>
        )}

        {latestMatch && (
          <div className="bg-emerald-600 text-white px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="text-xs sm:text-sm">
              <p className="font-bold">🎉 Uusi perheosuma: {latestMatch.name}!</p>
              <p className="opacity-90 text-xs">{latestMatch.area}</p>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const target = latestMatch
                  setLatestMatch(null)
                  openHubChannel('matches', { directTargetId: target.id })
                }}
                className="px-3 py-1.5 bg-white text-emerald-800 rounded-lg text-xs font-bold"
              >
                Avaa chat
              </button>
              <button
                type="button"
                onClick={() => setLatestMatch(null)}
                className="px-2.5 py-1.5 text-white/80 text-xs"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          {activeTab === 'events' && (
            <section
              aria-labelledby="quick-actions-heading"
              className="mx-auto w-full max-w-[430px] px-4 pt-4 sm:max-w-2xl sm:px-6 md:max-w-3xl"
            >
              <h2
                id="quick-actions-heading"
                className="mb-2 text-sm font-bold text-[var(--color-ink)]"
              >
                Mitä etsit tänään?
              </h2>
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={() => requestProtectedTab('families')}
                  className="flex min-w-0 min-h-[76px] flex-col items-center justify-center gap-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-3 text-center text-xs font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-bg)] sm:min-h-[84px] sm:gap-1.5 sm:px-3"
                >
                  <span aria-hidden="true" className="text-lg leading-none">🤝</span>
                  <span className="min-w-0 truncate">Perheet</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('events')
                    recordDemoSelection('TAB_SELECT', 'events')
                  }}
                  className="flex min-w-0 min-h-[76px] flex-col items-center justify-center gap-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-3 text-center text-xs font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-bg)] sm:min-h-[84px] sm:gap-1.5 sm:px-3"
                >
                  <span aria-hidden="true" className="text-lg leading-none">📅</span>
                  <span className="min-w-0 truncate">Tapahtumat</span>
                </button>
                <button
                  type="button"
                  onClick={() => requestProtectedTab('conversations')}
                  className="flex min-w-0 min-h-[76px] flex-col items-center justify-center gap-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-3 text-center text-xs font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-bg)] sm:min-h-[84px] sm:gap-1.5 sm:px-3"
                >
                  <span aria-hidden="true" className="text-lg leading-none">💬</span>
                  <span className="min-w-0 truncate">Yhteisö</span>
                </button>
              </div>
            </section>
          )}
          {activeTab === 'events' &&
            currentUser &&
            isFamilyProfileComplete(profile) && (
              <FamilyHomeCarousel
                families={filteredDeck}
                familyApiError={familyApiError}
                pendingFamilyLikeId={pendingFamilyLikeId}
                onSwipe={(family, liked) => handleSwipe(liked, family)}
              />
            )}
          {activeTab === 'events' && (
            <EventsTabPanel
              profile={profile}
              sourceBadge={sourceBadge}
              eventFeedStatus={eventFeedStatus}
              filteredSortedEvents={filteredSortedEvents}
              baseAreaSortedEventsCount={baseAreaSortedEvents.length}
              matchedFamilies={matchedFamilies}
              joinedEventIds={eventChat.joinedEventIdSet}
              countsByEventId={eventChat.countsByEventId}
              pendingEventIds={eventChat.pendingEventIds}
              isLoadingParticipations={eventChat.isLoadingParticipations}
              participationError={eventChat.participationError}
              eventAgeFilter={eventAgeFilter}
              onEventAgeFilterChange={setEventAgeFilter}
              eventSearchQuery={eventSearchQuery}
              onEventSearchQueryChange={setEventSearchQuery}
              hasActiveQuickEventFilter={hasActiveQuickEventFilter}
              ignoreDefaultPresetTemp={ignoreDefaultPresetTemp}
              onToggleDefaultPreset={() => setIgnoreDefaultPresetTemp((prev) => !prev)}
              onRefreshEvents={() => void loadEventsFeed(true)}
              onClearEventFilters={() => {
                setEventAgeFilter('all')
                setEventSearchQuery('')
              }}
              onShowAllEvents={() => setIgnoreDefaultPresetTemp(true)}
              onOpenProfileSettings={() => {
                setActiveTab('profile')
                setProfileSubView('main')
              }}
              onToggleParticipation={(eventId, eventTitle, isGoing) => {
                if (isGoing) {
                  void toggleDatabaseParticipation(eventId, eventTitle)
                  return
                }
                enrollmentFlow.requireEnrolledAction(
                  { type: 'join_event', eventId, eventTitle },
                  () => ensureEventParticipation(eventId, eventTitle),
                )
              }}
              onOpenEventChat={(eventId, eventTitle) =>
                enrollmentFlow.requireEnrolledAction(
                  { type: 'open_event_chat', eventId, eventTitle },
                  async () => {
                    await ensureEventParticipation(eventId, eventTitle)
                    openPersistedEventChat(eventId, eventTitle)
                  },
                )
              }
              onLogSelection={recordDemoSelection}
              onOpenMap={openOnMap}
            />
          )}
          {activeTab === 'families' && currentUser && isFamilyProfileComplete(profile) && (
            <div className="mx-auto w-full max-w-[430px] px-4 sm:max-w-2xl sm:px-6 md:max-w-3xl">
              <MapPeek
                label={familySubTab === 'matches' ? 'Perheosumien kartta' : 'Perhekartta'}
                itemCount={visibleMapFamilies.length}
                onExpand={() => openOnMap(profile.homeCoords, 'families-map-peek')}
              >
                <PksMapView
                  events={[]}
                  attendingIds={attendingIds}
                  matchedFamilies={visibleMapFamilies}
                  homeCoords={safeHomeCoords}
                  homeLabel={`${profile.area}, ${profile.homeCity}`}
                  familyName={profile.familyName}
                  shareEventsWithMatches={false}
                  showCloseRelativesInMatches={false}
                  focusCoords={null}
                  onResetBounds={handleResetMapBounds}
                />
              </MapPeek>
            </div>
          )}
          {activeTab === 'families' && currentUser && isFamilyProfileComplete(profile) && (
            <FamiliesTabPanel
              familySubTab={familySubTab}
              filteredDeckCount={filteredDeck.length}
              matchedFamilies={matchedFamilies}
              currentCard={currentCard}
              profile={profile}
              familyApiError={familyApiError}
              safeEvents={safeEvents}
              attendingIds={attendingIds}
              onFamilySubTabChange={setFamilySubTab}
              onLogSelection={recordDemoSelection}
              onSwipe={handleSwipe}
              onOpenProfileSettings={() => {
                setActiveTab('profile')
                setProfileSubView('main')
              }}
              onResetDismissed={() => {
                void (async () => {
                  try {
                    const response = await fetch('/api/match', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'reset-passed' }),
                    })
                    if (!response.ok) {
                      throw new Error(`Ohitettujen perheiden nollaus epäonnistui (HTTP ${response.status}).`)
                    }
                    setDismissedIds([])
                    await refreshFamilyProfiles()
                    setFamilyApiError(null)
                    recordDemoSelection('DISMISSED_RESET', currentUser.id)
                  } catch (error) {
                    setFamilyApiError(
                      error instanceof Error ? error.message : 'Ohitettujen perheiden nollaus epäonnistui.',
                    )
                  }
                })()
              }}
              onOpenMap={openOnMap}
              onOpenMatchesChat={(familyId) =>
                openHubChannel('matches', { directTargetId: familyId })
              }
            />
          )}
          {activeTab === 'families' &&
            (!currentUser || !isFamilyProfileComplete(profile)) &&
            protectedTabPrompt('families')}

          {activeTab === 'hub' && currentUser && isFamilyProfileComplete(profile) && (
            <CommunityHubPanel
              key={hubMountKey}
              currentUser={currentUser}
              profile={profile}
              events={baseAreaSortedEvents}
              matchedIds={matchedIds}
              allFamilies={familiesWithDistance}
              initialSection={hubInitialSection}
              initialEventId={hubEventId}
              initialDirectTargetId={hubDirectTargetId}
              chatChannels={eventChat.channels}
              participations={eventChat.participations}
              pendingParticipationEventIds={eventChat.pendingEventIds}
              participationError={eventChat.participationError}
              activeChatChannel={eventChat.activeChannel}
              chatMessages={eventChat.messages}
              currentUserEmail={eventChat.participantEmail}
              unreadChatChannelIds={unreadChatChannelIds}
              isLoadingChatMessages={eventChat.isLoadingMessages}
              isSendingChatMessage={eventChat.isSendingMessage}
              chatError={[eventChat.chatError, chatReadError].filter(Boolean).join(' ') || null}
              onActiveChatChannelChange={eventChat.setActiveChannel}
              onSendChatMessage={eventChat.sendMessage}
              onToggleParticipation={eventChat.toggleParticipation}
            />
          )}
          {activeTab === 'hub' &&
            (!currentUser || !isFamilyProfileComplete(profile)) &&
            protectedTabPrompt('conversations')}

          {activeTab === 'map' && (
            <PksMapView
              events={safeEvents}
              attendingIds={attendingIds}
              matchedFamilies={matchedFamilies}
              homeCoords={safeHomeCoords}
              homeLabel={`${profile.area}, ${profile.homeCity}`}
              familyName={profile.familyName}
              shareEventsWithMatches={profile.privacy.shareEventsWithMatches}
              showCloseRelativesInMatches={profile.privacy.showCloseRelativesInMatches}
              focusCoords={mapFocusCoords}
              onResetBounds={handleResetMapBounds}
              selectedCity={profile.filters.targetCity}
              onChangeSelectedCity={(nextCity) =>
                setProfile((prev) => ({
                  ...prev,
                  filters: { ...prev.filters, targetCity: nextCity },
                }))
              }
            />
          )}

          {activeTab === 'profile' && profileSubView === 'main' && currentUser && (
            <ProfileSettingsPanel
              currentUser={currentUser}
              profile={profile}
              onChangeProfile={setProfile}
              totalParentsCount={totalParentsCount}
              filteredDeckCount={filteredDeck.length}
              dbFeedCount={dbFeedLog.length}
              profileSavedToast={profileSavedToast}
              transientResetToast={transientResetToast}
              authRedirecting={authRedirecting}
              onOpenMembers={() => setProfileSubView('members')}
              onOpenStoreInspector={() => setProfileSubView('store_inspector')}
              onSaveProfile={() => void saveProfileFeedback()}
              onResetTransientData={resetTransientDemoData}
              onSignOut={() => void signOutGoogleSession()}
              onLogSelection={recordDemoSelection}
            />
          )}
          {activeTab === 'profile' && !currentUser && protectedTabPrompt('families')}

          {activeTab === 'profile' && profileSubView === 'members' && currentUser && (
            <FamilyMembersPanel
              currentUser={currentUser}
              profile={profile}
              totalParentsCount={totalParentsCount}
              inviteBanner={inviteBanner}
              inviteParentName={inviteParentName}
              inviteParentEmail={inviteParentEmail}
              inviteError={inviteError}
              newChildAge={newChildAge}
              newChildGroup={newChildGroup}
              childError={childError}
              newRelativeRole={newRelativeRole}
              newRelativeNote={newRelativeNote}
              editingChildId={editingChildId}
              editChildAge={editChildAge}
              editChildGroup={editChildGroup}
              editingRelativeId={editingRelativeId}
              editRelativeRole={editRelativeRole}
              editRelativeNote={editRelativeNote}
              onChangeProfile={setProfile}
              onBack={() => {
                setEditingChildId(null)
                setEditingRelativeId(null)
                setProfileSubView('main')
              }}
              onPreviewInvite={setPreviewInviteId}
              onSimulateAcceptCoParent={simulateAcceptCoParent}
              onResendCoParentInvite={resendCoParentInvite}
              onRemoveCoParent={removeCoParent}
              onInviteParentNameChange={setInviteParentName}
              onInviteParentEmailChange={(email) => {
                setInviteParentEmail(email)
                if (inviteError) setInviteError('')
              }}
              onSendCoParentInvite={sendCoParentInvite}
              onEditChildAgeChange={setEditChildAge}
              onEditChildGroupChange={setEditChildGroup}
              onCancelEditChild={() => setEditingChildId(null)}
              onSaveEditChild={saveEditChild}
              onStartEditChild={startEditChild}
              onRemoveChild={removeChild}
              onNewChildAgeChange={(age) => {
                setNewChildAge(age)
                if (childError) setChildError('')
              }}
              onNewChildGroupChange={setNewChildGroup}
              onAddChild={addChild}
              onEditRelativeRoleChange={setEditRelativeRole}
              onEditRelativeNoteChange={setEditRelativeNote}
              onCancelEditRelative={() => setEditingRelativeId(null)}
              onSaveEditRelative={saveEditRelative}
              onStartEditRelative={startEditRelative}
              onRemoveCloseRelative={removeCloseRelative}
              onNewRelativeRoleChange={setNewRelativeRole}
              onNewRelativeNoteChange={setNewRelativeNote}
              onAddCloseRelative={addCloseRelative}
            />
          )}

          {activeTab === 'profile' && profileSubView === 'store_inspector' && currentUser && (
            <StoreInspectorPanel
              currentUser={currentUser}
              dbFeedLog={dbFeedLog}
              mongoRevision={mongoRevision}
              mongoInstanceLabel={mongoInstanceLabel}
              mongoUpdatedAt={mongoUpdatedAt}
              profile={profile}
              safeHomeCoords={safeHomeCoords}
              onBack={() => setProfileSubView('main')}
            />
          )}
        </main>

        {activePreviewInvite && (
          <div className="absolute inset-0 bg-slate-900/50 z-50 flex items-end md:items-center md:justify-center md:p-4">
            <div className="bg-white w-full md:max-w-lg rounded-t-3xl md:rounded-3xl p-4 md:p-5 space-y-3 shadow-xl">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">✉️ Kutsulinkin esikatselu</h3>
                  <p className="text-[11px] text-slate-500">
                    Vastaanottaja: {activePreviewInvite.name} ({activePreviewInvite.email})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewInviteId(null)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-bold"
                >
                  Sulje
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-600">Perhe: {profile.familyName}</span>
                  <span className="font-mono font-bold text-blue-700">
                    {activePreviewInvite.inviteCode}
                  </span>
                </div>

                <p className="text-[11px] text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200 break-all font-mono">
                  {buildInviteUrl(activePreviewInvite)}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void copyInviteLink(activePreviewInvite)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-xs font-bold hover:bg-slate-50"
                >
                  {copiedInviteId === activePreviewInvite.id
                    ? '✓ Linkki kopioitu'
                    : 'Kopioi linkki'}
                </button>
                {activePreviewInvite.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => simulateAcceptCoParent(activePreviewInvite.id)}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                  >
                    Simuloi liittyminen
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <nav className="mx-auto w-full min-w-0 max-w-[430px] bg-[var(--color-surface)] border-t border-[var(--color-border)] grid grid-cols-5 gap-1 px-2 py-2 shrink-0 sm:max-w-2xl md:max-w-3xl">
          {[
            { key: 'events', icon: '📅', label: 'Tapahtumat' },
            { key: 'families', icon: '🤝', label: 'Perheet' },
            { key: 'hub', icon: '💬', label: 'Yhteisö' },
            { key: 'map', icon: '🗺️', label: 'Kartta' },
            { key: 'profile', icon: '👤', label: 'Profiili' },
          ].map((tab) => {
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  const selectTab = () => {
                    setActiveTab(tab.key as TabKey)
                    if (tab.key === 'profile') setProfileSubView('main')
                    recordDemoSelection('TAB_SELECT', tab.key)
                  }
                  if (tab.key === 'families') {
                    requestProtectedTab('families')
                  } else if (tab.key === 'hub') {
                    requestProtectedTab('conversations')
                  } else {
                    selectTab()
                  }
                }}
                className={`flex min-w-0 w-full flex-col items-center justify-center gap-0.5 min-h-11 py-1 px-1 rounded-2xl transition-colors ${
                  active
                    ? 'bg-[var(--color-accent-soft)] text-[var(--color-ink)] font-bold'
                    : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-bg)]'
                }`}
              >
                <span className="text-lg leading-none">{tab.icon}</span>
                <span className="flex w-full min-w-0 items-center justify-center gap-1 text-center text-[11px] leading-tight sm:text-xs">
                  <span className="min-w-0 truncate">{tab.label}</span>
                  {tab.key === 'hub' && unreadChatChannelIds.size > 0 && (
                    <span className="min-w-4 rounded-full bg-rose-600 px-1 text-[9px] leading-4 text-white">
                      {unreadChatChannelIds.size}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </nav>
      </div>

      <DebugMonitorPanels
        showDemoMonitor={showDemoMonitor}
        showNerdDbFloat={showNerdDbFloat}
        currentUser={currentUser}
        demoFloatPos={demoFloatPos}
        dbFloatPos={dbFloatPos}
        onDemoPosChange={setDemoFloatPos}
        onDbPosChange={setDbFloatPos}
        onCloseDemoMonitor={() => setShowDemoMonitor(false)}
        onCloseNerdDbFloat={() => setShowNerdDbFloat(false)}
        attendingIds={attendingIds}
        matchedIds={matchedIds}
        dismissedIds={dismissedIds}
        profile={profile}
        eventFeedStatus={eventFeedStatus}
        eventFeedDebug={eventFeedDebug}
        eventFeedSources={eventFeedSources}
        onRefreshEvents={() => void loadEventsFeed(true)}
        demoSelections={demoSelections}
        mongoRevision={mongoRevision}
        dbSyncStatus={dbSyncStatus}
        latestDbEntry={latestDbEntry}
        dbFeedLog={dbFeedLog}
        onOpenStoreInspector={() => {
          setActiveTab('profile')
          setProfileSubView('store_inspector')
        }}
      />
      <FamilyEnrollmentModal
        isOpen={enrollmentFlow.isEnrollmentModalOpen}
        contextTitle={enrollmentFlow.enrollmentContextTitle}
        currentUser={currentUser}
        initialProfile={profile}
        pendingIntent={enrollmentFlow.pendingIntent}
        error={enrollmentFlow.enrollmentError}
        onComplete={enrollmentFlow.completeEnrollment}
        onCancel={enrollmentFlow.cancelEnrollment}
      />
      <EventChatWindow
        channels={eventChat.channels.filter((channel) => channel.id.startsWith('event:'))}
        activeChannel={
          eventChat.activeChannel?.id.startsWith('event:') ? eventChat.activeChannel : null
        }
        messages={eventChat.messages}
        currentUserEmail={eventChat.participantEmail}
        isDemoIdentity={eventChat.isDemoIdentity}
        pos={chatFloatPos}
        onPosChange={setChatFloatPos}
        isLoadingMessages={eventChat.isLoadingMessages}
        isSendingMessage={eventChat.isSendingMessage}
        error={eventChat.chatError}
        onSelectChannel={(channel) => {
          if (channel === null) {
            if (eventChat.activeChannel?.id.startsWith('event:')) {
              eventChat.setActiveChannel(null)
            }
          } else if (channel.id.startsWith('event:')) {
            eventChat.setActiveChannel(channel)
          }
        }}
        onSendMessage={eventChat.sendMessage}
        onRequestOpen={(onReady) =>
          enrollmentFlow.requireEnrolledAction(
            { type: 'switch_tab', tab: 'conversations' },
            onReady,
          )
        }
      />
      {mapOverlaySource && (
        <ExpandedMapOverlay
          source={mapOverlaySource}
          events={filteredSortedEvents}
          families={visibleMapFamilies}
          attendingIds={attendingIds}
          homeCoords={safeHomeCoords}
          homeLabel={`${profile.area}, ${profile.homeCity}`}
          familyName={profile.familyName}
          shareEventsWithMatches={profile.privacy.shareEventsWithMatches}
          showCloseRelativesInMatches={profile.privacy.showCloseRelativesInMatches}
          onClose={closeMapOverlay}
          onResetBounds={handleResetMapBounds}
        />
      )}
    </div>
  )
}
