'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  AuthenticatedGoogleUser,
  DEFAULT_ACTIVITY_TAGS,
  FamilyEvent,
  FamilyProfile,
  UserProfileState,
} from './protoData'

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

interface PersistedCommunityState {
  threads: ForumThread[]
  eventMessagesById: Record<string, EventRoomMessage[]>
  nicknameInput: string
  useNicknameInBoard: boolean
  anonLabelInput: string
}

const COMMUNITY_STORAGE_PREFIX = 'perhepiiri_community_v1_'

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
  attendingIds: string[]
  matchedIds: string[]
  allFamilies: (FamilyProfile & { distanceKm: number })[]
  directMessages: Record<string, string[]>
  onSendDirectMessage: (familyId: string, text: string) => void
  onSwipeMatchFromEvent: (familyId: string) => void
  onToggleAttendance: (eventId: string) => void
  initialSection?: HubSection
  initialEventId?: string | null
  initialDirectTargetId?: string | null
}

export function CommunityHubPanel({
  currentUser,
  profile,
  events,
  attendingIds,
  matchedIds,
  allFamilies,
  directMessages,
  onSendDirectMessage,
  onSwipeMatchFromEvent,
  onToggleAttendance,
  initialSection = 'board',
  initialEventId = null,
  initialDirectTargetId = null,
}: CommunityHubPanelProps) {
  const storageKey = `${COMMUNITY_STORAGE_PREFIX}${currentUser.id}`

  const matchedFamilies = useMemo(
    () => allFamilies.filter((f) => matchedIds.includes(f.id)),
    [allFamilies, matchedIds],
  )

  const attendingEvents = useMemo(
    () => events.filter((e) => attendingIds.includes(e.id)),
    [events, attendingIds],
  )

  const [section, setSection] = useState<HubSection>(initialSection)
  const [selectedMatchId, setSelectedMatchId] = useState<string>(
    initialDirectTargetId || matchedFamilies[0]?.id || '',
  )
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
    initialEventId || attendingEvents[0]?.id || events[0]?.id || '',
  )
  const [eventMessagesById, setEventMessagesById] = useState<Record<string, EventRoomMessage[]>>(
    INITIAL_EVENT_ROOM_MESSAGES,
  )
  const [eventChatInput, setEventChatInput] = useState('')
  const [anonLabelInput, setAnonLabelInput] = useState('Anonyymi osallistuja')
  const [communityHydrated, setCommunityHydrated] = useState(false)
  const [resetCommunityToast, setResetCommunityToast] = useState(false)

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

  const activeDirectFamily =
    matchedFamilies.find((f) => f.id === selectedMatchId) || matchedFamilies[0] || null

  const roomThreads = useMemo(
    () => threads.filter((t) => t.roomId === activeRoomId),
    [threads, activeRoomId],
  )

  const activeThread =
    roomThreads.find((t) => t.id === selectedThreadId) || roomThreads[0] || null

  const activeEvent =
    events.find((e) => e.id === selectedEventId) || attendingEvents[0] || events[0] || null

  const isGoingToActiveEvent = activeEvent ? attendingIds.includes(activeEvent.id) : false
  const activeEventMessages = activeEvent ? eventMessagesById[activeEvent.id] || [] : []

  const totalEventChatMessagesCount = useMemo(
    () => Object.values(eventMessagesById).reduce((acc, list) => acc + list.length, 0),
    [eventMessagesById],
  )

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

  const handleSendEventMessage = () => {
    if (!activeEvent || !isGoingToActiveEvent) return
    const body = eventChatInput.trim()
    if (!body) return

    const msg: EventRoomMessage = {
      id: `emsg-${Date.now()}`,
      eventId: activeEvent.id,
      authorFamilyId: currentUser.id,
      authorNickname: anonLabelInput.trim() || 'Anonyymi osallistuja',
      authorRealName: profile.familyName || currentUser.displayName,
      body,
      createdAt: 'Juuri nyt',
    }

    setEventMessagesById((prev) => ({
      ...prev,
      [activeEvent.id]: [...(prev[activeEvent.id] || []), msg],
    }))
    setEventChatInput('')
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 pb-8">
      {/* Ylänavigaatio: emoji-ikonit ilman A/B/C-koodeja */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs font-bold">
        <button
          type="button"
          onClick={() => setSection('matches')}
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
          onClick={() => setSection('board')}
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
          onClick={() => setSection('event_chat')}
          className={`py-2 px-2.5 rounded-xl transition-colors ${
            section === 'event_chat'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          📅 Tapahtumachat ({totalEventChatMessagesCount})
        </button>
        <button
          type="button"
          onClick={() => setSection('data_transparency')}
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
                const active = activeDirectFamily?.id === fam.id
                return (
                  <button
                    key={fam.id}
                    type="button"
                    onClick={() => setSelectedMatchId(fam.id)}
                    className={`w-full text-left p-2.5 rounded-xl border text-xs transition-colors ${
                      active
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <div>{fam.name}</div>
                    <div className="text-[11px] text-slate-500 font-normal">
                      {fam.area} • {fam.distanceKm} km
                    </div>
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

                <div className="h-48 overflow-y-auto bg-slate-50 rounded-xl p-3 space-y-2 text-xs">
                  {(directMessages[activeDirectFamily.id] || []).length === 0 ? (
                    <p className="text-slate-400 text-center pt-14">
                      Lähetä ensimmäinen viesti perheelle {activeDirectFamily.name}.
                    </p>
                  ) : (
                    (directMessages[activeDirectFamily.id] || []).map((m, i) => (
                      <div
                        key={i}
                        className="bg-emerald-600 text-white px-3 py-2 rounded-2xl rounded-br-none ml-auto max-w-[82%]"
                      >
                        {m}
                      </div>
                    ))
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    value={directInput}
                    onChange={(e) => setDirectInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && directInput.trim()) {
                        onSendDirectMessage(activeDirectFamily.id, directInput.trim())
                        setDirectInput('')
                      }
                    }}
                    placeholder="Kirjoita yksityisviesti mätsille..."
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!directInput.trim()) return
                      onSendDirectMessage(activeDirectFamily.id, directInput.trim())
                      setDirectInput('')
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                  >
                    Lähetä
                  </button>
                </div>
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

      {/* Tapahtumakohtainen "Menossa"-chat (oletuksena anonyymi, elleivät perheet ole mätsänneet) */}
      {section === 'event_chat' && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                  📅 Tapahtuman "Menossa"-chat • Anonyymi oletuksena
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  ✓ Tallentuu selaimeen
                </span>
              </div>
              <h2 className="text-sm font-extrabold text-slate-900 mt-1">
                Keskustelu tapahtumaan menossa olevien kanssa
              </h2>
              <p className="text-xs text-slate-500">
                Anonymiteetti säilyy, elleivät perheet ole jo mätsänneet — mätsätty perhe näkyy
                nimellä ja voit avata yksityisviestin.
              </p>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500">Anonyymi tunnisteesi:</span>
              <input
                value={anonLabelInput}
                onChange={(e) => setAnonLabelInput(e.target.value)}
                className="w-40 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {events.slice(0, 8).map((evt) => {
              const active = activeEvent?.id === evt.id
              const going = attendingIds.includes(evt.id)
              const msgCount = (eventMessagesById[evt.id] || []).length
              return (
                <button
                  key={evt.id}
                  type="button"
                  onClick={() => setSelectedEventId(evt.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                    active
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {going ? '✓ ' : ''}
                  {evt.title}
                  {msgCount > 0 ? ` (${msgCount})` : ''}
                </button>
              )
            })}
          </div>

          {activeEvent && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div>
                  <strong>{activeEvent.title}</strong> • {activeEvent.venue} ({activeEvent.time})
                </div>
                <button
                  type="button"
                  onClick={() => onToggleAttendance(activeEvent.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                    isGoingToActiveEvent
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 text-white'
                  }`}
                >
                  {isGoingToActiveEvent ? '✓ Olet merkitty menossa' : '+ Merkitse menossa mukaan'}
                </button>
              </div>

              {!isGoingToActiveEvent ? (
                <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2 text-center">
                  <p className="font-bold">
                    Merkitse ensin "Menossa mukaan", niin pääset keskustelemaan muiden tapahtumaan
                    tulijoiden kanssa.
                  </p>
                  <button
                    type="button"
                    onClick={() => onToggleAttendance(activeEvent.id)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold"
                  >
                    + Merkitse menossa mukaan nyt
                  </button>
                </div>
              ) : (
                <>
                  <div className="h-52 overflow-y-auto bg-slate-50 rounded-xl p-3 space-y-2.5 text-xs">
                    {activeEventMessages.length === 0 ? (
                      <p className="text-slate-400 text-center pt-16">
                        Ei vielä viestejä tässä tapahtumassa. Kysy esimerkiksi paikkavinkkiä tai
                        aikataulua anonyymisti!
                      </p>
                    ) : (
                      activeEventMessages.map((msg) => {
                        const isMatched = matchedIds.includes(msg.authorFamilyId)
                        const isSelf = msg.authorFamilyId === currentUser.id
                        const matchedFam = allFamilies.find((f) => f.id === msg.authorFamilyId)

                        return (
                          <div
                            key={msg.id}
                            className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-start justify-between gap-2"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 text-[11px]">
                                {isSelf ? (
                                  <span className="font-bold text-emerald-700">
                                    Sinä ({msg.authorNickname})
                                  </span>
                                ) : isMatched ? (
                                  <span className="font-bold text-emerald-800">
                                    🤝 {msg.authorRealName} (mätsätty perhe)
                                  </span>
                                ) : (
                                  <span className="font-bold text-slate-700">
                                    🎭 {msg.authorNickname} (anonyymi)
                                  </span>
                                )}
                                <span className="text-slate-400">• {msg.createdAt}</span>
                              </div>
                              <p className="text-slate-800">{msg.body}</p>
                            </div>

                            {!isSelf && !isMatched && matchedFam && (
                              <button
                                type="button"
                                onClick={() => onSwipeMatchFromEvent(matchedFam.id)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold shrink-0 hover:bg-emerald-100"
                              >
                                + Mätsää
                              </button>
                            )}
                            {!isSelf && isMatched && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedMatchId(msg.authorFamilyId)
                                  setSection('matches')
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold shrink-0"
                              >
                                Yksityisviesti
                              </button>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={eventChatInput}
                      onChange={(e) => setEventChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendEventMessage()}
                      placeholder={`Kirjoita anonyymisti (${anonLabelInput || 'Anonyymi osallistuja'})...`}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleSendEventMessage}
                      className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                    >
                      Lähetä
                    </button>
                  </div>
                </>
              )}
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
                ? '✓ Keskustelut palautettu oletuksiin!'
                : 'Nollaa palsta & tapahtumaviestit'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-indigo-950/80 border border-indigo-700/50 p-3 space-y-1">
              <div className="font-bold text-cyan-300">🏡 Perheprofiili & rajaukset</div>
              <p className="text-[11px] text-indigo-100/90">
                Kotiseutu ({profile.area}), säde ({profile.filters.maxDistanceKm} km), lapset (
                {profile.children.length} kpl), 10 tägin oletusrajaukset ja tietosuoja-asetukset.
              </p>
            </div>
            <div className="rounded-xl bg-indigo-950/80 border border-indigo-700/50 p-3 space-y-1">
              <div className="font-bold text-emerald-300">🤝 Mätsit & yksityisviestit</div>
              <p className="text-[11px] text-indigo-100/90">
                Näkyvät vain molemminpuolisille osumille ({matchedIds.length} kpl). Ei jaeta
                palstahuoneisiin tai tapahtumachatteihin.
              </p>
            </div>
            <div className="rounded-xl bg-indigo-950/80 border border-indigo-700/50 p-3 space-y-1">
              <div className="font-bold text-amber-300">🎭 Palsta & tapahtumachat</div>
              <p className="text-[11px] text-indigo-100/90">
                Tallentuu selaimen avaimeen <code className="text-[10px]">{storageKey}</code>{' '}
                sivun päivityksen yli. Tapahtumachatissa identiteetti pysyy anonyyminä, kunnes
                perheet ovat mätsänneet.
              </p>
            </div>
          </div>

          <pre className="p-3 rounded-xl bg-black/60 border border-indigo-800/70 font-mono text-[10px] text-cyan-200 overflow-x-auto leading-relaxed">
            {JSON.stringify(
              {
                userId: currentUser.id,
                profileStorage: `family-${currentUser.id} (kotiseutu, lapset, 15km, defaultPreset, privacy)`,
                sessionStorage: `perhepiiri_session_v1_${currentUser.id} (attendingIds, dismissedIds, matchedIds, directMessages)`,
                communityLocalStorage: {
                  key: storageKey,
                  persistedAcrossReload: communityHydrated,
                  forumRoomsCount: TOPIC_ROOMS.length,
                  forumThreadsCount: threads.length,
                  eventChatThreadsCount: Object.keys(eventMessagesById).length,
                  eventChatMessagesCount: totalEventChatMessagesCount,
                  defaultActivityTagsCount: DEFAULT_ACTIVITY_TAGS.length,
                  eventChatAnonymityEnforcedUnlessMatched: true,
                },
              },
              null,
              2,
            )}
          </pre>
        </div>
      )}
    </div>
  )
}