'use client'

import React, { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  AuthenticatedGoogleUser,
  DEFAULT_ACTIVITY_TAGS,
  FamilyEvent,
  FamilyProfile,
  UserProfileState,
} from './protoData'
import type {
  ActiveEventChatChannel,
  EventChatChannel,
  EventChatMessage,
  EventParticipationRecord,
} from './hooks/useEventChatAndParticipations'

export type HubSection = 'matches' | 'board' | 'event_chat' | 'data_transparency'

export interface ForumReply {
  id: string
  authorId: string
  displayAuthor: string
  isAnonymousNickname: boolean
  body: string
  createdAt: string
}

export interface ForumThread {
  id: string
  roomId: string
  title: string
  authorId: string
  displayAuthor: string
  isAnonymousNickname: boolean
  body: string
  createdAt: string
  replies: ForumReply[]
}

export interface EventRoomMessage {
  id: string
  eventId: string
  authorFamilyId: string
  authorNickname: string
  authorRealName: string
  body: string
  createdAt: string
}

export interface TopicRoom {
  id: string
  name: string
  description: string
  badge: string
}

interface OwnedEventChatOption extends EventChatChannel {
  eventId: string
}

interface PersistedCommunityState {
  threads: ForumThread[]
  eventMessagesById: Record<string, EventRoomMessage[]>
  nicknameInput: string
  useNicknameInBoard: boolean
  anonLabelInput: string
}

const COMMUNITY_STORAGE_PREFIX = 'perhepiiri_community_v1_'

function formatChatTimestamp(value: string): string {
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime())
    ? ''
    : timestamp.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' })
}

const TOPIC_ROOMS: TopicRoom[] = [
  {
    id: 'general',
    name: 'Yleinen',
    description: 'PKS-perheiden yhteinen yleiskeskustelu ja arjen vinkit',
    badge: 'Yleinen',
  },
  {
    id: 'room-0-3',
    name: '0–3 v & perhekahvilat',
    description: 'Vauva- ja taaperoarki, unet, leikkipuistot ja kerhot',
    badge: '0–3v',
  },
  {
    id: 'room-outdoors',
    name: 'Ulkoilu, retket & liikunta',
    description: 'Lähipuistot, uimahallit, luontopolut ja viikonloppuretket',
    badge: 'Ulkoilu',
  },
  {
    id: 'room-new-families',
    name: 'Uudet alueella & vertaistuki',
    description: 'Matalan kynnyksen juttua ja arjen jakamista',
    badge: 'Vertaistuki',
  },
]

const INITIAL_THREADS: ForumThread[] = [
  {
    id: 'thr-1',
    roomId: 'general',
    title: 'Parhaat sateisen päivän menovinkit Espoossa ja Helsingissä?',
    authorId: 'fam-1',
    displayAuthor: 'PuistoKettu',
    isAnonymousNickname: true,
    body: 'Kirjastot ja museot toimivat aina, mutta onko vinkkejä maksuttomiin tai edullisiin paikkoihin pienten kanssa?',
    createdAt: 'Tänään 10:15',
    replies: [
      {
        id: 'rep-1',
        authorId: 'fam-2',
        displayAuthor: 'EspooRetkeilijä',
        isAnonymousNickname: true,
        body: 'Sellon kirjasto ja lähipuistojen katokset on testattu toimiviksi — varsinkin kun sattuu samanikäistä juttuseuraa.',
        createdAt: 'Tänään 10:42',
      },
    ],
  },
  {
    id: 'thr-2',
    roomId: 'room-outdoors',
    title: 'Sunnuntain ulkoiluseuraa Leppävaaran suunnalta?',
    authorId: 'fam-1',
    displayAuthor: 'Mäkelän perhe',
    isAnonymousNickname: false,
    body: 'Olemme menossa ulkoilemaan aamupäivällä ja eväät mukana. Mahtuuko mukaan?',
    createdAt: 'Eilen 18:20',
    replies: [],
  },
]

const INITIAL_EVENT_ROOM_MESSAGES: Record<string, EventRoomMessage[]> = {
  'evt-1': [
    {
      id: 'emsg-1',
      eventId: 'evt-1',
      authorFamilyId: 'fam-2',
      authorNickname: 'Anonyymi perhe #2',
      authorRealName: 'Lindholmin perhe',
      body: 'Me ollaan tulossa eväiden kanssa n. klo 10:05. Näkyykö puiston portilla?',
      createdAt: '11:05',
    },
    {
      id: 'emsg-2',
      eventId: 'evt-1',
      authorFamilyId: 'fam-1',
      authorNickname: 'Anonyymi perhe #1',
      authorRealName: 'Mäkelän perhe',
      body: 'Moi! Ollaan tulossa kans, kiva nähdä!',
      createdAt: '11:12',
    },
  ],
}

