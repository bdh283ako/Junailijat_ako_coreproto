'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CommunityHubPanel, type HubSection } from './CommunityHubPanel'
import {
  DebugMonitorPanels,
  type FeedSourcesMeta,
} from './DebugMonitorPanels'
import { EventsTabPanel, type EventAgeQuickFilter } from './EventsTabPanel'
import { FamiliesTabPanel, type FamilySubTab } from './FamiliesTabPanel'
import { FamilyMembersPanel } from './FamilyMembersPanel'
import {
  DEFAULT_PKS_COORDS,
  resolveCoordsTuple,
  resolveEventsForMap,
} from './mapGeoResolver'
import { PksMapView } from './PksMapView'
import { ProfileSettingsPanel } from './ProfileSettingsPanel'
import { StoreInspectorPanel } from './StoreInspectorPanel'
import { useEventsFeed, type EventFeedStatus } from './useEventsFeed'
import { useFamilyProfileSync } from './useFamilyProfileSync'
import { useGoogleSession } from './useGoogleSession'
import {
  buildInviteUrl,
  calcDistanceKm,
  calcFamilyMatch,
  ChildItem,
  CloseRelativeItem,
  CoParentItem,
  DEMO_FAMILIES,
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

  const [bucketMin, bucketMax] =
    filter === '0-3' ? [0, 3] : filter === '4-6' ? [4, 6] : [7, 12]

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

function getSourceStatusBadge(
  status: EventFeedStatus,
  sources: FeedSourcesMeta | null,
) {
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

  const activeSourceCount = [
    sources.karoCount > 0,
    sources.linkedEventsCount > 0,
  ].filter(Boolean).length

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
  const [profileSubView, setProfileSubView] = useState<ProfileSubView>('main')
  const [familySubTab, setFamilySubTab] = useState<FamilySubTab>('discover')

  const [hubInitialSection, setHubInitialSection] = useState<HubSection>('board')
  const [hubEventId, setHubEventId] = useState<string | null>(null)
  const [hubDirectTargetId, setHubDirectTargetId] = useState<string | null>(null)
  const [hubMountKey, setHubMountKey] = useState<number>(0)

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
    matchedIds,
    setMatchedIds,
    messages,
    setMessages,
    saveProfileFeedback,
    resetTransientData,
  } = useFamilyProfileSync({ currentUser })

  const {
    events,
    eventFeedStatus,
    eventFeedSources,
    eventFeedDebug,
    loadEventsFeed,
  } = useEventsFeed({ onLogSelection: recordDemoSelection })

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
  const safeHomeCoords = resolveCoordsTuple(profile?.homeCoords, DEFAULT_PKS_COORDS)

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

  const hasActiveQuickEventFilter =
    eventAgeFilter !== 'all' || normalizedEventQuery.length > 0

  const sourceBadge = getSourceStatusBadge(eventFeedStatus, eventFeedSources)

  const familiesWithDistance = DEMO_FAMILIES.map((fam) => {
    const famCoords = resolveCoordsTuple(fam?.coords, safeHomeCoords)
    const distanceKm = calcDistanceKm(safeHomeCoords, famCoords)
    const match = calcFamilyMatch(profile, { ...fam, coords: famCoords }, distanceKm, attendingIds)
    return {
      ...fam,
      coords: famCoords,
      distanceKm,
      match,
    }
  })

  const filteredDeck = familiesWithDistance
    .filter((fam) => {
      if (!profile.privacy.discoverable) return false
      if (dismissedIds.includes(fam.id) || matchedIds.includes(fam.id)) return false
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
  const matchedFamilies = familiesWithDistance.filter((f) => matchedIds.includes(f.id))

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

  const toggleEventAttendance = (eventId: string) => {
    const nextGoing = !attendingIds.includes(eventId)
    setAttendingIds((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId],
    )
    recordDemoSelection('EVENT_ATTENDANCE', `${eventId} -> ${nextGoing ? 'GOING' : 'SKIPPED'}`)
  }

  const handleSwipe = (liked: boolean) => {
    if (!currentCard) return
    if (liked) {
      setMatchedIds((prev) => [...prev, currentCard.id])
      setLatestMatch(currentCard)
      recordDemoSelection('SWIPE_LIKE', `${currentCard.id} (MATCH ${currentCard.match.percent}%)`)
    } else {
      setDismissedIds((prev) => [...prev, currentCard.id])
      recordDemoSelection('SWIPE_PASS', currentCard.id)
    }
  }

  const openOnMap = (coords: [number, number], label = 'coords') => {
    setMapFocusCoords(resolveCoordsTuple(coords, safeHomeCoords))
    setActiveTab('map')
    recordDemoSelection('MAP_FOCUS', label)
  }

  const handleResetMapBounds = useCallback(() => {
    setMapFocusCoords(null)
    recordDemoSelection('MAP_HOME_ZOOM', 'PKS_SEUTULA_BOUNDS')
  }, [recordDemoSelection])

  const totalParentsCount = 1 + profile.coParents.length
  const activePreviewInvite = profile.coParents.find((p) => p.id === previewInviteId) ?? null
  const latestDbEntry = dbFeedLog[0] ?? null

  return (
    <div className="min-h-dvh bg-zinc-900 sm:py-5 sm:px-4 flex justify-center items-center">
      <div className="w-full max-w-[430px] sm:max-w-4xl bg-slate-50 h-dvh sm:h-[92dvh] sm:max-h-[1180px] flex flex-col shadow-2xl border-x sm:border-[3px] border-slate-800 sm:rounded-[2rem] relative overflow-hidden transition-all duration-300">
        {authStatus === 'loading' ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-xs text-slate-600">
            <span className="text-2xl animate-pulse">🔐</span>
            <p>Tarkistetaan Google-kirjautumista...</p>
          </div>
        ) : authStatus === 'unauthenticated' || !currentUser ? (
          <div className="flex-1 overflow-y-auto p-6 sm:p-10 flex flex-col justify-center">
            <div className="max-w-md mx-auto w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-lg space-y-6 text-center">
              <div className="space-y-2">
                <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                  PerhePiiri • Google OAuth 2.0
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Perhe<span className="text-emerald-600">Piiri</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Kirjaudu sisään omalla Google-tililläsi, niin asetat oman kotiseudun, hallitset
                  omia perheenjäseniä ja tallennat tietosi omaan profiiliisi.
                </p>
              </div>

              {authErrorMessage && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 text-left">
                  {authErrorMessage}
                </div>
              )}

              <button
                type="button"
                disabled={authRedirecting}
                onClick={() => void startGoogleSignIn()}
                className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-50 active:bg-slate-100 border-2 border-slate-300 text-slate-900 font-bold text-sm shadow-sm flex items-center justify-center gap-3 transition-all disabled:opacity-60"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                <span>
                  {authRedirecting
                    ? 'Siirrytään Google-kirjautumiseen...'
                    : 'Kirjaudu Google-tilillä'}
                </span>
              </button>
            </div>
          </div>
        ) : (
          <>
            <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-2 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                    Perhe<span className="text-emerald-600">Piiri</span>
                  </h1>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-bold truncate">
                    {currentUser.avatarUrl ? (
                      <img
                        src={currentUser.avatarUrl}
                        alt=""
                        className="w-3.5 h-3.5 rounded-full"
                      />
                    ) : (
                      <span>G</span>
                    )}
                    <span className="truncate">{currentUser.displayName}</span>
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                  🟠 {profile.homeCity} ({profile.area}) • haku max {profile.filters.maxDistanceKm}{' '}
                  km
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowDemoMonitor((prev) => !prev)}
                  className="px-2 py-1 rounded-full bg-zinc-900 text-amber-400 text-[10px] font-mono font-bold hover:bg-zinc-800"
                >
                  {showDemoMonitor ? '◼ Demo-Log' : '◻ Demo-Log'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNerdDbFloat((prev) => !prev)}
                  className="px-2 py-1 rounded-full bg-indigo-950 text-cyan-300 text-[10px] font-mono font-bold hover:bg-indigo-900"
                >
                  {showNerdDbFloat ? '◼ DB-Feed' : '◻ DB-Feed'}
                </button>
                <button
                  type="button"
                  disabled={authRedirecting}
                  onClick={() => void signOutGoogleSession()}
                  className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Ulos
                </button>
              </div>
            </header>

            {latestMatch && (
              <div className="bg-emerald-600 text-white px-4 sm:px-6 py-3 flex items-center justify-between gap-2 shrink-0">
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

            <main className="flex-1 overflow-y-auto">
              {activeTab === 'events' && (
                <EventsTabPanel
                  profile={profile}
                  sourceBadge={sourceBadge}
                  eventFeedStatus={eventFeedStatus}
                  filteredSortedEvents={filteredSortedEvents}
                  baseAreaSortedEventsCount={baseAreaSortedEvents.length}
                  matchedFamilies={matchedFamilies}
                  attendingIds={attendingIds}
                  eventAgeFilter={eventAgeFilter}
                  onEventAgeFilterChange={setEventAgeFilter}
                  eventSearchQuery={eventSearchQuery}
                  onEventSearchQueryChange={setEventSearchQuery}
                  hasActiveQuickEventFilter={hasActiveQuickEventFilter}
                  ignoreDefaultPresetTemp={ignoreDefaultPresetTemp}
                  onToggleDefaultPreset={() =>
                    setIgnoreDefaultPresetTemp((prev) => !prev)
                  }
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
                  onToggleEventAttendance={toggleEventAttendance}
                  onOpenEventChat={(eventId) =>
                    openHubChannel('event_chat', { eventId })
                  }
                  onLogSelection={recordDemoSelection}
                  onOpenMap={openOnMap}
                />
              )}

              {activeTab === 'families' && (
                <FamiliesTabPanel
                  familySubTab={familySubTab}
                  filteredDeckCount={filteredDeck.length}
                  matchedFamilies={matchedFamilies}
                  currentCard={currentCard}
                  profile={profile}
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
                    setDismissedIds([])
                    recordDemoSelection('DISMISSED_RESET', currentUser.id)
                  }}
                  onOpenMap={openOnMap}
                  onOpenMatchesChat={(familyId) =>
                    openHubChannel('matches', { directTargetId: familyId })
                  }
                />
              )}

              {activeTab === 'hub' && (
                <CommunityHubPanel
                  key={hubMountKey}
                  currentUser={currentUser}
                  profile={profile}
                  events={baseAreaSortedEvents}
                  attendingIds={attendingIds}
                  matchedIds={matchedIds}
                  allFamilies={familiesWithDistance}
                  directMessages={messages}
                  onSendDirectMessage={(familyId, text) => {
                    setMessages((prev) => ({
                      ...prev,
                      [familyId]: [...(prev[familyId] || []), text],
                    }))
                    recordDemoSelection('DIRECT_MSG', familyId)
                  }}
                  onSwipeMatchFromEvent={(familyId) => {
                    const fam = familiesWithDistance.find((f) => f.id === familyId)
                    if (!fam || matchedIds.includes(familyId)) return
                    setMatchedIds((prev) => [...prev, familyId])
                    setLatestMatch(fam)
                    recordDemoSelection('EVENT_MATCH', familyId)
                  }}
                  onToggleAttendance={toggleEventAttendance}
                  initialSection={hubInitialSection}
                  initialEventId={hubEventId}
                  initialDirectTargetId={hubDirectTargetId}
                />
              )}

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

              {activeTab === 'profile' && profileSubView === 'main' && (
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

              {activeTab === 'profile' && profileSubView === 'members' && (
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

              {activeTab === 'profile' && profileSubView === 'store_inspector' && (
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
              <div className="absolute inset-0 bg-slate-900/50 z-50 flex items-end sm:items-center sm:justify-center sm:p-4">
                <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 space-y-3 shadow-xl">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">
                        ✉️ Kutsulinkin esikatselu
                      </h3>
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
                      <span className="font-semibold text-slate-600">
                        Perhe: {profile.familyName}
                      </span>
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

            <nav className="bg-white border-t border-slate-200 grid grid-cols-5 py-2 shrink-0">
              {[
                { key: 'events', icon: '📅', label: 'Tapahtumat' },
                { key: 'families', icon: '🤝', label: 'Perheet' },
                { key: 'hub', icon: '💬', label: 'Keskustelut' },
                { key: 'map', icon: '🗺️', label: 'Kartta' },
                { key: 'profile', icon: '👤', label: 'Profiili' },
              ].map((tab) => {
                const active = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.key as TabKey)
                      if (tab.key === 'profile') setProfileSubView('main')
                      recordDemoSelection('TAB_SELECT', tab.key)
                    }}
                    className={`flex flex-col items-center justify-center gap-0.5 py-1 transition-colors ${
                      active ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span className="text-lg leading-none">{tab.icon}</span>
                    <span className="text-[11px]">{tab.label}</span>
                  </button>
                )
              })}
            </nav>
          </>
        )}
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
    </div>
  )
}