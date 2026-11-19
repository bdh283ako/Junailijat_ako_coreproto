'use client'

import React, { useEffect, useRef, useState } from 'react'

// --- TIETOMALLIT ---
interface AuthenticatedGoogleUser {
  id: string
  displayName: string
  email: string
  avatarUrl?: string
}

interface CoParentItem {
  id: string
  name: string
  email: string
  status: 'pending' | 'accepted'
  invitedAt: string
  inviteCode: string
}

interface ChildItem {
  id: string
  ageLabel: string
  group: string
}

interface CloseRelativeItem {
  id: string
  relationLabel: string
  note: string
}

interface FamilyProfile {
  id: string
  name: string
  area: string
  city: string
  distanceKm: number
  childrenAges: string
  ageGroups: string[]
  closeRelativesSummary?: string
  hasCloseRelatives?: boolean
  bio: string
  interests: string[]
  attendingEventId: string
  coords: [number, number]
}

interface FamilyEvent {
  id: string
  title: string
  venue: string
  city: string
  time: string
  ageGroup: string
  price: string
  coords: [number, number]
}

interface UserProfileState {
  familyName: string
  area: string
  bio: string
  coParents: CoParentItem[]
  children: ChildItem[]
  closeRelatives: CloseRelativeItem[]
  interests: string[]
  filters: {
    maxDistanceKm: number
    targetAgeGroups: string[]
    targetCity: string
  }
  privacy: {
    discoverable: boolean
    shareEventsWithMatches: boolean
    showCloseRelativesInMatches: boolean
  }
}

interface PersistedProtoState {
  profile: UserProfileState
  attendingIds: string[]
  dismissedIds: string[]
  matchedIds: string[]
  messages: Record<string, string[]>
}

interface DemoSelectionEvent {
  id: string
  time: string
  action: string
  detail: string
}

interface DbCommitFeedEntry {
  id: string
  statusCode: string
  terminalLine: string
  diffStamp: string
  quip: string
  revision: number
}

interface FloatingPos {
  x: number
  y: number
}

interface LeafletCircleMarker {
  addTo: (map: LeafletMapInstance) => LeafletCircleMarker
  bindPopup: (html: string) => LeafletCircleMarker
}

interface LeafletMapInstance {
  remove: () => void
  invalidateSize: () => void
  setView: (coords: [number, number], zoom: number) => void
  fitBounds: (bounds: unknown, options?: { padding?: [number, number] }) => void
}

interface LeafletGlobal {
  map: (container: HTMLElement, options?: { zoomSnap?: number }) => LeafletMapInstance
  tileLayer: (
    url: string,
    options?: { attribution?: string; maxZoom?: number },
  ) => { addTo: (map: LeafletMapInstance) => void }
  latLngBounds: (sw: [number, number], ne: [number, number]) => unknown
  circleMarker: (
    coords: [number, number],
    options: {
      radius: number
      fillColor: string
      color: string
      weight: number
      fillOpacity: number
    },
  ) => LeafletCircleMarker
}

type TabKey = 'events' | 'families' | 'map' | 'profile'
type ProfileSubView = 'main' | 'members' | 'store_inspector'
type DbSyncStatus = 'idle' | 'saving' | 'saved' | 'error'

const STORAGE_PREFIX = 'perhepiiri_proto_v1_'
const INITIAL_ATTENDING_IDS = ['evt-2']

const NERD_DB_QUIPS: string[] = [
  'BSON-serpentti nielaisi dokumentin. Zero schema migrations harmed.',
  'fsync() kätteli levyn kanssa. Eventual consistency on heikoille.',
  'Atomic rename suoritettu. Jopa Brio-juna pysyi kiskoilla.',
  'Write-ahead log kuivui ilman deadlockeja. CAP-teoreema nyökkäsi.',
  'JSON-klusteri nielee tavut kuin OOM-killer ahneen Node-prosessin.',
  'Idempotentti upsert valmis. Bitit rivissä kuin sotilaat.',
  'Ei yhtään ORMia vahingoitettu tämän levyoperaation aikana.',
  'Dokumentti ankkuroitu levylle kovempaa kuin ACID-transaktio.',
  'Dirty pages huuhdeltu. Välimuisti ja levy ovat vihdoin puheväleissä.',
  'Schema-on-read voitti taas yhden turhan ALTER TABLE -migraation.',
  'Levy-I/O läpäisi tulikokeen ilman segfaultia tai korruptiota.',
  'Tila serialisoitu puhtaaksi UTF-8:ksi. Ei NaN-ylläreitä.',
  'Temp-tiedosto atomisesti nimetty uudelleen. Race condition jäi nuolemaan näppejään.',
  'Dokumenttikanta päivitetty. Jopa linteri pysyi hiljaa.',
  'Journalointi kuitti. Sähkökatkokaan ei enää pelota.',
  'Muistivuodot nollassa, levylohkot järjestyksessä. Ship it.',
  'Payload parsittu ja lukittu levylle ennen kuin event loop ehti räpäyttää.',
  'Kokoelma synkassa. Ei tarvittu Kubernetes-klusteria tähän operaatioon.',
  'Tavuja siirretty tarkkuudella, josta RAID-ohjainkin olisi ylpeä.',
  'Upsert-operaatio meni läpi kuin root-oikeuksilla tehty chmod.',
  'Dokumentti talletettu ilman yhtäkään turhaa microservices-hyppyä.',
  'Levykirjoitus valmis. Cache invalidation on silti se vaikein ongelma.',
  'Bitti kerrallaan kohti ikuisuutta. Persistency achieved.',
  'JSON-puun oksat karsittu ja talletettu. Garbage collector kiittää.',
]

const AVAILABLE_TAGS = [
  'Puistotreffit',
  'Luontoretket',
  'Pyöräily',
  'Kulttuuri',
  'Uinti',
  'Jalkapallo',
  'Lautapelit',
  'Koodaus',
  'Kirjastot',
  'Vertaistuki',
]

const AGE_GROUP_OPTIONS = ['0-3v', '4-6v', '7-12v', '13-16v']
const RELATIVE_ROLES = ['Isovanhempi', 'Kummi', 'Läheinen']

// --- DEMODATA ---
const INITIAL_EVENTS: FamilyEvent[] = [
  {
    id: 'evt-1',
    title: 'Lasten lauantaidisko',
    venue: 'Espoon kulttuurikeskus, Tapiola',
    city: 'Espoo',
    time: 'La 21.11. klo 14:00',
    ageGroup: '3–10 v',
    price: 'Maksuton',
    coords: [60.1773, 24.8042],
  },
  {
    id: 'evt-2',
    title: 'Koko perheen ulkoilupäivä & makkaranpaisto',
    venue: 'Oittaan ulkoilualue',
    city: 'Espoo',
    time: 'Su 22.11. klo 11:00',
    ageGroup: 'Kaikenikäiset',
    price: 'Maksuton',
    coords: [60.2392, 24.6565],
  },
  {
    id: 'evt-3',
    title: 'Perheiden koodaus- ja robottipaja',
    venue: 'Keskustakirjasto Oodi',
    city: 'Helsinki',
    time: 'La 28.11. klo 12:00',
    ageGroup: '6–12 v',
    price: 'Maksuton',
    coords: [60.1741, 24.9382],
  },
]

const DEMO_FAMILIES: FamilyProfile[] = [
  {
    id: 'fam-1',
    name: 'Virtasen perhe',
    area: 'Tapiola, Espoo',
    city: 'Espoo',
    distanceKm: 1.8,
    childrenAges: '4v ja 7v',
    ageGroups: ['4-6v', '7-12v'],
    hasCloseRelatives: true,
    closeRelativesSummary: 'Isovanhemmat mukana viikonloppuretkillä',
    bio: 'Ulkoilua, pyöräilyä ja uusia leikkikavereita viikonloppuihin. Kahvi maistuu puiston laidalla!',
    interests: ['Puistotreffit', 'Pyöräily', 'Kulttuuri'],
    attendingEventId: 'evt-1',
    coords: [60.1756, 24.8053],
  },
  {
    id: 'fam-2',
    name: 'Korhosen perhe',
    area: 'Kauniainen',
    city: 'Kauniainen',
    distanceKm: 3.4,
    childrenAges: '5v ja 8v',
    ageGroups: ['4-6v', '7-12v'],
    hasCloseRelatives: false,
    closeRelativesSummary: '',
    bio: 'Muutettiin hiljattain alueelle. Etsitään rentoa perheseuraa retkille ja harrastuksiin.',
    interests: ['Luontoretket', 'Jalkapallo', 'Lautapelit'],
    attendingEventId: 'evt-2',
    coords: [60.2114, 24.7265],
  },
  {
    id: 'fam-3',
    name: 'Mäkisen perhe',
    area: 'Leppävaara, Espoo',
    city: 'Espoo',
    distanceKm: 4.9,
    childrenAges: '6v ja 9v',
    ageGroups: ['4-6v', '7-12v'],
    hasCloseRelatives: true,
    closeRelativesSummary: 'Kummi ja isovanhemmat lähellä',
    bio: 'Kaksi aktiivista koululaista ja vauhdikas arki. Mukaan kirjastoreissuille ja pajoihin!',
    interests: ['Koodaus', 'Kirjastot', 'Uinti'],
    attendingEventId: 'evt-3',
    coords: [60.2189, 24.8124],
  },
  {
    id: 'fam-4',
    name: 'Lindqvistin perhe',
    area: 'Töölö, Helsinki',
    city: 'Helsinki',
    distanceKm: 11.5,
    childrenAges: '2v',
    ageGroups: ['0-3v'],
    hasCloseRelatives: false,
    closeRelativesSummary: '',
    bio: 'Taaperoarkea ja puistokahveja keskustan ja Seurasaaren maastoissa.',
    interests: ['Puistotreffit', 'Vertaistuki', 'Kulttuuri'],
    attendingEventId: 'evt-1',
    coords: [60.1805, 24.9182],
  },
]