function loadCommunityState(userId: string): PersistedCommunityState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(`${COMMUNITY_STORAGE_PREFIX}${userId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedCommunityState>
    if (!parsed || typeof parsed !== 'object') return null

    return {
      threads:
        Array.isArray(parsed.threads) && parsed.threads.length > 0
          ? parsed.threads
          : INITIAL_THREADS,
      eventMessagesById:
        parsed.eventMessagesById && typeof parsed.eventMessagesById === 'object'
          ? parsed.eventMessagesById
          : INITIAL_EVENT_ROOM_MESSAGES,
      nicknameInput:
        typeof parsed.nicknameInput === 'string' && parsed.nicknameInput.trim()
          ? parsed.nicknameInput
          : 'KotiKetunPerhe',
      useNicknameInBoard:
        typeof parsed.useNicknameInBoard === 'boolean' ? parsed.useNicknameInBoard : true,
      anonLabelInput:
        typeof parsed.anonLabelInput === 'string' && parsed.anonLabelInput.trim()
          ? parsed.anonLabelInput
          : 'Anonyymi osallistuja',
    }
  } catch {
    return null
  }
}

interface CommunityHubPanelProps {
  currentUser: AuthenticatedGoogleUser
  profile: UserProfileState
  events: FamilyEvent[]
  matchedIds: string[]
  allFamilies: (
    FamilyProfile & {
      distanceKm: number
      matchChannelId: string
    }
  )[]
  chatChannels: EventChatChannel[]
  participations: EventParticipationRecord[]
  pendingParticipationEventIds: ReadonlySet<string>
  activeChatChannel: ActiveEventChatChannel | null
  chatMessages: EventChatMessage[]
  currentUserEmail: string
  unreadChatChannelIds: ReadonlySet<string>
  isLoadingChatMessages: boolean
  isSendingChatMessage: boolean
  chatError: string | null
  participationError: string | null
  onActiveChatChannelChange: (channel: ActiveEventChatChannel | null) => void
  onSendChatMessage: (body: string) => Promise<boolean>
  onToggleParticipation: (
    eventId: string,
    eventTitle: string,
  ) => Promise<'going' | 'removed' | false>
  initialSection?: HubSection
  initialEventId?: string | null
  initialDirectTargetId?: string | null
}

export function CommunityHubPanel({
  currentUser,
  profile,
  events,
  matchedIds,
  allFamilies,
  chatChannels,
  participations,
  pendingParticipationEventIds,
  activeChatChannel,
  chatMessages,
  currentUserEmail,
  unreadChatChannelIds,
  isLoadingChatMessages,
  isSendingChatMessage,
  chatError,
  participationError,
  onActiveChatChannelChange,
  onSendChatMessage,
  onToggleParticipation,
  initialSection = 'board',
  initialEventId = null,
  initialDirectTargetId = null,
}: CommunityHubPanelProps) {
  const storageKey = `${COMMUNITY_STORAGE_PREFIX}${currentUser.id}`

  const matchedFamilies = useMemo(
    () => allFamilies.filter((f) => matchedIds.includes(f.id)),
    [allFamilies, matchedIds],
  )

  const familyChannels = useMemo(
    () => chatChannels.filter((channel) => channel.id.startsWith('family:')),
    [chatChannels],
  )
  const eventChannels = useMemo(
    () => chatChannels.filter((channel) => channel.id.startsWith('event:')),
    [chatChannels],
  )
  const ownGoingParticipations = useMemo(() => {
    const email = currentUserEmail.trim().toLowerCase()
    return participations.filter(
      (participation) =>
        participation.status === 'going' &&
        participation.participantEmail.trim().toLowerCase() === email,
    )
  }, [currentUserEmail, participations])
  const ownGoingEventIds = useMemo(
    () => new Set(ownGoingParticipations.map((participation) => participation.eventId)),
    [ownGoingParticipations],
  )
  const eventChatOptions = useMemo(() => {
    return ownGoingParticipations.map((participation): OwnedEventChatOption => {
      const channelId = `event:${participation.eventId}`
      const channel = eventChannels.find((item) => item.id === channelId)
      const currentEvent = events.find((event) => event.id === participation.eventId)
      return {
        id: channelId,
        eventId: participation.eventId,
        title: participation.eventTitle || channel?.title || 'Tapahtuma',
        lastMessage: channel?.lastMessage ?? '',
        lastSenderName: channel?.lastSenderName ?? '',
        lastSenderEmail: channel?.lastSenderEmail ?? '',
        lastMessageAt: channel?.lastMessageAt ?? '',
        messageCount: channel?.messageCount ?? 0,
        isEventActive: currentEvent !== undefined,
      }
    })
  }, [eventChannels, events, ownGoingParticipations])

  const [section, setSection] = useState<HubSection>(initialSection)
  const initialMatchedFamily = matchedFamilies.find(
    (family) =>
      family.matchChannelId === initialDirectTargetId ||
      family.id === initialDirectTargetId,
  )
  const [selectedMatchId, setSelectedMatchId] = useState<string>(
    initialMatchedFamily?.id || matchedFamilies[0]?.id || '',
  )
  const activeDirectFamily =
    matchedFamilies.find((f) => f.id === selectedMatchId) || matchedFamilies[0] || null
  const [directInput, setDirectInput] = useState('')

  // Keskustelupalsta (Yleinen + aihehuoneet)
  const [activeRoomId, setActiveRoomId] = useState<string>('general')
  const [threads, setThreads] = useState<ForumThread[]>(INITIAL_THREADS)
  const [selectedThreadId, setSelectedThreadId] = useState<string>(INITIAL_THREADS[0]?.id || '')
  const [newThreadTitle, setNewThreadTitle] = useState('')
  const [newThreadBody, setNewThreadBody] = useState('')
  const [replyInput, setReplyInput] = useState('')
  const [useNicknameInBoard, setUseNicknameInBoard] = useState(true)
  const [nicknameInput, setNicknameInput] = useState('KotiKetunPerhe')

  // Tapahtuman "Menossa"-chat (oletuksena anonyymi, paitsi jos mätsätty)
  const [selectedEventId, setSelectedEventId] = useState<string>(
    initialEventId || ownGoingParticipations[0]?.eventId || '',
  )
  const [showingEventThread, setShowingEventThread] = useState(false)
  const [eventMessagesById, setEventMessagesById] = useState<Record<string, EventRoomMessage[]>>(
    INITIAL_EVENT_ROOM_MESSAGES,
  )
  const [eventChatInput, setEventChatInput] = useState('')
  const [anonLabelInput, setAnonLabelInput] = useState('Anonyymi osallistuja')
  const [communityHydrated, setCommunityHydrated] = useState(false)
  const [resetCommunityToast, setResetCommunityToast] = useState(false)

  const initializedChatSectionRef = useRef(false)

  useEffect(() => {
    const channelId = activeChatChannel?.id
    if (channelId?.startsWith('family:')) {
      const family = matchedFamilies.find((item) => item.matchChannelId === channelId)
      setSelectedMatchId(family?.id ?? '')
    } else if (channelId?.startsWith('event:')) {
      setSelectedEventId(channelId.slice('event:'.length))
    }
  }, [activeChatChannel?.id, matchedFamilies])

  useEffect(() => {
    const channelId = activeChatChannel?.id
    const eventId = channelId?.startsWith('event:') ? channelId.slice('event:'.length) : ''
    setShowingEventThread(
      section === 'event_chat' && !!eventId && ownGoingEventIds.has(eventId),
    )
  }, [activeChatChannel?.id, ownGoingEventIds, section])

  useEffect(() => {
    if (initializedChatSectionRef.current) return
    initializedChatSectionRef.current = true
    if (section === 'matches' && activeDirectFamily) {
      onActiveChatChannelChange({
        id: activeDirectFamily.matchChannelId,
        title: activeDirectFamily.name,
      })
    } else if (section === 'event_chat' && selectedEventId) {
      const eventOption = eventChatOptions.find(
        (channel) => channel.id === `event:${selectedEventId}`,
      )
      if (eventOption) {
        onActiveChatChannelChange({ id: eventOption.id, title: eventOption.title })
      }
    }
  }, [
    section,
    activeDirectFamily,
    selectedEventId,
    eventChatOptions,
    onActiveChatChannelChange,
  ])

  useEffect(() => {
    const saved = loadCommunityState(currentUser.id)
    if (saved) {
      setThreads(saved.threads)
      setEventMessagesById(saved.eventMessagesById)
      setNicknameInput(saved.nicknameInput)
      setUseNicknameInBoard(saved.useNicknameInBoard)
      setAnonLabelInput(saved.anonLabelInput)
      const firstInDefaultRoom = saved.threads.find((t) => t.roomId === 'general')
      if (firstInDefaultRoom) {
        setSelectedThreadId(firstInDefaultRoom.id)
      }
    }
    setCommunityHydrated(true)
  }, [currentUser.id])

  useEffect(() => {
    if (!communityHydrated || typeof window === 'undefined') return
    try {
      const payload: PersistedCommunityState = {
        threads,
        eventMessagesById,
        nicknameInput,
        useNicknameInBoard,
        anonLabelInput,
      }
      window.localStorage.setItem(storageKey, JSON.stringify(payload))
    } catch {
      // Ohitetaan selaimen tallennusrajoitukset
    }
  }, [
    communityHydrated,
    storageKey,
    threads,
    eventMessagesById,
    nicknameInput,
    useNicknameInBoard,
    anonLabelInput,
  ])

  const resetCommunityLocalStorage = () => {
    setThreads(INITIAL_THREADS)
    setSelectedThreadId(INITIAL_THREADS[0]?.id || '')
    setEventMessagesById(INITIAL_EVENT_ROOM_MESSAGES)
    setNicknameInput('KotiKetunPerhe')
    setUseNicknameInBoard(true)
    setAnonLabelInput('Anonyymi osallistuja')
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(storageKey)
      } catch {
        // Ohitetaan virheet
      }
    }
    setResetCommunityToast(true)
    setTimeout(() => setResetCommunityToast(false), 2500)
  }

  const roomThreads = useMemo(
    () => threads.filter((t) => t.roomId === activeRoomId),
    [threads, activeRoomId],
  )

  const activeThread =
    roomThreads.find((t) => t.id === selectedThreadId) || roomThreads[0] || null

  const activeEvent = events.find((event) => event.id === selectedEventId) || null

  const totalEventChatMessagesCount = useMemo(
    () => eventChatOptions.reduce((total, channel) => total + channel.messageCount, 0),
    [eventChatOptions],
  )

  const setHubSection = (nextSection: HubSection) => {
    setSection(nextSection)
    if (nextSection === 'matches' && activeDirectFamily) {
      onActiveChatChannelChange({
        id: `family:${activeDirectFamily.id}`,
        title: activeDirectFamily.name,
      })
    } else if (nextSection === 'event_chat' && selectedEventId) {
      const eventOption = eventChatOptions.find(
        (channel) => channel.eventId === selectedEventId,
      )
      if (eventOption) {
        onActiveChatChannelChange({ id: eventOption.id, title: eventOption.title })
      }
      setShowingEventThread(false)
    }
  }

  const selectedFamilyChannelId = activeDirectFamily
    ? `family:${activeDirectFamily.id}`
    : null
  const selectedFamilyChatMessages =
    selectedFamilyChannelId && activeChatChannel?.id === selectedFamilyChannelId
      ? chatMessages
      : []
  const selectedEventChatOption = eventChatOptions.find(
    (channel) => channel.id === activeChatChannel?.id,
  )
  const selectedEventParticipation = selectedEventChatOption
    ? ownGoingParticipations.find(
        (participation) => participation.eventId === selectedEventChatOption.eventId,
      )
    : undefined

  const handleFamilyChatSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (
      !activeDirectFamily ||
      activeChatChannel?.id !== `family:${activeDirectFamily.id}` ||
      !directInput.trim()
    ) {
      return
    }
    const body = directInput.trim()
    onActiveChatChannelChange({
      id: `family:${activeDirectFamily.id}`,
      title: activeDirectFamily.name,
    })
    if (await onSendChatMessage(body)) setDirectInput('')
  }

  const handleEventChatSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (
      !activeChatChannel?.id.startsWith('event:') ||
      activeChatChannel.id !== selectedEventChatOption?.id ||
      !eventChatInput.trim()
    ) {
      return
    }
    const activeOption = eventChatOptions.find(
      (channel) => channel.id === activeChatChannel.id,
    )
    if (!activeOption || !activeOption.isEventActive) return
    const body = eventChatInput.trim()
    if (await onSendChatMessage(body)) setEventChatInput('')
  }

  const getBoardAuthorLabel = () => {
    if (!useNicknameInBoard) {
      return profile.familyName || currentUser.displayName
    }
    return nicknameInput.trim() || 'Nimimerkki'
  }

  const handleCreateThread = () => {
    const title = newThreadTitle.trim()
    const body = newThreadBody.trim()
    if (!title || !body) return

    const newThread: ForumThread = {
      id: `thr-${Date.now()}`,
      roomId: activeRoomId,
      title,
      authorId: currentUser.id,
      displayAuthor: getBoardAuthorLabel(),
      isAnonymousNickname: useNicknameInBoard,
      body,
      createdAt: 'Juuri nyt',
      replies: [],
    }
    setThreads((prev) => [newThread, ...prev])
    setSelectedThreadId(newThread.id)
    setNewThreadTitle('')
    setNewThreadBody('')
  }

  const handleAddReply = () => {
    const body = replyInput.trim()
    if (!body || !activeThread) return

    const reply: ForumReply = {
      id: `rep-${Date.now()}`,
      authorId: currentUser.id,
      displayAuthor: getBoardAuthorLabel(),
      isAnonymousNickname: useNicknameInBoard,
      body,
      createdAt: 'Juuri nyt',
    }

    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThread.id ? { ...t, replies: [...t.replies, reply] } : t,
      ),
    )
    setReplyInput('')
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 pb-8">
      {/* Ylänavigaatio: emoji-ikonit ilman A/B/C-koodeja */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs font-bold">
        <button
          type="button"
          onClick={() => setHubSection('matches')}
          className={`py-2 px-2.5 rounded-xl transition-colors ${
            section === 'matches'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          🤝 Mätsien chat ({matchedFamilies.length})
        </button>
        <button
          type="button"
          onClick={() => setHubSection('board')}
          className={`py-2 px-2.5 rounded-xl transition-colors ${
            section === 'board'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          🗣️ Huonepalsta ({threads.length})
        </button>
        <button
          type="button"
          onClick={() => setHubSection('event_chat')}
          className={`py-2 px-2.5 rounded-xl transition-colors ${
            section === 'event_chat'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          🗓️ Tapahtumachat ({totalEventChatMessagesCount})
        </button>
        <button
          type="button"
          onClick={() => setHubSection('data_transparency')}
          className={`py-2 px-2.5 rounded-xl transition-colors ${
            section === 'data_transparency'
              ? 'bg-indigo-900 text-cyan-200'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          🔍 Data & Tietosuoja
        </button>
      </div>

      {/* Yksityisviestit vain mätsänneiden perheiden kesken */}
      {section === 'matches' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
          <div className="bg-white rounded-2xl p-3 border border-slate-200 space-y-2">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide px-1">
              Mätsänneet perheet
            </h2>
            {matchedFamilies.length === 0 ? (
              <p className="text-xs text-slate-500 p-2">
                Ei vielä mätsättyjä perheitä. Verkostoidu Perheet-välilehdellä avataksesi
                suoran chatin.
              </p>
            ) : (
              matchedFamilies.map((fam) => {
                const active = activeChatChannel?.id === fam.matchChannelId
                const channelId = fam.matchChannelId
                const channel = familyChannels.find((item) => item.id === channelId)
                return (
                  <button
                    key={fam.id}
                    type="button"
                    onClick={() => {
                      setSelectedMatchId(fam.id)
                      onActiveChatChannelChange({ id: channelId, title: fam.name })
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border text-xs transition-colors ${
                      active
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{fam.name}</span>
                      {unreadChatChannelIds.has(channelId) && (
                        <span className="shrink-0 rounded-full bg-rose-600 px-1.5 py-0.5 text-[9px] text-white">
                          Uusi
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 font-normal">
                      {fam.area} • {fam.distanceKm} km
                      {channel ? ` • ${channel.messageCount} viestiä` : ''}
                    </div>
                    {channel?.lastMessage && (
                      <div className="mt-1 truncate text-[10px] font-normal text-slate-600">
                        {channel.lastSenderName}: {channel.lastMessage}
                      </div>
                    )}
                  </button>
                )
              })
            )}
          </div>

          <div className="sm:col-span-2 bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
            {activeDirectFamily ? (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      🤝 Kahdenkeskinen osumachat
                    </span>
                    <h3 className="text-sm font-extrabold text-slate-900 mt-1">
                      {activeDirectFamily.name}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {activeDirectFamily.area} • Lapset: {activeDirectFamily.childrenAges}
                    </p>
                  </div>
                </div>

                {chatError && (
                  <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs text-rose-800">
                    {chatError}
                  </p>
                )}
                <div className="h-48 overflow-y-auto bg-slate-50 rounded-xl p-3 space-y-2 text-xs">
                  {activeChatChannel?.id !== selectedFamilyChannelId ? (
                    <p className="text-slate-400 text-center pt-14">
                      Valitse perhe avataksesi sen erillisen mätsiketjun.
                    </p>
                  ) : isLoadingChatMessages && selectedFamilyChatMessages.length === 0 ? (
                    <p className="text-slate-400 text-center pt-14">Ladataan viestejä...</p>
                  ) : selectedFamilyChatMessages.length === 0 ? (
                    <p className="text-slate-400 text-center pt-14">
                      Lähetä ensimmäinen viesti perheelle {activeDirectFamily.name}.
                    </p>
                  ) : (
                    selectedFamilyChatMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`max-w-[88%] rounded-2xl px-3 py-2 ${
                          message.senderEmail.trim().toLowerCase() ===
                          currentUserEmail.trim().toLowerCase()
                            ? 'ml-auto rounded-br-none bg-emerald-600 text-white'
                            : 'rounded-bl-none bg-white text-slate-900'
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2 text-[9px] opacity-75">
                          <span>{message.senderName}</span>
                          <time dateTime={message.createdAt}>
                            {formatChatTimestamp(message.createdAt)}
                          </time>
                        </div>
                        <p className="whitespace-pre-wrap break-words">{message.body}</p>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={(event) => void handleFamilyChatSubmit(event)} className="flex gap-2">
                  <input
                    value={directInput}
                    onChange={(e) => setDirectInput(e.target.value)}
                    disabled={activeChatChannel?.id !== selectedFamilyChannelId}
                    maxLength={2000}
                    placeholder="Kirjoita yksityisviesti mätsille..."
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={
                      !directInput.trim() ||
                      isSendingChatMessage ||
                      activeChatChannel?.id !== selectedFamilyChannelId
                    }
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {isSendingChatMessage ? '...' : 'Lähetä'}
                  </button>
                </form>
              </>
            ) : (
              <p className="text-xs text-slate-500 py-8 text-center">
                Valitse mätsännyt perhe vasemmalta.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Keskustelupalsta — Yleinen + aihehuoneet, nimimerkki tai oma nimi */}
      {section === 'board' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-3.5 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  🗣️ Yhteisöpalsta & aihehuoneet
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  ✓ Tallentuu selaimeen
                </span>
              </div>
              <p className="text-slate-600 pt-1">
                Valitse kirjoitatko palstalle <strong>nimimerkillä</strong> vai{' '}
                <strong>omalla perhenimellä</strong>.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <label className="inline-flex items-center gap-1.5 font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useNicknameInBoard}
                  onChange={(e) => setUseNicknameInBoard(e.target.checked)}
                  className="accent-emerald-600 w-4 h-4"
                />
                <span>Käytä nimimerkkiä</span>
              </label>
              {useNicknameInBoard && (
                <input
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  placeholder="Nimimerkki"
                  className="w-36 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {TOPIC_ROOMS.map((room) => {
              const active = room.id === activeRoomId
              const count = threads.filter((t) => t.roomId === room.id).length
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => {
                    setActiveRoomId(room.id)
                    const firstInRoom = threads.find((t) => t.roomId === room.id)
                    setSelectedThreadId(firstInRoom?.id || '')
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {room.name} ({count})
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div className="space-y-3">
              <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase">
                  Uusi ketju huoneeseen: {TOPIC_ROOMS.find((r) => r.id === activeRoomId)?.name}
                </h3>
                <input
                  value={newThreadTitle}
                  onChange={(e) => setNewThreadTitle(e.target.value)}
                  placeholder="Ketjun otsikko..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
                <textarea
                  rows={2}
                  value={newThreadBody}
                  onChange={(e) => setNewThreadBody(e.target.value)}
                  placeholder="Kirjoita aloitusviesti..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
                <button
                  type="button"
                  onClick={handleCreateThread}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
                >
                  + Julkaise ketju ({getBoardAuthorLabel()})
                </button>
              </div>

              <div className="space-y-2">
                {roomThreads.length === 0 ? (
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 text-xs text-slate-500 text-center">
                    Tässä huoneessa ei ole vielä ketjuja. Aloita ensimmäinen keskustelu!
                  </div>
                ) : (
                  roomThreads.map((thr) => {
                    const selected = activeThread?.id === thr.id
                    return (
                      <button
                        key={thr.id}
                        type="button"
                        onClick={() => setSelectedThreadId(thr.id)}
                        className={`w-full text-left p-3.5 rounded-2xl border transition-colors ${
                          selected
                            ? 'bg-emerald-50/70 border-emerald-300'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                          <span>
                            {thr.isAnonymousNickname ? '🎭' : '👤'} <strong>{thr.displayAuthor}</strong>
                          </span>
                          <span>{thr.replies.length} vastausta</span>
                        </div>
                        <p className="text-sm font-bold text-slate-900 mt-1">{thr.title}</p>
                        <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">{thr.body}</p>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
              {activeThread ? (
                <>
                  <div className="border-b border-slate-100 pb-2.5 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        {activeThread.isAnonymousNickname ? '🎭 Nimimerkki' : '👤 Oma nimi'}:{' '}
                        <strong>{activeThread.displayAuthor}</strong>
                      </span>
                      <span>{activeThread.createdAt}</span>
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900">{activeThread.title}</h3>
                    <p className="text-xs text-slate-700 leading-relaxed">{activeThread.body}</p>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {activeThread.replies.map((rep) => (
                      <div
                        key={rep.id}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1"
                      >
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <strong>
                            {rep.isAnonymousNickname ? '🎭' : '👤'} {rep.displayAuthor}
                          </strong>
                          <span>{rep.createdAt}</span>
                        </div>
                        <p className="text-slate-700">{rep.body}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <input
                      value={replyInput}
                      onChange={(e) => setReplyInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddReply()}
                      placeholder={`Vastaa nimellä ${getBoardAuthorLabel()}...`}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddReply}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                    >
                      Vastaa
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-500 py-8 text-center">
                  Valitse ketju vasemmalta nähdäksesi keskustelun.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tapahtumachat käyttää vain event:-kanavia. */}
      {section === 'event_chat' && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                  🗓️ Tapahtumakeskustelut
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {eventChatOptions.length} omaa “Menossa”-tapahtumaa
                </span>
              </div>
              <h2 className="text-sm font-extrabold text-slate-900 mt-1">
                Tapahtumakohtaiset keskusteluketjut
              </h2>
              <p className="text-xs text-slate-500">
                Tapahtumaviestit pysyvät erillään mätsien yksityisviesteistä ja huonepalstasta.
              </p>
            </div>
          </div>

          {chatError && (
            <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs text-rose-800">
              {chatError}
            </p>
          )}

          {(!showingEventThread || !selectedEventChatOption) && (
            <div className="space-y-2">
            {eventChatOptions.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                Et ole merkinnyt itseäsi “Menossa” yhteenkään tapahtumaan.
              </p>
            ) : (
              eventChatOptions.map((channel) => {
                const active = activeChatChannel?.id === channel.id
                const eventId = channel.eventId
                const unread = unreadChatChannelIds.has(channel.id)
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => {
                      setSelectedEventId(eventId)
                      setShowingEventThread(true)
                      onActiveChatChannelChange({ id: channel.id, title: channel.title })
                    }}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      active
                        ? 'border-amber-400 bg-amber-50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold text-slate-900">
                          {channel.title}
                        </span>
                        <span
                          className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold ${
                            channel.isEventActive
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {channel.isEventActive
                            ? 'Aktiivinen tapahtuma'
                            : 'Päättynyt tapahtuma — vain historia'}
                        </span>
                      </span>
                      {unread && (
                        <span className="shrink-0 rounded-full bg-rose-600 px-2 py-0.5 text-[9px] font-bold text-white">
                          Uusi viesti
                        </span>
                      )}
                    </span>
                    {channel.messageCount === 0 ? (
                      <span className="mt-1 block text-[10px] text-slate-500">
                        Ei vielä viestejä — avaa ja aloita keskustelu
                      </span>
                    ) : (
                      <>
                        <span className="mt-1 block truncate text-[10px] text-slate-600">
                          {channel.lastSenderName}: {channel.lastMessage}
                        </span>
                        <span className="mt-1 block text-[9px] text-slate-500">
                          {channel.messageCount} viestiä
                          {channel.lastMessageAt
                            ? ` • ${formatChatTimestamp(channel.lastMessageAt)}`
                            : ''}
                        </span>
                      </>
                    )}
                  </button>
                )
              })
            )}
            </div>
          )}

          {showingEventThread &&
            selectedEventChatOption &&
            activeChatChannel?.id.startsWith('event:') && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setShowingEventThread(false)
                  onActiveChatChannelChange(null)
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                ← Takaisin omiin tapahtumakeskusteluihin
              </button>
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div>
                  <strong>{selectedEventChatOption.title}</strong>
                  {activeEvent?.id === selectedEventId
                    ? ` • ${activeEvent.venue} (${activeEvent.time})`
                    : ''}
                  <span
                    className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold ${
                      selectedEventChatOption.isEventActive
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {selectedEventChatOption.isEventActive
                      ? 'Aktiivinen tapahtuma'
                      : 'Päättynyt tapahtuma — vain historia'}
                  </span>
                </div>
                {selectedEventParticipation && (
                  <button
                    type="button"
                    disabled={pendingParticipationEventIds.has(
                      selectedEventParticipation.eventId,
                    )}
                    onClick={() =>
                      void onToggleParticipation(
                        selectedEventParticipation.eventId,
                        selectedEventChatOption.title,
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {pendingParticipationEventIds.has(selectedEventParticipation.eventId)
                      ? 'Päivitetään...'
                      : 'Poista Menossa'}
                  </button>
                )}
              </div>

              {participationError && (
                <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs text-rose-800">
                  {participationError}
                </p>
              )}
              {chatError && (
                <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs text-rose-800">
                  {chatError}
                </p>
              )}
              <div className="h-52 overflow-y-auto bg-slate-50 rounded-xl p-3 space-y-2.5 text-xs">
                {isLoadingChatMessages && chatMessages.length === 0 ? (
                  <p className="text-slate-400 text-center pt-16">Ladataan viestejä...</p>
                ) : activeChatChannel?.id !== selectedEventChatOption.id ||
                  chatMessages.length === 0 ? (
                  <p className="text-slate-400 text-center pt-16">
                    Ei vielä viestejä — avaa ja aloita keskustelu.
                  </p>
                ) : (
                  chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-[88%] rounded-xl border p-2.5 ${
                        message.senderEmail.trim().toLowerCase() ===
                        currentUserEmail.trim().toLowerCase()
                          ? 'ml-auto border-emerald-200 bg-emerald-50'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-slate-500">
                        <strong>
                          {message.senderEmail.trim().toLowerCase() ===
                          currentUserEmail.trim().toLowerCase()
                            ? 'Sinä'
                            : message.senderName}
                        </strong>
                        <time dateTime={message.createdAt}>
                          {formatChatTimestamp(message.createdAt)}
                        </time>
                      </div>
                      <p className="whitespace-pre-wrap break-words text-slate-800">
                        {message.body}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={(event) => void handleEventChatSubmit(event)} className="flex gap-2">
                <input
                  value={eventChatInput}
                  onChange={(event) => setEventChatInput(event.target.value)}
                  maxLength={2000}
                  disabled={
                    !selectedEventChatOption.isEventActive ||
                    activeChatChannel?.id !== selectedEventChatOption.id ||
                    !selectedEventParticipation
                  }
                  placeholder={
                    !selectedEventChatOption.isEventActive
                      ? 'Päättyneen tapahtuman keskustelu on vain luettavissa.'
                      : 'Kirjoita tapahtumaviesti...'
                  }
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs disabled:bg-slate-100"
                />
                <button
                  type="submit"
                  disabled={
                    !eventChatInput.trim() ||
                    isSendingChatMessage ||
                    !selectedEventChatOption.isEventActive ||
                    activeChatChannel?.id !== selectedEventChatOption.id ||
                    !selectedEventParticipation
                  }
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isSendingChatMessage ? '...' : 'Lähetä'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* EU-tietosuoja- ja läpinäkyvyysnäkymä */}
      {section === 'data_transparency' && (
        <div className="bg-slate-950 text-indigo-50 rounded-2xl p-4 sm:p-5 border border-indigo-700/60 space-y-4 text-xs">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1">
              <span className="inline-block px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold">
                🔍 DATA & TIETOSUOJA-INSPEKTORI
              </span>
              <h2 className="text-base font-extrabold text-white">
                Mitä tietoa käsitellään ja missä se sijaitsee?
              </h2>
              <p className="text-indigo-200/80">
                Avoimuusnäkymä käyttäjälle: näet suoraan, mikä data on perheprofiilissa, mikä
                selaimen localStoragessa ja miten anonymiteetti toimii.
              </p>
            </div>
            <button
              type="button"
              onClick={resetCommunityLocalStorage}
              className="px-3 py-2 rounded-xl bg-indigo-900 hover:bg-indigo-800 border border-indigo-500/60 text-cyan-200 text-xs font-bold shrink-0"
            >
              {resetCommunityToast
                ? '✓ Paikallinen palstadata palautettu!'
                : 'Nollaa paikallinen palstahistoria'}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <section className="rounded-xl border border-emerald-700/50 bg-indigo-950/80 p-3 space-y-2">
              <h3 className="font-bold text-emerald-300">🤝 Mätsien chat — luottamuspiiri</h3>
              <p className="text-[11px] text-indigo-100/90">
                Kanava <code>family:&lt;matchId&gt;</code> on vain kahden perheen välinen
                yksityiskeskustelu. Se avautuu vasta molemminpuolisen hyväksynnän jälkeen (
                {matchedIds.length} mätsiä), ja keskustelussa käytetään omaa nimeä.
              </p>
              <p className="text-[11px] text-indigo-200/80">
                Mätsien viestit eivät näy huonepalstalla tai tapahtumachateissa.
              </p>
            </section>

            <section className="rounded-xl border border-cyan-700/50 bg-indigo-950/80 p-3 space-y-2">
              <h3 className="font-bold text-cyan-300">🗣️ Huonepalsta — nimimerkki</h3>
              <p className="text-[11px] text-indigo-100/90">
                Palstaviestit ovat erillään 1-to-1-mätsikeskusteluista. Nimimerkkitilassa muille
                näytetään esimerkiksi <code>KotiKetunPerhe</code>, ei sähköpostiosoitetta eikä
                oikeaa perhenimeä. Palstalla voi myös valita oman nimen, jolloin valittu nimi
                näkyy viestin yhteydessä.
              </p>
              <p className="text-[11px] text-indigo-200/80">
                Huonepalstan viestit ja tämän selaimen lukukuittaukset säilyvät
                <code> localStorage</code>-muistissa avaimella{' '}
                <code className="break-all">{storageKey}</code> sekä erillisellä
                lukukuittausavaimella.
              </p>
            </section>

            <section className="rounded-xl border border-amber-700/50 bg-indigo-950/80 p-3 space-y-2">
              <h3 className="font-bold text-amber-300">🗓️ Tapahtumachat — tapahtumakohtainen</h3>
              <p className="text-[11px] text-indigo-100/90">
                <code>event:&lt;eventId&gt;</code>-kanava kuuluu vain kyseiselle tapahtumalle.
                Tapahtumaviestit eivät sekoitu mätsien yksityisviesteihin tai huonepalstaan.
              </p>
              <p className="text-[11px] text-indigo-200/80">
                Tapahtumakortit ja uudet “Menossa”-ilmoittautumiset ovat tarjolla vain niin kauan
                kuin tapahtuma on aktiivisessa <code>/api/events</code>-syötteessä. Syötteestä
                poistunut tapahtuma jää keskusteluissa luettavaksi historiaksi merkinnällä
                “Päättynyt tapahtuma — vain historia”; uutta korttia tai ilmoittautumista ei
                tarjota.
              </p>
            </section>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <section className="rounded-xl border border-indigo-700/50 bg-indigo-950/80 p-3 space-y-2">
              <h3 className="font-bold text-cyan-300">📍 Sijaintitietojen minimointi</h3>
              <p className="text-[11px] text-indigo-100/90">
                Muille perheille näytetään vain karkea alue ja hakusäde, esimerkiksi{' '}
                {profile.homeCity}, {profile.area} ja enintään {profile.filters.maxDistanceKm} km.
                Kotiosoitetta tai tarkkoja koordinaatteja ei näytetä muille perheille.
              </p>
            </section>

            <section className="rounded-xl border border-indigo-700/50 bg-indigo-950/80 p-3 space-y-2">
              <h3 className="font-bold text-indigo-200">💾 Prototyypin tallennuspaikat</h3>
              <p className="text-[11px] text-indigo-100/90">
                Huonepalsta ja lukukuittaukset ovat tämän selaimen <code>localStorage</code>-muistissa.
                Yhteiset osallistumiset sekä mätsi- ja tapahtumaviestit tallentuvat
                prototyyppipalvelimella tiedostoon <code>data/demo-store.json</code>; myöhempi
                tuotantototeutus voi käyttää Postgres-tietokantaa.
              </p>
            </section>
          </div>

          <section className="rounded-xl border border-indigo-700/50 bg-black/30 p-3 space-y-2">
            <h3 className="font-bold text-white">🔐 Käyttäjän hallinta</h3>
            <ul className="list-disc space-y-1 pl-5 text-[11px] text-indigo-100/90">
              <li>
                Google-tilillä tunnistautuminen varmistaa käyttäjän; sähköpostiosoitetta ei
                näytetä muille julkisena tietona.
              </li>
              <li>
                Oman “Menossa”-merkinnän voi poistaa osallistumisen hallinnasta
                (<code>DELETE /api/participations</code>).
              </li>
              <li>
                “Nollaa paikallinen palstahistoria” tyhjentää tämän selaimen paikallisen
                palstademodatan. Se ei poista prototyyppipalvelimelle tallennettuja osallistumisia
                tai chat-viestejä.
              </li>
            </ul>
          </section>
        </div>
      )}
    </div>
  )
}