const BASE_DEFAULT_PROFILE: UserProfileState = {
  familyName: 'Oma Perhe',
  area: 'Espoon keskus / Kauniainen',
  bio: 'Etsitään rentoa perheseuraa viikonlopun ulkoiluihin ja tapahtumiin.',
  coParents: [],
  children: [
    { id: 'c1', ageLabel: '5 v', group: '4-6v' },
    { id: 'c2', ageLabel: '8 v', group: '7-12v' },
  ],
  closeRelatives: [
    { id: 'r1', relationLabel: 'Isovanhempi', note: 'Tukiverkko viikonloppuisin' },
  ],
  interests: ['Luontoretket', 'Pyöräily', 'Jalkapallo'],
  filters: {
    maxDistanceKm: 15,
    targetAgeGroups: ['4-6v', '7-12v'],
    targetCity: 'Kaikki PKS',
  },
  privacy: {
    discoverable: true,
    shareEventsWithMatches: true,
    showCloseRelativesInMatches: false,
  },
}

function buildDefaultProfileForGoogleUser(user: AuthenticatedGoogleUser): UserProfileState {
  const firstName = user.displayName.split(' ')[0] || 'Oma'
  return {
    ...BASE_DEFAULT_PROFILE,
    familyName: `${firstName} – perhe`,
  }
}

function emailToUserId(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
}

function nowClock(): string {
  return new Date().toLocaleTimeString('fi-FI', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function generateInviteCode(): string {
  const part = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `PP-${part}`
}

function buildInviteUrl(invite: CoParentItem): string {
  const base =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://perhepiiri.example.fi'
  return `${base}/kutsu?code=${encodeURIComponent(invite.inviteCode)}&email=${encodeURIComponent(invite.email)}`
}

function normalizeProfile(
  incoming?: Partial<UserProfileState> | null,
  fallbackBase: UserProfileState = BASE_DEFAULT_PROFILE,
): UserProfileState {
  if (!incoming) return fallbackBase
  const rawParents = Array.isArray(incoming.coParents) ? incoming.coParents : fallbackBase.coParents
  const normalizedParents: CoParentItem[] = rawParents.map((p, idx) => ({
    id: p.id || `cp-${idx}`,
    name: p.name || 'Toinen vanhempi',
    email: p.email || '',
    status: p.status === 'accepted' ? 'accepted' : 'pending',
    invitedAt: p.invitedAt || 'Aiemmin',
    inviteCode: p.inviteCode || `PP-DEMO${idx + 1}`,
  }))

  return {
    ...fallbackBase,
    ...incoming,
    coParents: normalizedParents,
    children: Array.isArray(incoming.children) ? incoming.children : fallbackBase.children,
    closeRelatives: Array.isArray(incoming.closeRelatives)
      ? incoming.closeRelatives
      : fallbackBase.closeRelatives,
    interests: Array.isArray(incoming.interests) ? incoming.interests : fallbackBase.interests,
    filters: { ...fallbackBase.filters, ...incoming.filters },
    privacy: { ...fallbackBase.privacy, ...incoming.privacy },
  }
}

function loadUserPersistedState(userId: string): PersistedProtoState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${userId}`)
    if (!raw) return null
    return JSON.parse(raw) as PersistedProtoState
  } catch {
    return null
  }
}

// Kelluva raahattava ikkuna, joka sijoittuu oletuksena näkymän oikealle puolelle
function FloatingDockWindow({
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
    const nextX = Math.min(maxX, Math.max(8, d.origX + dx))
    const nextY = Math.min(maxY, Math.max(8, d.origY + dy))
    onPosChange({ x: nextX, y: nextY })
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
          <span className="font-mono text-[10px] font-bold tracking-wider truncate">
            {title}
          </span>
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

export default function PerheAppPrototypePage() {
  // Aidon Google OAuth -istunnon tila
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>(
    'loading',
  )
  const [currentUser, setCurrentUser] = useState<AuthenticatedGoogleUser | null>(null)
  const [authRedirecting, setAuthRedirecting] = useState(false)
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<TabKey>('events')
  const [profileSubView, setProfileSubView] = useState<ProfileSubView>('main')
  const [familySubTab, setFamilySubTab] = useState<'discover' | 'matches'>('discover')

  // Profiilin ja suodattimien tila
  const [profile, setProfile] = useState<UserProfileState>(BASE_DEFAULT_PROFILE)

  // Toisen vanhemman kutsulomake & esikatselu
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
  const [customTag, setCustomTag] = useState('')
  const [profileSavedToast, setProfileSavedToast] = useState(false)
  const [dbSyncStatus, setDbSyncStatus] = useState<DbSyncStatus>('idle')
  const [mongoInstanceLabel, setMongoInstanceLabel] = useState<string>('')
  const [mongoUpdatedAt, setMongoUpdatedAt] = useState<string>('')
  const [mongoRevision, setMongoRevision] = useState<number>(0)
  const [dbFeedLog, setDbFeedLog] = useState<DbCommitFeedEntry[]>([])
  const [mapError, setMapError] = useState(false)

  // Kelluvat paneelit (oletuksena oikeassa laidassa, raahattavissa mihin tahansa)
  const [showDemoMonitor, setShowDemoMonitor] = useState(true)
  const [showNerdDbFloat, setShowNerdDbFloat] = useState(true)
  const [demoFloatPos, setDemoFloatPos] = useState<FloatingPos | null>(null)
  const [dbFloatPos, setDbFloatPos] = useState<FloatingPos | null>(null)

  // Demoamisvalintojen seurantaikkuna (ei kantaan tallentuvia profiili-/jäsen-/viestitietoja)
  const [demoSelections, setDemoSelections] = useState<DemoSelectionEvent[]>([
    {
      id: 'init-1',
      time: nowClock(),
      action: 'OAUTH_CHECK',
      detail: 'checking /api/auth/session',
    },
  ])

  // Rivikohtainen muokkaustila (lapset ja läheiset)
  const [editingChildId, setEditingChildId] = useState<string | null>(null)
  const [editChildAge, setEditChildAge] = useState('')
  const [editChildGroup, setEditChildGroup] = useState('4-6v')

  const [editingRelativeId, setEditingRelativeId] = useState<string | null>(null)
  const [editRelativeRole, setEditRelativeRole] = useState('Isovanhempi')
  const [editRelativeNote, setEditRelativeNote] = useState('')

  // Jaettu sovellustila
  const [attendingIds, setAttendingIds] = useState<string[]>(INITIAL_ATTENDING_IDS)
  const [dismissedIds, setDismissedIds] = useState<string[]>([])
  const [matchedIds, setMatchedIds] = useState<string[]>([])
  const [latestMatch, setLatestMatch] = useState<FamilyProfile | null>(null)
  const [chatTarget, setChatTarget] = useState<FamilyProfile | null>(null)
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState<Record<string, string[]>>({})
  const [mapFocusCoords, setMapFocusCoords] = useState<[number, number] | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  const skipNextDbSaveRef = useRef(true)
  const lastQuipIdxRef = useRef<number>(-1)
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<LeafletMapInstance | null>(null)

  const recordDemoSelection = (action: string, detail: string) => {
    setDemoSelections((prev) => [
      {
        id: `sel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        time: nowClock(),
        action,
        detail,
      },
      ...prev.slice(0, 14),
    ])
  }

  // Tarkistetaan aito Google-istunto (/api/auth/session) & asetetaan kelluvat ikkunat oikealle
  useEffect(() => {
    if (typeof window === 'undefined') return
    setDemoFloatPos((prev) => prev ?? { x: Math.max(12, window.innerWidth - 336), y: 24 })
    setDbFloatPos((prev) => prev ?? { x: Math.max(12, window.innerWidth - 336), y: 236 })

    const params = new URLSearchParams(window.location.search)
    const errParam = params.get('error')
    if (errParam) {
      setAuthErrorMessage(
        `Google-kirjautuminen keskeytyi (${errParam}). Tarkista OAuth-asetukset tai yritä uudelleen.`,
      )
    }

    let cancelled = false
    const checkGoogleSession = async () => {
      try {
        const res = await fetch('/api/auth/session', { cache: 'no-store' })
        if (!res.ok) {
          if (!cancelled) {
            setAuthStatus('unauthenticated')
            recordDemoSelection('OAUTH_SESSION', 'none (HTTP ' + res.status + ')')
          }
          return
        }
        const session = (await res.json()) as {
          user?: { name?: string | null; email?: string | null; image?: string | null }
        } | null

        if (!cancelled) {
          if (session?.user?.email) {
            const email = session.user.email
            const displayName = session.user.name || email.split('@')[0] || 'Google-käyttäjä'
            const googleUser: AuthenticatedGoogleUser = {
              id: emailToUserId(email),
              displayName,
              email,
              avatarUrl: session.user.image || undefined,
            }
            setCurrentUser(googleUser)
            setAuthStatus('authenticated')
            recordDemoSelection('GOOGLE_OAUTH_OK', googleUser.id)
          } else {
            setAuthStatus('unauthenticated')
            recordDemoSelection('OAUTH_SESSION', 'unauthenticated')
          }
        }
      } catch {
        if (!cancelled) {
          setAuthStatus('unauthenticated')
          recordDemoSelection('OAUTH_SESSION', 'endpoint_unreachable')
        }
      }
    }

    void checkGoogleSession()
    return () => {
      cancelled = true
    }
  }, [])

  // Käynnistää aidon Google OAuth -kirjautumisen (/api/auth/signin/google)
  const startGoogleSignIn = async () => {
    if (typeof window === 'undefined') return
    setAuthRedirecting(true)
    setAuthErrorMessage(null)
    recordDemoSelection('GOOGLE_SIGNIN_START', '/api/auth/signin/google')

    const callbackUrl = `${window.location.origin}${window.location.pathname}`

    try {
      const csrfRes = await fetch('/api/auth/csrf', { cache: 'no-store' })
      if (csrfRes.ok) {
        const csrfData = (await csrfRes.json()) as { csrfToken?: string }
        if (csrfData?.csrfToken) {
          const form = document.createElement('form')
          form.method = 'POST'
          form.action = '/api/auth/signin/google'

          const csrfInput = document.createElement('input')
          csrfInput.type = 'hidden'
          csrfInput.name = 'csrfToken'
          csrfInput.value = csrfData.csrfToken
          form.appendChild(csrfInput)

          const cbInput = document.createElement('input')
          cbInput.type = 'hidden'
          cbInput.name = 'callbackUrl'
          cbInput.value = callbackUrl
          form.appendChild(cbInput)

          document.body.appendChild(form)
          form.submit()
          return
        }
      }
    } catch {
      // Siirrytään suoraan GET-ohjaukseen jos CSRF-reittiä ei ole erikseen käytössä
    }

    window.location.href = `/api/auth/signin/google?callbackUrl=${encodeURIComponent(callbackUrl)}`
  }

  // Kirjaa Google-istunnon ulos (/api/auth/signout)
  const signOutGoogleSession = async () => {
    if (typeof window === 'undefined') return
    setAuthRedirecting(true)
    recordDemoSelection('GOOGLE_SIGNOUT', currentUser?.id || 'session')
    const callbackUrl = `${window.location.origin}${window.location.pathname}`

    try {
      const csrfRes = await fetch('/api/auth/csrf', { cache: 'no-store' })
      if (csrfRes.ok) {
        const csrfData = (await csrfRes.json()) as { csrfToken?: string }
        if (csrfData?.csrfToken) {
          const form = document.createElement('form')
          form.method = 'POST'
          form.action = '/api/auth/signout'

          const csrfInput = document.createElement('input')
          csrfInput.type = 'hidden'
          csrfInput.name = 'csrfToken'
          csrfInput.value = csrfData.csrfToken
          form.appendChild(csrfInput)

          const cbInput = document.createElement('input')
          cbInput.type = 'hidden'
          cbInput.name = 'callbackUrl'
          cbInput.value = callbackUrl
          form.appendChild(cbInput)

          document.body.appendChild(form)
          form.submit()
          return
        }
      }
    } catch {
      // Fallback
    }

    window.location.href = `/api/auth/signout?callbackUrl=${encodeURIComponent(callbackUrl)}`
  }

  const pickRandomNerdQuip = (): string => {
    if (NERD_DB_QUIPS.length === 0) return 'COMMITTED -> family_profiles'
    let idx = Math.floor(Math.random() * NERD_DB_QUIPS.length)
    if (NERD_DB_QUIPS.length > 1 && idx === lastQuipIdxRef.current) {
      idx = (idx + 1) % NERD_DB_QUIPS.length
    }
    lastQuipIdxRef.current = idx
    return NERD_DB_QUIPS[idx]
  }

  const pushDbFeedEntry = (
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
      terminalLine: `[${statusCode} ${opLabel}] doc:_id=${docKey} -> mongo-${instanceName}.json${latencySuffix}`,
      diffStamp: `Δ persisted @ ${clock} • rev #${rev} • COMMITTED -> family_profiles (v${rev})`,
      quip: pickRandomNerdQuip(),
      revision: rev,
    }
    setDbFeedLog((prev) => [entry, ...prev.slice(0, 49)])
  }

  const showTransientBanner = (message: string, ms = 3500) => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
    setInviteBanner(message)
    bannerTimerRef.current = setTimeout(() => setInviteBanner(null), ms)
  }

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
      if (savedToastTimerRef.current) clearTimeout(savedToastTimerRef.current)
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
    }
  }, [])

  // Ladataan kirjautuneen Google-käyttäjän oma profiili + tila localStoragesta ja instanssikannasta
  useEffect(() => {
    if (!currentUser) return
    let cancelled = false

    const hydrateForGoogleUser = async () => {
      const userId = currentUser.id
      const docKey = `family-${userId}`
      const baseDefault = buildDefaultProfileForGoogleUser(currentUser)
      const saved = loadUserPersistedState(userId)

      let resolvedProfile = baseDefault
      if (saved) {
        resolvedProfile = normalizeProfile(saved.profile, baseDefault)
        setProfile(resolvedProfile)
        setAttendingIds(Array.isArray(saved.attendingIds) ? saved.attendingIds : INITIAL_ATTENDING_IDS)
        setDismissedIds(Array.isArray(saved.dismissedIds) ? saved.dismissedIds : [])
        setMatchedIds(Array.isArray(saved.matchedIds) ? saved.matchedIds : [])
        setMessages(saved.messages && typeof saved.messages === 'object' ? saved.messages : {})
      } else {
        setProfile(baseDefault)
        setAttendingIds(INITIAL_ATTENDING_IDS)
        setDismissedIds([])
        setMatchedIds([])
        setMessages({})
      }

      const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
      try {
        const res = await fetch(`/api/family-profile?userId=${encodeURIComponent(userId)}`, {
          cache: 'no-store',
        })
        if (res.ok && !cancelled) {
          const data = await res.json()
          const inst = data?.document?.instanceId || 'default-instance'
          setMongoInstanceLabel(inst)
          if (data?.document?.updatedAt) {
            setMongoUpdatedAt(data.document.updatedAt)
          }
          if (data?.document?.profile) {
            resolvedProfile = normalizeProfile(data.document.profile, baseDefault)
            setProfile(resolvedProfile)
            const ms = Math.max(
              1,
              Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0),
            )
            setMongoRevision(1)
            pushDbFeedEntry('200', 'HYDRATED', docKey, inst, 1, ms)
          } else {
            const initRes = await fetch('/api/family-profile', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, profile: resolvedProfile }),
            })
            if (initRes.ok) {
              const initData = await initRes.json()
              const initInst = initData?.document?.instanceId || inst
              setMongoInstanceLabel(initInst)
              if (initData?.document?.updatedAt) {
                setMongoUpdatedAt(initData.document.updatedAt)
              }
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
          setDbSyncStatus('error')
          pushDbFeedEntry('503', 'STORE_OFFLINE', docKey, 'fallback-localStorage', 0)
        }
      } finally {
        if (!cancelled) {
          setIsHydrated(true)
        }
      }
    }

    void hydrateForGoogleUser()
    return () => {
      cancelled = true
    }
  }, [currentUser])

  // Tallennetaan kirjautuneen käyttäjän sovellustila localStorageen
  useEffect(() => {
    if (!isHydrated || !currentUser || typeof window === 'undefined') return
    try {
      const payload: PersistedProtoState = {
        profile,
        attendingIds,
        dismissedIds,
        matchedIds,
        messages,
      }
      window.localStorage.setItem(`${STORAGE_PREFIX}${currentUser.id}`, JSON.stringify(payload))
    } catch {
      // Ohitetaan kiintiö- tai yksityisen selaustilan virheet
    }
  }, [isHydrated, currentUser, profile, attendingIds, dismissedIds, matchedIds, messages])

  // Tallennetaan kirjautuneen Google-käyttäjän profiili ja jäsentiedot instanssikantaan
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
            const data = await res.json()
            const inst = data?.document?.instanceId || mongoInstanceLabel || 'instance'
            setMongoInstanceLabel(inst)
            if (data?.document?.updatedAt) {
              setMongoUpdatedAt(data.document.updatedAt)
            }
            setMongoRevision((prev) => {
              const nextRev = prev + 1
              pushDbFeedEntry('201', 'UPSERT_OK', docKey, inst, nextRev, ms)
              return nextRev
            })
            setDbSyncStatus('saved')
          } else {
            setDbSyncStatus('error')
            pushDbFeedEntry(
              '500',
              'UPSERT_FAIL',
              docKey,
              mongoInstanceLabel || 'instance',
              mongoRevision,
              ms,
            )
          }
        }
      } catch {
        if (!cancelled) {
          setDbSyncStatus('error')
          pushDbFeedEntry('503', 'IO_ERROR', docKey, mongoInstanceLabel || 'instance', mongoRevision)
        }
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [isHydrated, currentUser, profile, mongoInstanceLabel, mongoRevision])

  const resetAllDemoState = async () => {
    if (!currentUser) return
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
    const userId = currentUser.id
    const docKey = `family-${userId}`
    const resetProfile = buildDefaultProfileForGoogleUser(currentUser)

    skipNextDbSaveRef.current = true
    setProfile(resetProfile)
    setDismissedIds([])
    setMatchedIds([])
    setAttendingIds(INITIAL_ATTENDING_IDS)
    setMessages({})
    setLatestMatch(null)
    setChatTarget(null)
    setEditingChildId(null)
    setEditingRelativeId(null)
    setInviteParentName('')
    setInviteParentEmail('')
    setInviteError('')
    setChildError('')
    setInviteBanner(null)
    setPreviewInviteId(null)
    setProfileSubView('main')
    setDemoSelections([
      { id: `rst-${Date.now()}`, time: nowClock(), action: 'DEMO_RESET', detail: userId },
    ])

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(`${STORAGE_PREFIX}${userId}`)
      } catch {
        // Ohitetaan virheet
      }
    }
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
    try {
      const res = await fetch('/api/family-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, profile: resetProfile }),
      })
      const ms = Math.max(
        1,
        Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0),
      )
      const inst = mongoInstanceLabel || 'instance'
      if (res.ok) {
        const data = await res.json()
        if (data?.document?.updatedAt) setMongoUpdatedAt(data.document.updatedAt)
      }
      setMongoRevision((prev) => {
        const nextRev = prev + 1
        pushDbFeedEntry('205', 'RESET_OK', docKey, inst, nextRev, ms)
        return nextRev
      })
      setDbSyncStatus('saved')
    } catch {
      setDbSyncStatus('error')
    }
  }

  const filteredDeck = DEMO_FAMILIES.filter((fam) => {
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

  const currentCard = filteredDeck[0]
  const matchedFamilies = DEMO_FAMILIES.filter((f) => matchedIds.includes(f.id))

  // Toisen vanhemman kutsulogiikka (demo)
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

    setProfile((prev) => ({
      ...prev,
      coParents: [...prev.coParents, newInvite],
    }))
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

  // Profiilin ja perheenjäsenten muokkausfunktiot
  const toggleInterest = (tag: string) => {
    setProfile((prev) => ({
      ...prev,
      interests: prev.interests.includes(tag)
        ? prev.interests.filter((t) => t !== tag)
        : [...prev.interests, tag],
    }))
    recordDemoSelection('TAG_TOGGLE', `#${tag}`)
  }

  const addCustomTag = () => {
    const clean = customTag.trim().replace(/^#/, '')
    if (!clean) return
    if (!profile.interests.includes(clean)) {
      setProfile((prev) => ({ ...prev, interests: [...prev.interests, clean] }))
    }
    recordDemoSelection('TAG_ADD', `#${clean}`)
    setCustomTag('')
  }

  const addChild = () => {
    const trimmed = newChildAge.trim()
    if (!trimmed) {
      setChildError('Syötä lapsen ikä (esim. 3 v).')
      return
    }
    setChildError('')
    setProfile((prev) => ({
      ...prev,
      children: [
        ...prev.children,
        { id: `c-${Date.now()}`, ageLabel: trimmed, group: newChildGroup },
      ],
    }))
    setNewChildAge('')
  }

  const startEditChild = (child: ChildItem) => {
    setEditingChildId(child.id)
    setEditChildAge(child.ageLabel)
    setEditChildGroup(child.group)
  }

  const saveEditChild = (id: string) => {
    if (!editChildAge.trim()) return
    setProfile((prev) => ({
      ...prev,
      children: prev.children.map((c) =>
        c.id === id ? { ...c, ageLabel: editChildAge.trim(), group: editChildGroup } : c,
      ),
    }))
    setEditingChildId(null)
  }

  const removeChild = (id: string) => {
    if (editingChildId === id) setEditingChildId(null)
    setProfile((prev) => ({
      ...prev,
      children: prev.children.filter((c) => c.id !== id),
    }))
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

  const toggleFilterAgeGroup = (group: string) => {
    setProfile((prev) => {
      const exists = prev.filters.targetAgeGroups.includes(group)
      return {
        ...prev,
        filters: {
          ...prev.filters,
          targetAgeGroups: exists
            ? prev.filters.targetAgeGroups.filter((g) => g !== group)
            : [...prev.filters.targetAgeGroups, group],
        },
      }
    })
    recordDemoSelection('AGE_FILTER', group)
  }

  const saveProfileFeedback = async () => {
    if (!currentUser) return
    const userId = currentUser.id
    const docKey = `family-${userId}`
    setDbSyncStatus('saving')
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
    try {
      const res = await fetch('/api/family-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, profile }),
      })
      const ms = Math.max(
        1,
        Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0),
      )
      if (res.ok) {
        const data = await res.json()
        const inst = data?.document?.instanceId || mongoInstanceLabel || 'instance'
        setMongoInstanceLabel(inst)
        if (data?.document?.updatedAt) setMongoUpdatedAt(data.document.updatedAt)
        setMongoRevision((prev) => {
          const nextRev = prev + 1
          pushDbFeedEntry('201', 'MANUAL_FLUSH', docKey, inst, nextRev, ms)
          return nextRev
        })
        setDbSyncStatus('saved')
      } else {
        setDbSyncStatus('error')
      }
    } catch {
      setDbSyncStatus('error')
    }
    if (savedToastTimerRef.current) clearTimeout(savedToastTimerRef.current)
    setProfileSavedToast(true)
    savedToastTimerRef.current = setTimeout(() => setProfileSavedToast(false), 2000)
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
      recordDemoSelection('SWIPE_LIKE', `${currentCard.id} (MATCH)`)
    } else {
      setDismissedIds((prev) => [...prev, currentCard.id])
      recordDemoSelection('SWIPE_PASS', currentCard.id)
    }
  }

  const sendQuickMessage = (text?: string) => {
    if (!chatTarget) return
    const msg = (text ?? chatInput).trim()
    if (!msg) return
    setMessages((prev) => ({
      ...prev,
      [chatTarget.id]: [...(prev[chatTarget.id] || []), msg],
    }))
    setChatInput('')
  }

  const openOnMap = (coords: [number, number], label = 'coords') => {
    setMapFocusCoords(coords)
    setActiveTab('map')
    recordDemoSelection('MAP_FOCUS', label)
  }

  // Kartan alustus
  useEffect(() => {
    if (!currentUser || activeTab !== 'map' || typeof window === 'undefined') return
    setMapError(false)

    const initLeaflet = () => {
      const L = (window as unknown as { L?: LeafletGlobal }).L
      if (!L || !mapContainerRef.current) {
        setMapError(true)
        return
      }

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }

      const map = L.map(mapContainerRef.current, { zoomSnap: 0.25 })
      mapInstanceRef.current = map

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        { attribution: '© Esri / OSM', maxZoom: 19 },
      ).addTo(map)

      if (mapFocusCoords) {
        map.setView(mapFocusCoords, 14)
      } else {
        map.fitBounds(L.latLngBounds([60.115, 24.52], [60.325, 25.18]), { padding: [16, 16] })
      }

      INITIAL_EVENTS.forEach((evt) => {
        const isGoing = attendingIds.includes(evt.id)
        L.circleMarker(evt.coords, {
          radius: 10,
          fillColor: '#2563eb',
          color: '#fff',
          weight: 2.5,
          fillOpacity: 0.95,
        })
          .addTo(map)
          .bindPopup(
            `<strong>📅 ${evt.title}</strong><br/>${evt.venue}<br/>${
              isGoing ? '✅ Olet menossa mukaan' : evt.time
            }`,
          )
      })

      matchedFamilies.forEach((fam) => {
        const eventNote =
          profile.privacy.shareEventsWithMatches && fam.attendingEventId
            ? `<br/><span style="font-size:11px;color:#059669;">Tapahtuma: ${
                INITIAL_EVENTS.find((e) => e.id === fam.attendingEventId)?.title || ''
              }</span>`
            : ''

        const relativesNote =
          profile.privacy.showCloseRelativesInMatches &&
          fam.hasCloseRelatives &&
          fam.closeRelativesSummary
            ? `<br/><span style="font-size:11px;color:#475569;">🫂 Läheiset: ${fam.closeRelativesSummary}</span>`
            : ''

        L.circleMarker(fam.coords, {
          radius: 11,
          fillColor: '#059669',
          color: '#fff',
          weight: 2.5,
          fillOpacity: 0.95,
        })
          .addTo(map)
          .bindPopup(
            `<strong>🤝 ${fam.name}</strong><br/>${fam.area} (${fam.childrenAges})${eventNote}${relativesNote}`,
          )
      })
    }

    if ((window as unknown as { L?: LeafletGlobal }).L) {
      initLeaflet()
      return
    }

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.async = true
    script.onload = initLeaflet
    script.onerror = () => setMapError(true)
    document.body.appendChild(script)
  }, [
    currentUser,
    activeTab,
    attendingIds,
    matchedIds,
    mapFocusCoords,
    profile.privacy.shareEventsWithMatches,
    profile.privacy.showCloseRelativesInMatches,
  ])

  const totalParentsCount = 1 + profile.coParents.length
  const activePreviewInvite = profile.coParents.find((p) => p.id === previewInviteId) ?? null
  const latestDbEntry = dbFeedLog[0] ?? null

  return (
    <div className="min-h-dvh bg-zinc-900 sm:py-5 sm:px-4 flex justify-center items-center">
      {/* DYNAAMINEN LAITEKEHYS:
          - Kapea ikkuna (<640px): Iso >6" älypuhelin (max-w-[430px], täysi korkeus h-dvh)
          - Leveämpi ikkuna (>=640px): Modernin huipputabletin resoluutio (max-w-4xl / 896px) */}
      <div className="w-full max-w-[430px] sm:max-w-4xl bg-slate-50 h-dvh sm:h-[92dvh] sm:max-h-[1180px] flex flex-col shadow-2xl border-x sm:border-[3px] border-slate-800 sm:rounded-[2rem] relative overflow-hidden transition-all duration-300">
        {authStatus === 'loading' ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-xs text-slate-600">
            <span className="text-2xl animate-pulse">🔐</span>
            <p>Tarkistetaan Google-kirjautumista...</p>
          </div>
        ) : authStatus === 'unauthenticated' || !currentUser ? (
          /* AITO GOOGLE OAUTH -KIRJAUTUMISNÄKYMÄ (KUTEN GATHEREVENTS) */
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
                  Kirjaudu sisään omalla Google-tililläsi, niin näet tapahtumat, suodattimet,
                  perheenjäsenet ja oman profiilidokumenttisi omilla tiedoillasi.
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
                  {authRedirecting ? 'Siirrytään Google-kirjautumiseen...' : 'Kirjaudu Google-tilillä'}
                </span>
              </button>

              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
                <p>Käyttää projektin olemassa olevaa `/api/auth/signin/google`-reittiä.</p>
                <p className="font-mono text-[10px] text-slate-400">
                  callback: /api/auth/callback/google
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* KIRJAUTUNUT SOVELLUSNÄKYMÄ */
          <>
            {/* YLÄPALKKI */}
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
                  📍 {profile.filters.targetCity} • max {profile.filters.maxDistanceKm} km •{' '}
                  {currentUser.email}
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
                  title="Kirjaudu ulos Google-tililtä"
                >
                  Ulos
                </button>
              </div>
            </header>

            {/* MATCH-PONNAHDUSILMOITUS */}
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
                      setChatTarget(target)
                    }}
                    className="px-3 py-1.5 bg-white text-emerald-800 rounded-lg text-xs font-bold"
                  >
                    Viesti
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

            {/* PÄÄSISÄLTÖALUE */}
            <main className="flex-1 overflow-y-auto">
              {/* 1. TAPAHTUMAT */}
              {activeTab === 'events' && (
                <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm sm:text-base font-bold text-slate-800">
                        Lähialueen tapahtumat
                      </h2>
                      <p className="text-[11px] text-slate-500">
                        Profiili: <strong>{profile.familyName}</strong> ({profile.filters.targetCity})
                      </p>
                    </div>
                    <span className="text-xs text-slate-500">{INITIAL_EVENTS.length} menoa</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {INITIAL_EVENTS.map((evt) => {
                      const isGoing = attendingIds.includes(evt.id)
                      const matchedGoing = profile.privacy.shareEventsWithMatches
                        ? matchedFamilies.filter((f) => f.attendingEventId === evt.id)
                        : []

                      return (
                        <div
                          key={evt.id}
                          className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between space-y-2.5"
                        >
                          <div className="space-y-2">
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <span className="text-[11px] font-semibold text-blue-600 uppercase">
                                  {evt.city} • {evt.ageGroup}
                                </span>
                                <h3 className="text-base font-bold text-slate-900 leading-snug">
                                  {evt.title}
                                </h3>
                              </div>
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-medium shrink-0">
                                {evt.price}
                              </span>
                            </div>

                            <p className="text-xs text-slate-600">
                              📍 {evt.venue} <br />
                              🕒 {evt.time}
                            </p>

                            {matchedGoing.length > 0 && (
                              <div className="px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                                🤝 Mukana osumistasi:{' '}
                                <strong>{matchedGoing.map((m) => m.name).join(', ')}</strong>
                              </div>
                            )}
                          </div>

                          <div className="pt-1 flex gap-2">
                            <button
                              type="button"
                              onClick={() => toggleEventAttendance(evt.id)}
                              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                                isGoing
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-900 text-white hover:bg-slate-800'
                              }`}
                            >
                              {isGoing ? '✓ Menossa mukaan' : '+ Menossa mukaan'}
                            </button>
                            <button
                              type="button"
                              onClick={() => openOnMap(evt.coords, evt.id)}
                              className="px-3 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100"
                            >
                              Kartalla
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 2. PERHEET */}
              {activeTab === 'families' && (
                <div className="p-4 sm:p-6 space-y-4">
                  <div className="grid grid-cols-2 sm:hidden bg-slate-200 p-1 rounded-xl text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setFamilySubTab('discover')
                        recordDemoSelection('FAMILIES_SUBTAB', 'discover')
                      }}
                      className={`py-2 rounded-lg transition-all ${
                        familySubTab === 'discover'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600'
                      }`}
                    >
                      Selaa ({filteredDeck.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFamilySubTab('matches')
                        recordDemoSelection('FAMILIES_SUBTAB', 'matches')
                      }}
                      className={`py-2 rounded-lg transition-all ${
                        familySubTab === 'matches'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600'
                      }`}
                    >
                      Osumat ({matchedFamilies.length})
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 items-start">
                    <div className={familySubTab === 'discover' ? 'block' : 'hidden sm:block'}>
                      <div className="hidden sm:flex items-center justify-between mb-2">
                        <h2 className="text-sm font-bold text-slate-800">
                          Selaa lähialueen perheitä ({filteredDeck.length})
                        </h2>
                      </div>

                      {currentCard ? (
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden">
                          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-5 text-white">
                            <div className="flex justify-between items-center text-xs opacity-90 mb-1">
                              <span>📍 {currentCard.area}</span>
                              <span>{currentCard.distanceKm} km päässä</span>
                            </div>
                            <h2 className="text-2xl font-extrabold">{currentCard.name}</h2>
                            <p className="text-sm mt-1 font-medium">
                              👶 Lapset: {currentCard.childrenAges}
                            </p>
                            {profile.privacy.showCloseRelativesInMatches &&
                              currentCard.hasCloseRelatives &&
                              currentCard.closeRelativesSummary && (
                                <p className="text-xs mt-1.5 bg-white/15 px-2.5 py-1 rounded-lg inline-block">
                                  🫂 Läheiset: {currentCard.closeRelativesSummary}
                                </p>
                              )}
                          </div>

                          <div className="p-5 space-y-4">
                            <p className="text-sm text-slate-700 leading-relaxed">
                              {currentCard.bio}
                            </p>

                            {(() => {
                              const sharedEvt = INITIAL_EVENTS.find(
                                (e) => e.id === currentCard.attendingEventId,
                              )
                              if (!sharedEvt) return null
                              const bothGoing = attendingIds.includes(sharedEvt.id)
                              return (
                                <div
                                  className={`p-3 rounded-xl border text-xs ${
                                    bothGoing
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                      : 'bg-blue-50 border-blue-200 text-blue-900'
                                  }`}
                                >
                                  <span className="font-bold block">
                                    {bothGoing
                                      ? '✨ Yhteinen tapahtuma!'
                                      : '📅 Menossa tapahtumaan:'}
                                  </span>
                                  {sharedEvt.title} ({sharedEvt.time})
                                </div>
                              )
                            })()}

                            <div className="flex flex-wrap gap-1.5">
                              {currentCard.interests.map((tag) => {
                                const isCommon = profile.interests.includes(tag)
                                return (
                                  <span
                                    key={tag}
                                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                                      isCommon
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold'
                                        : 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    #{tag} {isCommon && '★'}
                                  </span>
                                )
                              })}
                            </div>

                            <div className="pt-2 grid grid-cols-2 gap-3">
                              <button
                                type="button"
                                onClick={() => handleSwipe(false)}
                                className="py-3 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50"
                              >
                                ✕ Ohita
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSwipe(true)}
                                className="py-3 rounded-2xl bg-emerald-600 text-white font-bold text-sm shadow-sm hover:bg-emerald-700"
                              >
                                🤝 Verkostoidu
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white rounded-2xl p-7 text-center border border-slate-200 space-y-3">
                          <p className="text-3xl">🔍</p>
                          <h3 className="font-bold text-slate-900">
                            {profile.privacy.discoverable
                              ? 'Ei enempää hakuehtoihin sopivia perheitä'
                              : 'Profiilisi haku on piilotettu'}
                          </h3>
                          <p className="text-xs text-slate-500">
                            Suodatin ({profile.filters.targetCity} ≤{profile.filters.maxDistanceKm}{' '}
                            km) perustuu profiiliin <strong>{profile.familyName}</strong>.
                          </p>
                          <div className="flex flex-wrap justify-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('profile')
                                setProfileSubView('main')
                              }}
                              className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-800 text-xs font-bold"
                            >
                              Muokkaa filttereitä
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDismissedIds([])
                                recordDemoSelection('DISMISSED_RESET', currentUser.id)
                              }}
                              className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
                            >
                              Palauta ohitetut
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className={familySubTab === 'matches' ? 'block' : 'hidden sm:block'}>
                      <div className="hidden sm:flex items-center justify-between mb-2">
                        <h2 className="text-sm font-bold text-slate-800">
                          Osumat ({matchedFamilies.length})
                        </h2>
                      </div>

                      <div className="space-y-3">
                        {matchedFamilies.length === 0 ? (
                          <div className="bg-white rounded-2xl p-6 text-center border border-slate-200">
                            <p className="text-xs text-slate-500">
                              Ei vielä osumia profiilille {profile.familyName}. Selaa perheitä ja
                              paina Verkostoidu!
                            </p>
                          </div>
                        ) : (
                          matchedFamilies.map((fam) => (
                            <div
                              key={fam.id}
                              className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-3"
                            >
                              <div>
                                <h3 className="font-bold text-sm text-slate-900">{fam.name}</h3>
                                <p className="text-xs text-slate-500">
                                  {fam.area} • {fam.childrenAges}
                                </p>
                                {profile.privacy.showCloseRelativesInMatches &&
                                  fam.hasCloseRelatives &&
                                  fam.closeRelativesSummary && (
                                    <p className="text-[11px] text-emerald-700 mt-0.5">
                                      🫂 {fam.closeRelativesSummary}
                                    </p>
                                  )}
                              </div>
                              <div className="flex gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => openOnMap(fam.coords, fam.id)}
                                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
                                >
                                  Kartta
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setChatTarget(fam)}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                                >
                                  Viesti
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. KARTTA */}
              {activeTab === 'map' && (
                <div className="h-full flex flex-col relative">
                  {mapError ? (
                    <div className="flex-1 flex items-center justify-center p-6 text-center text-xs text-slate-600 bg-slate-100">
                      Karttakirjaston lataus ei onnistunut. Tarkista verkkoyhteys ja avaa kartta
                      uudelleen.
                    </div>
                  ) : (
                    <div ref={mapContainerRef} className="flex-1 w-full" />
                  )}
                  <div className="bg-white border-t border-slate-200 px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs shrink-0">
                    <div className="flex gap-3 font-medium text-slate-700">
                      <span>🔵 Tapahtumat ({INITIAL_EVENTS.length})</span>
                      <span>🟢 Osumat ({matchedFamilies.length})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMapFocusCoords(null)
                        recordDemoSelection('MAP_FOCUS', 'PKS_BOUNDS')
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 font-semibold text-slate-800"
                    >
                      Koko PKS
                    </button>
                  </div>
                </div>
              )}

              {/* 4. PROFIILI (PÄÄNÄKYMÄ) */}
              {activeTab === 'profile' && profileSubView === 'main' && (
                <div className="p-4 sm:p-6 space-y-4 pb-8">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-2xl px-4 py-2.5 border border-slate-200">
                    <div className="text-xs min-w-0">
                      <span className="font-bold text-slate-900">
                        Google-tili: {currentUser.displayName}
                      </span>
                      <span className="ml-2 text-slate-500 font-mono text-[11px]">
                        (_id: family-{currentUser.id})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setProfileSubView('store_inspector')}
                        className="px-3 py-1.5 rounded-xl bg-indigo-950 hover:bg-indigo-900 text-cyan-300 font-mono text-[11px] font-bold transition-colors"
                      >
                        Kanta & feedi ({dbFeedLog.length}) →
                      </button>
                      <button
                        type="button"
                        disabled={authRedirecting}
                        onClick={() => void signOutGoogleSession()}
                        className="px-2.5 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100"
                      >
                        Kirjaudu ulos
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                    <section className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          1. Perheen perustiedot
                        </h2>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          Julkinen kortti
                        </span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Perheen näyttönimi
                        </label>
                        <input
                          value={profile.familyName}
                          onChange={(e) => setProfile({ ...profile, familyName: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Asuinalue / kaupunginosa
                        </label>
                        <input
                          value={profile.area}
                          onChange={(e) => setProfile({ ...profile, area: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Lyhyt esittely muille perheille
                        </label>
                        <textarea
                          rows={2}
                          value={profile.bio}
                          onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                        />
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-slate-800">Perheen jäsenet</p>
                          <p className="text-[11px] text-slate-500">
                            {totalParentsCount} vanhempaa • {profile.children.length} lasta •{' '}
                            {profile.closeRelatives.length} läheistä
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setProfileSubView('members')}
                          className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold shrink-0 hover:bg-slate-800"
                        >
                          Jäsenet →
                        </button>
                      </div>
                    </section>

                    <section className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
                      <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        2. Kiinnostuksen kohteet (Tägit)
                      </h2>
                      <p className="text-[11px] text-slate-500">
                        Yhteiset tägit korostuvat automaattisesti muiden perheiden korteissa.
                      </p>

                      <div className="flex flex-wrap gap-1.5">
                        {Array.from(new Set([...AVAILABLE_TAGS, ...profile.interests])).map(
                          (tag) => {
                            const selected = profile.interests.includes(tag)
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => toggleInterest(tag)}
                                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                                  selected
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                #{tag}
                              </button>
                            )
                          },
                        )}
                      </div>

                      <div className="flex gap-1.5 pt-1">
                        <input
                          value={customTag}
                          onChange={(e) => setCustomTag(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addCustomTag()}
                          placeholder="Oma tägi (esim. Retkeily)..."
                          className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 text-xs"
                        />
                        <button
                          type="button"
                          onClick={addCustomTag}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-bold"
                        >
                          Lisää
                        </button>
                      </div>
                    </section>

                    <section className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          3. Hakufiltterit (Perheet-pakka)
                        </h2>
                        <span className="text-xs font-bold text-emerald-700">
                          {filteredDeck.length} sopivaa
                        </span>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                          <span>Enimmäisetäisyys</span>
                          <span>{profile.filters.maxDistanceKm} km</span>
                        </div>
                        <input
                          type="range"
                          min={2}
                          max={30}
                          value={profile.filters.maxDistanceKm}
                          onChange={(e) => {
                            const km = Number(e.target.value)
                            setProfile({
                              ...profile,
                              filters: { ...profile.filters, maxDistanceKm: km },
                            })
                            recordDemoSelection('RADIUS_FILTER', `${km}km`)
                          }}
                          className="w-full accent-emerald-600"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Kaupunki / alue
                        </label>
                        <select
                          value={profile.filters.targetCity}
                          onChange={(e) => {
                            const city = e.target.value
                            setProfile({
                              ...profile,
                              filters: { ...profile.filters, targetCity: city },
                            })
                            recordDemoSelection('CITY_FILTER', city)
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-medium"
                        >
                          <option value="Kaikki PKS">Kaikki pääkaupunkiseutu</option>
                          <option value="Espoo">Espoo</option>
                          <option value="Helsinki">Helsinki</option>
                          <option value="Kauniainen">Kauniainen</option>
                          <option value="Vantaa">Vantaa</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                          Toivottu lasten ikähaarukka
                        </label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {AGE_GROUP_OPTIONS.map((group) => {
                            const active = profile.filters.targetAgeGroups.includes(group)
                            return (
                              <button
                                key={group}
                                type="button"
                                onClick={() => toggleFilterAgeGroup(group)}
                                className={`py-1.5 rounded-xl text-xs font-bold border ${
                                  active
                                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                                    : 'bg-white border-slate-200 text-slate-500'
                                }`}
                              >
                                {group}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </section>

                    <section className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
                      <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        4. Tietosuoja ja näkyvyys
                      </h2>

                      <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                        <span>Profiili näkyvissä lähialueen haussa</span>
                        <input
                          type="checkbox"
                          checked={profile.privacy.discoverable}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              privacy: { ...profile.privacy, discoverable: e.target.checked },
                            })
                          }
                          className="accent-emerald-600 w-4 h-4"
                        />
                      </label>

                      <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                        <span>Näytä tapahtumat osumaperheille</span>
                        <input
                          type="checkbox"
                          checked={profile.privacy.shareEventsWithMatches}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              privacy: {
                                ...profile.privacy,
                                shareEventsWithMatches: e.target.checked,
                              },
                            })
                          }
                          className="accent-emerald-600 w-4 h-4"
                        />
                      </label>

                      <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                        <span>Näytä läheiset mätseissä ja haussa</span>
                        <input
                          type="checkbox"
                          checked={profile.privacy.showCloseRelativesInMatches}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              privacy: {
                                ...profile.privacy,
                                showCloseRelativesInMatches: e.target.checked,
                              },
                            })
                          }
                          className="accent-emerald-600 w-4 h-4"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => void saveProfileFeedback()}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                      >
                        {profileSavedToast
                          ? `✓ 201 COMMITTED (family-${currentUser.id})`
                          : 'Tallenna profiili ja suodattimet'}
                      </button>

                      <button
                        type="button"
                        onClick={() => void resetAllDemoState()}
                        className="w-full py-2 rounded-xl border border-rose-200 text-rose-700 text-xs font-semibold hover:bg-rose-50"
                      >
                        Palauta käyttäjän {currentUser.displayName} oletustiedot
                      </button>
                    </section>
                  </div>
                </div>
              )}

              {/* 4B. PERHEEN JÄSENTEN NÄKYMÄ */}
              {activeTab === 'profile' && profileSubView === 'members' && (
                <div className="p-4 sm:p-6 space-y-4 pb-8">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingChildId(null)
                        setEditingRelativeId(null)
                        setProfileSubView('main')
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800 hover:bg-slate-100"
                    >
                      ← Takaisin profiiliin
                    </button>
                    <span className="text-xs font-bold text-slate-700">
                      Perheen jäsenet ({profile.familyName})
                    </span>
                  </div>

                  {inviteBanner && (
                    <div className="px-3.5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-sm">
                      {inviteBanner}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                    {/* 1. Vanhemmat & toisen vanhemman sähköpostikutsu */}
                    <section className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          Vanhemmat ({totalParentsCount})
                        </h2>
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold">
                          Perheen ylläpito
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">
                            👤 {currentUser.displayName} (Ensisijainen vanhempi)
                          </p>
                          <p className="text-[11px] text-slate-600 truncate">{currentUser.email}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold shrink-0">
                          Google-tili
                        </span>
                      </div>

                      {profile.coParents.map((cp) => (
                        <div
                          key={cp.id}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate">
                                {cp.status === 'accepted' ? '👥' : '✉️'} {cp.name}
                              </p>
                              <p className="text-[11px] text-slate-600 truncate">{cp.email}</p>
                              <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                                Koodi: {cp.inviteCode}
                              </p>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                cp.status === 'accepted'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {cp.status === 'accepted'
                                ? '✓ Hyväksytty'
                                : `Odottaa (${cp.invitedAt})`}
                            </span>
                          </div>

                          <div className="flex flex-wrap justify-end gap-1.5 pt-1 border-t border-slate-200/70">
                            <button
                              type="button"
                              onClick={() => setPreviewInviteId(cp.id)}
                              className="px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 text-[11px] font-bold hover:bg-blue-100"
                            >
                              Kutsulinkki
                            </button>
                            {cp.status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => simulateAcceptCoParent(cp.id)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700"
                                >
                                  Simuloi hyväksyntä
                                </button>
                                <button
                                  type="button"
                                  onClick={() => resendCoParentInvite(cp.id)}
                                  className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 text-[11px] font-semibold hover:bg-slate-100"
                                >
                                  Lähetä uudelleen
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => removeCoParent(cp.id)}
                              className="px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 text-[11px] font-bold"
                            >
                              Poista
                            </button>
                          </div>
                        </div>
                      ))}

                      <div className="pt-2 border-t border-slate-100 space-y-2">
                        <p className="text-[11px] font-semibold text-slate-700">
                          Kutsu toinen vanhempi sähköpostilla (Demo)
                        </p>
                        <div className="space-y-1.5">
                          <input
                            value={inviteParentName}
                            onChange={(e) => setInviteParentName(e.target.value)}
                            placeholder="Nimi / rooli (esim. Mikko / Puoliso)"
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                          />
                          <div className="flex gap-1.5">
                            <input
                              type="email"
                              value={inviteParentEmail}
                              onChange={(e) => {
                                setInviteParentEmail(e.target.value)
                                if (inviteError) setInviteError('')
                              }}
                              onKeyDown={(e) => e.key === 'Enter' && sendCoParentInvite()}
                              placeholder="puoliso@esimerkki.fi"
                              className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-300 text-xs"
                            />
                            <button
                              type="button"
                              onClick={sendCoParentInvite}
                              className="px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shrink-0 hover:bg-blue-700"
                            >
                              Lähetä kutsu
                            </button>
                          </div>
                        </div>
                        {inviteError && (
                          <p className="text-[11px] text-rose-600 font-medium">{inviteError}</p>
                        )}
                      </div>
                    </section>

                    <div className="space-y-4">
                      {/* 2. Lapset-osio */}
                      <section className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                            Lapset ({profile.children.length})
                          </h2>
                          <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold">
                            Näkyy perhekortissa
                          </span>
                        </div>

                        {profile.children.length === 0 ? (
                          <p className="text-xs text-slate-500">Ei lisättyjä lapsia.</p>
                        ) : (
                          <div className="space-y-2">
                            {profile.children.map((child) => {
                              const isEditing = editingChildId === child.id
                              return (
                                <div
                                  key={child.id}
                                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2"
                                >
                                  {isEditing ? (
                                    <div className="space-y-2">
                                      <div className="flex gap-1.5">
                                        <input
                                          value={editChildAge}
                                          onChange={(e) => setEditChildAge(e.target.value)}
                                          className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                                        />
                                        <select
                                          value={editChildGroup}
                                          onChange={(e) => setEditChildGroup(e.target.value)}
                                          className="px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                                        >
                                          {AGE_GROUP_OPTIONS.map((g) => (
                                            <option key={g} value={g}>
                                              {g}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="flex justify-end gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => setEditingChildId(null)}
                                          className="px-2.5 py-1 rounded-lg border border-slate-300 text-slate-600 font-semibold"
                                        >
                                          Peruuta
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => saveEditChild(child.id)}
                                          className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold"
                                        >
                                          Tallenna
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between gap-2">
                                      <div>
                                        <span className="font-bold text-slate-900">
                                          👶 {child.ageLabel}
                                        </span>
                                        <span className="ml-2 px-2 py-0.5 rounded-full bg-teal-100 text-teal-900 text-[10px] font-semibold">
                                          {child.group}
                                        </span>
                                      </div>
                                      <div className="flex gap-1 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => startEditChild(child)}
                                          className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-100"
                                        >
                                          Muokkaa
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => removeChild(child.id)}
                                          className="px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 font-bold"
                                        >
                                          Poista
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        <div className="flex gap-1.5 pt-1">
                          <input
                            value={newChildAge}
                            onChange={(e) => {
                              setNewChildAge(e.target.value)
                              if (childError) setChildError('')
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && addChild()}
                            placeholder="Ikä esim. 3 v"
                            className="w-24 px-2.5 py-2 rounded-xl border border-slate-300 text-xs"
                          />
                          <select
                            value={newChildGroup}
                            onChange={(e) => setNewChildGroup(e.target.value)}
                            className="px-2 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                          >
                            {AGE_GROUP_OPTIONS.map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={addChild}
                            className="flex-1 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
                          >
                            + Lisää lapsi
                          </button>
                        </div>
                        {childError && (
                          <p className="text-[11px] text-rose-600 font-medium">{childError}</p>
                        )}
                      </section>

                      {/* 3. Läheiset-osio */}
                      <section className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                            Läheiset ({profile.closeRelatives.length})
                          </h2>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              profile.privacy.showCloseRelativesInMatches
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {profile.privacy.showCloseRelativesInMatches
                              ? 'Näkyy mätseissä'
                              : 'Piilotettu mätseiltä'}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-500">
                          Oletuksena läheisiä ei näytetä mätseille. Voit vaihtaa näkyvyyden alta tai
                          profiilin tietosuoja-asetuksista.
                        </p>

                        <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 cursor-pointer">
                          <span>Näytä läheiset mätseissä ja haussa</span>
                          <input
                            type="checkbox"
                            checked={profile.privacy.showCloseRelativesInMatches}
                            onChange={(e) =>
                              setProfile({
                                ...profile,
                                privacy: {
                                  ...profile.privacy,
                                  showCloseRelativesInMatches: e.target.checked,
                                },
                              })
                            }
                            className="accent-emerald-600 w-4 h-4"
                          />
                        </label>

                        {profile.closeRelatives.length === 0 ? (
                          <p className="text-xs text-slate-500">Ei lisättyjä läheisiä.</p>
                        ) : (
                          <div className="space-y-2">
                            {profile.closeRelatives.map((rel) => {
                              const isEditing = editingRelativeId === rel.id
                              return (
                                <div
                                  key={rel.id}
                                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2"
                                >
                                  {isEditing ? (
                                    <div className="space-y-2">
                                      <div className="flex gap-1.5">
                                        <select
                                          value={editRelativeRole}
                                          onChange={(e) => setEditRelativeRole(e.target.value)}
                                          className="px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                                        >
                                          {RELATIVE_ROLES.map((role) => (
                                            <option key={role} value={role}>
                                              {role}
                                            </option>
                                          ))}
                                        </select>
                                        <input
                                          value={editRelativeNote}
                                          onChange={(e) => setEditRelativeNote(e.target.value)}
                                          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                                        />
                                      </div>
                                      <div className="flex justify-end gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => setEditingRelativeId(null)}
                                          className="px-2.5 py-1 rounded-lg border border-slate-300 text-slate-600 font-semibold"
                                        >
                                          Peruuta
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => saveEditRelative(rel.id)}
                                          className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold"
                                        >
                                          Tallenna
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between gap-2">
                                      <div>
                                        <span className="font-bold text-slate-900">
                                          🫂 {rel.relationLabel}
                                        </span>
                                        <span className="ml-2 text-slate-600">{rel.note}</span>
                                      </div>
                                      <div className="flex gap-1 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => startEditRelative(rel)}
                                          className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-100"
                                        >
                                          Muokkaa
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => removeCloseRelative(rel.id)}
                                          className="px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 font-bold"
                                        >
                                          Poista
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        <div className="flex gap-1.5 pt-1">
                          <select
                            value={newRelativeRole}
                            onChange={(e) => setNewRelativeRole(e.target.value)}
                            className="px-2 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                          >
                            {RELATIVE_ROLES.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                          <input
                            value={newRelativeNote}
                            onChange={(e) => setNewRelativeNote(e.target.value)}
                            placeholder="Lisätieto (esim. mummi / kummi)"
                            className="flex-1 min-w-0 px-2.5 py-2 rounded-xl border border-slate-300 text-xs"
                          />
                          <button
                            type="button"
                            onClick={addCloseRelative}
                            className="px-3 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold shrink-0"
                          >
                            + Lisää
                          </button>
                        </div>
                      </section>
                    </div>
                  </div>
                </div>
              )}

              {/* 4C. ERILLINEN KANTA- JA DATANÄYTTÖ */}
              {activeTab === 'profile' && profileSubView === 'store_inspector' && (
                <div className="p-4 sm:p-6 space-y-4 pb-8 bg-gradient-to-b from-indigo-950 via-slate-950 to-purple-950 min-h-full text-indigo-50">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setProfileSubView('main')}
                      className="px-3 py-1.5 rounded-xl bg-indigo-900/90 border border-indigo-600/60 text-xs font-bold text-indigo-100 hover:bg-indigo-800"
                    >
                      ← Takaisin profiiliin
                    </button>
                    <span className="px-2.5 py-1 rounded-full bg-fuchsia-500/20 border border-fuchsia-400/50 font-mono text-[10px] font-bold text-fuchsia-300 truncate">
                      FILE_MONGO_INSPECTOR • family-{currentUser.id}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                    <section className="rounded-2xl p-4 bg-indigo-950/90 border border-indigo-500/50 space-y-2.5 shadow-lg">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="font-mono text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                          📜 Kantaoperaatioiden feedi (backscroll)
                        </h2>
                        <span className="font-mono text-[10px] text-indigo-300">
                          {dbFeedLog.length} merkintää • REV #{mongoRevision}
                        </span>
                      </div>

                      <div className="max-h-72 sm:max-h-[460px] overflow-y-auto space-y-2 pr-1 font-mono">
                        {dbFeedLog.length === 0 ? (
                          <p className="text-[11px] text-indigo-300/80 py-4 text-center">
                            Ei vielä kantakirjauksia tässä istunnossa.
                          </p>
                        ) : (
                          dbFeedLog.map((entry) => (
                            <div
                              key={entry.id}
                              className="rounded-xl bg-slate-950/95 border border-indigo-700/60 p-2.5 space-y-1 text-[10px]"
                            >
                              <p className="text-emerald-300 break-all font-semibold">
                                {entry.terminalLine}
                              </p>
                              <p className="text-cyan-200/90">{entry.diffStamp}</p>
                              <p className="text-fuchsia-300 italic">&gt; {entry.quip}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </section>

                    <section className="rounded-2xl p-4 bg-purple-950/60 border border-purple-500/40 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <h2 className="font-mono text-[11px] font-bold uppercase tracking-wider text-fuchsia-300">
                          Kantaan tallentuvat tiedot (`family-{currentUser.id}`)
                        </h2>
                        <span className="font-mono text-[10px] text-indigo-300">
                          {mongoInstanceLabel || 'default'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 font-mono text-center">
                        <div className="rounded-xl bg-indigo-950/80 border border-indigo-700/50 p-2">
                          <div className="text-base font-extrabold text-cyan-300">
                            {totalParentsCount}
                          </div>
                          <div className="text-[10px] text-indigo-300">vanhempaa</div>
                        </div>
                        <div className="rounded-xl bg-indigo-950/80 border border-indigo-700/50 p-2">
                          <div className="text-base font-extrabold text-fuchsia-300">
                            {profile.children.length}
                          </div>
                          <div className="text-[10px] text-indigo-300">lasta</div>
                        </div>
                        <div className="rounded-xl bg-indigo-950/80 border border-indigo-700/50 p-2">
                          <div className="text-base font-extrabold text-amber-300">
                            {profile.closeRelatives.length}
                          </div>
                          <div className="text-[10px] text-indigo-300">läheistä</div>
                        </div>
                      </div>

                      <pre className="mt-2 p-3 rounded-xl bg-slate-950/95 border border-indigo-800/70 text-[10px] font-mono text-cyan-200 overflow-x-auto max-h-64 sm:max-h-[360px] leading-relaxed">
                        {JSON.stringify(
                          {
                            _id: `family-${currentUser.id}`,
                            userId: currentUser.id,
                            googleEmail: currentUser.email,
                            updatedAt: mongoUpdatedAt || null,
                            familyName: profile.familyName,
                            area: profile.area,
                            coParents: profile.coParents,
                            children: profile.children,
                            closeRelatives: profile.closeRelatives,
                            interests: profile.interests,
                            filters: profile.filters,
                            privacy: profile.privacy,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </section>
                  </div>
                </div>
              )}
            </main>

            {/* KUTSU- JA LINKKIESIKATSELUMODAALI */}
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

                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      &ldquo;Sinut on kutsuttu liittymään perheeseen {profile.familyName}{' '}
                      PerhePiiri-sovelluksessa. Avaa linkki tai syötä koodi{' '}
                      {activePreviewInvite.inviteCode}.&rdquo;
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

            {/* PIKAVIESTIMODAALI */}
            {chatTarget && (
              <div className="absolute inset-0 bg-slate-900/50 z-50 flex items-end sm:items-center sm:justify-center sm:p-4">
                <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 space-y-3 shadow-xl">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">💬 {chatTarget.name}</h3>
                      <p className="text-[11px] text-slate-500">{chatTarget.area}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setChatTarget(null)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-bold"
                    >
                      Sulje
                    </button>
                  </div>

                  <div className="h-36 sm:h-48 overflow-y-auto space-y-2 bg-slate-50 p-3 rounded-xl text-xs">
                    {(messages[chatTarget.id] || []).length === 0 ? (
                      <p className="text-slate-400 text-center pt-10 sm:pt-16">
                        Aloita keskustelu tai valitse pikaviestiehdotus alta!
                      </p>
                    ) : (
                      (messages[chatTarget.id] || []).map((m, idx) => (
                        <div
                          key={idx}
                          className="bg-emerald-600 text-white px-3 py-2 rounded-2xl rounded-br-none ml-auto max-w-[80%]"
                        >
                          {m}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() =>
                        sendQuickMessage('Moikka! Mennäänkö samaan tapahtumaan viikonloppuna?')
                      }
                      className="shrink-0 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-medium"
                    >
                      👋 Nähdäänkö tapahtumassa?
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        sendQuickMessage('Hei! Meillä on samanikäiset lapset, puistotreffit joskus?')
                      }
                      className="shrink-0 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-medium"
                    >
                      🛝 Puistotreffit?
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendQuickMessage()}
                      placeholder="Kirjoita viesti..."
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => sendQuickMessage()}
                      className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                    >
                      Lähetä
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* KIINTEÄ ALAPALKKINAVIGAATIO */}
            <nav className="bg-white border-t border-slate-200 grid grid-cols-4 py-2 shrink-0">
              {[
                { key: 'events', icon: '📅', label: 'Tapahtumat' },
                { key: 'families', icon: '🤝', label: 'Perheet' },
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

      {/* KELLUVA 1: DEMOAAMISVALINTOJEN SEURANTA (NO_DB_PII) */}
      {showDemoMonitor && (
        <FloatingDockWindow
          title={currentUser ? `DEMO_SEURANTA (${currentUser.id})` : 'DEMO_SEURANTA'}
          badge="NO_DB_PII"
          pos={demoFloatPos}
          onPosChange={setDemoFloatPos}
          onClose={() => setShowDemoMonitor(false)}
          headerToneClass="bg-zinc-900 text-amber-400"
          borderToneClass="border-amber-500/40"
        >
          <div className="flex items-center justify-between font-mono text-[10px] text-zinc-400">
            <span>
              evt:{attendingIds.length} match:{matchedIds.length} skip:{dismissedIds.length}
            </span>
            <span className="text-cyan-400">
              {profile.filters.targetCity} ≤{profile.filters.maxDistanceKm}km
            </span>
          </div>
          <div className="bg-zinc-900 rounded-lg px-2 py-1.5 border border-zinc-800 font-mono text-[10px] text-zinc-200 truncate">
            {demoSelections[0]
              ? `[${demoSelections[0].time}] ${demoSelections[0].action}: ${demoSelections[0].detail}`
              : 'READY'}
          </div>
          {demoSelections.length > 1 && (
            <div className="max-h-14 overflow-y-auto space-y-0.5 font-mono text-[9px] text-zinc-400">
              {demoSelections.slice(1, 6).map((item) => (
                <div key={item.id} className="truncate">
                  [{item.time}] {item.action} → {item.detail}
                </div>
              ))}
            </div>
          )}
        </FloatingDockWindow>
      )}

      {/* KELLUVA 2: KANTAFEEDI & NÖRTTIHUUMORI */}
      {showNerdDbFloat && (
        <FloatingDockWindow
          title={`FILE_MONGO // REV #${mongoRevision}`}
          badge={dbSyncStatus.toUpperCase()}
          pos={dbFloatPos}
          onPosChange={setDbFloatPos}
          onClose={() => setShowNerdDbFloat(false)}
          headerToneClass="bg-indigo-950 text-cyan-300"
          borderToneClass="border-indigo-500/50"
        >
          {latestDbEntry ? (
            <div className="space-y-1 font-mono text-[10px]">
              <p className="text-emerald-300 break-all">{latestDbEntry.terminalLine}</p>
              <p className="text-cyan-200/90">{latestDbEntry.diffStamp}</p>
              <p className="text-fuchsia-300 italic">&gt; {latestDbEntry.quip}</p>
            </div>
          ) : (
            <p className="font-mono text-[10px] text-indigo-300">
              {currentUser
                ? `odottaa kantakirjoitusta (family-${currentUser.id})...`
                : 'kirjaudu Google-tilillä avataksesi kannan...'}
            </p>
          )}

          <div className="flex items-center justify-between pt-1 border-t border-white/10">
            <span className="font-mono text-[9px] text-indigo-300">
              feedi: {dbFeedLog.length} riviä
            </span>
            {currentUser && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('profile')
                  setProfileSubView('store_inspector')
                }}
                className="px-2 py-1 rounded bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-mono text-[10px] font-bold"
              >
                Avaa backscroll →
              </button>
            )}
          </div>
        </FloatingDockWindow>
      )}
    </div>
  )
}