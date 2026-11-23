export interface ChildItem {
  id: string
  ageLabel: string
  group: string
}

export interface CloseRelativeItem {
  id: string
  relationLabel: string
  note: string
}

export interface CoParentItem {
  id: string
  name: string
  email: string
  status: 'pending' | 'accepted'
  invitedAt: string
  inviteCode: string
}

export interface FamilyDefaultPreset {
  enabled: boolean
  useChildrenAgeInference: boolean
  favoriteActivities: string[] // 3–5 perheen mieliaktiviteettia
  onlyFreeEvents: boolean
  weekendOrEveningFocus: boolean
}

export interface UserProfileState {
  familyName: string
  homeCity: string
  area: string
  homeCoords: [number, number]
  onboardingCompleted: boolean
  children: ChildItem[]
  closeRelatives: CloseRelativeItem[]
  coParents: CoParentItem[]
  interests: string[]
  defaultPreset: FamilyDefaultPreset
  filters: {
    maxDistanceKm: number
    targetCity: string
    targetAgeGroups: string[]
  }
  privacy: {
    discoverable: boolean
    shareEventsWithMatches: boolean
    showCloseRelativesInMatches: boolean
  }
}

export interface FamilyEvent {
  id: string
  title: string
  venue: string
  city: string
  address?: string
  coords: [number, number]
  time: string
  ageGroup: string
  price: string
  description?: string
  url?: string
  keywords?: string[]
  tags?: string[]
}

export interface FamilyProfile {
  id: string
  name: string
  area: string
  city: string
  coords: [number, number]
  childrenAges: string
  ageGroups: string[]
  bio: string
  interests: string[]
  attendingEventId?: string
  hasCloseRelatives: boolean
  closeRelativesSummary?: string
}

export interface DemoSelectionEvent {
  id: string
  time: string
  action: string
  detail: string
}

export interface DbCommitFeedEntry {
  id: string
  statusCode: string
  terminalLine: string
  diffStamp: string
  quip: string
  revision: number
}

export type DbSyncStatus = 'idle' | 'saving' | 'saved' | 'error'
export type TabKey = 'events' | 'families' | 'hub' | 'map' | 'profile'
export type ProfileSubView = 'main' | 'members' | 'store_inspector'

export interface FloatingPos {
  x: number
  y: number
}

export interface AuthenticatedGoogleUser {
  id: string
  displayName: string
  email: string
  avatarUrl?: string
}

export interface PersistedSessionState {
  attendingIds: string[]
  dismissedIds: string[]
  matchedIds: string[]
  messages: Record<string, string[]>
}

export const SESSION_STORAGE_PREFIX = 'perhepiiri_session_v1_'

export const PKS_DEFAULT_BOUNDS: [[number, number], [number, number]] = [
  [60.135, 24.585],
  [60.345, 25.165],
]

export const AREA_COORDS: Record<string, { city: string; coords: [number, number] }> = {
  'Espoo • Leppävaara': { city: 'Espoo', coords: [60.2185, 24.8126] },
  'Espoo • Tapiola': { city: 'Espoo', coords: [60.1756, 24.8041] },
  'Espoo • Matinkylä & Olari': { city: 'Espoo', coords: [60.1602, 24.7385] },
  'Espoo • Espoon keskus': { city: 'Espoo', coords: [60.2055, 24.6559] },
  'Espoo • Espoonlahti': { city: 'Espoo', coords: [60.1502, 24.6525] },
  'Kauniainen • Grani': { city: 'Kauniainen', coords: [60.2148, 24.7267] },
  'Helsinki • Kallio & Vallila': { city: 'Helsinki', coords: [60.1841, 24.9502] },
  'Helsinki • Lauttasaari': { city: 'Helsinki', coords: [60.1588, 24.8814] },
  'Helsinki • Töölö & Pasila': { city: 'Helsinki', coords: [60.1986, 24.9336] },
  'Helsinki • Vuosaari': { city: 'Helsinki', coords: [60.2087, 25.1439] },
  'Vantaa • Tikkurila': { city: 'Vantaa', coords: [60.2934, 25.0378] },
  'Vantaa • Myyrmäki': { city: 'Vantaa', coords: [60.2614, 24.8548] },
}

// 10 uutta oletustägiä / mieliaktiviteettia
export const DEFAULT_ACTIVITY_TAGS: string[] = [
  'Ulkoilu & puistot',
  'Askartelu & taide',
  'Musiikki & lorut',
  'Kirjasto & sadut',
  'Uiminen & vesi',
  'Retket & luonto',
  'Palloilu & liikunta',
  'Lautapelit & leikki',
  'Teatteri & kulttuuri',
  'Perhekahvilat',
]

export const AGE_GROUP_OPTIONS = ['0-3v', '4-6v', '7-12v', '13+v']
export const RELATIVE_ROLES = ['Isovanhempi', 'Kummi', 'Täti/Setä', 'Muu läheinen']

export const NERD_DB_QUIPS: string[] = [
  'ACID-takuu: jopa perheen iltapuuro säilyy ehjänä.',
  'Indeksi kunnossa: etäisyys 15 km ja lapset synkassa.',
  'Ei lukkiutumisia, toisin kuin aamuruuhkassa Kehä I:llä.',
  'JSON-dokumentti kommitoitu ilman draamaa tai 404-virheitä.',
  'Oletusfiltterit tallessa — ei tarvitse klikkailla joka aamu.',
]

export const BASE_DEFAULT_PROFILE: UserProfileState = {
  familyName: 'Oma perhe',
  homeCity: 'Espoo',
  area: 'Espoo • Leppävaara',
  homeCoords: [60.2185, 24.8126],
  onboardingCompleted: false,
  children: [{ id: 'c-1', ageLabel: '5 v', group: '4-6v' }],
  closeRelatives: [],
  coParents: [],
  interests: [
    'Ulkoilu & puistot',
    'Kirjasto & sadut',
    'Uiminen & vesi',
    'Retket & luonto',
  ],
  defaultPreset: {
    enabled: true,
    useChildrenAgeInference: true,
    favoriteActivities: [
      'Ulkoilu & puistot',
      'Kirjasto & sadut',
      'Uiminen & vesi',
      'Retket & luonto',
    ],
    onlyFreeEvents: false,
    weekendOrEveningFocus: false,
  },
  filters: {
    maxDistanceKm: 15,
    targetCity: 'Kaikki PKS',
    targetAgeGroups: ['4-6v'],
  },
  privacy: {
    discoverable: true,
    shareEventsWithMatches: true,
    showCloseRelativesInMatches: false,
  },
}

export function inferAgeGroupFromChild(child: ChildItem): string {
  if (child.group && AGE_GROUP_OPTIONS.includes(child.group)) {
    return child.group
  }
  const numMatch = child.ageLabel.match(/\d+/)
  if (numMatch) {
    const age = Number(numMatch[0])
    if (age <= 3) return '0-3v'
    if (age <= 6) return '4-6v'
    if (age <= 12) return '7-12v'
    return '13+v'
  }
  return '4-6v'
}

export function inferAgeGroupsFromChildren(children: ChildItem[]): string[] {
  const inferred = new Set<string>()
  for (const child of children) {
    inferred.add(inferAgeGroupFromChild(child))
  }
  return Array.from(inferred)
}

export function emailToUserId(email: string): string {
  const normalized = email.trim().toLowerCase()
  const safe = normalized.replace(/[^a-z0-9@._-]+/g, '_').replace(/[^a-z0-9_-]+/g, '_')
  return (safe || 'google_user').slice(0, 80)
}

export function buildInitialProfileForGoogleUser(
  user: AuthenticatedGoogleUser,
): UserProfileState {
  const firstName = user.displayName.split(/\s+/)[0] || 'Oma'
  return {
    ...BASE_DEFAULT_PROFILE,
    familyName: `${firstName}n perhe`,
    onboardingCompleted: false,
    children: [{ id: 'c-1', ageLabel: '5 v', group: '4-6v' }],
    closeRelatives: [],
    coParents: [],
    interests: [...BASE_DEFAULT_PROFILE.interests],
    defaultPreset: {
      ...BASE_DEFAULT_PROFILE.defaultPreset,
      favoriteActivities: [...BASE_DEFAULT_PROFILE.defaultPreset.favoriteActivities],
    },
    filters: {
      ...BASE_DEFAULT_PROFILE.filters,
      maxDistanceKm: 15,
      targetCity: 'Kaikki PKS',
      targetAgeGroups: ['4-6v'],
    },
    privacy: { ...BASE_DEFAULT_PROFILE.privacy },
  }
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let part = ''
  for (let i = 0; i < 6; i++) {
    part += chars[Math.floor(Math.random() * chars.length)]
  }
  return `PP-${part}`
}

export function buildInviteUrl(invite: CoParentItem): string {
  const base =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://perhepiiri.fi'
  return `${base}/kutsu?code=${encodeURIComponent(invite.inviteCode)}&to=${encodeURIComponent(
    invite.email,
  )}`
}

export function normalizeProfile(
  raw: unknown,
  fallback: UserProfileState = BASE_DEFAULT_PROFILE,
): UserProfileState {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const area = typeof obj.area === 'string' && obj.area.trim() ? obj.area : fallback.area
  const areaMeta = AREA_COORDS[area]
  const homeCity =
    typeof obj.homeCity === 'string' && obj.homeCity.trim()
      ? obj.homeCity
      : areaMeta?.city ?? fallback.homeCity

  const rawCoords = Array.isArray(obj.homeCoords) && obj.homeCoords.length >= 2 ? obj.homeCoords : null
  const lat = rawCoords && typeof rawCoords[0] === 'number' ? rawCoords[0] : undefined
  const lng = rawCoords && typeof rawCoords[1] === 'number' ? rawCoords[1] : undefined
  const homeCoords: [number, number] =
    typeof lat === 'number' && typeof lng === 'number'
      ? [lat, lng]
      : areaMeta?.coords ?? fallback.homeCoords

  const children: ChildItem[] = Array.isArray(obj.children)
    ? obj.children
        .filter((c): c is Record<string, unknown> => Boolean(c && typeof c === 'object'))
        .map((c, i) => ({
          id: typeof c.id === 'string' ? c.id : `c-${i + 1}`,
          ageLabel: typeof c.ageLabel === 'string' ? c.ageLabel : '4 v',
          group:
            typeof c.group === 'string' && AGE_GROUP_OPTIONS.includes(c.group)
              ? c.group
              : '4-6v',
        }))
    : [...fallback.children]

  const closeRelatives: CloseRelativeItem[] = Array.isArray(obj.closeRelatives)
    ? obj.closeRelatives
        .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === 'object'))
        .map((r, i) => ({
          id: typeof r.id === 'string' ? r.id : `r-${i + 1}`,
          relationLabel:
            typeof r.relationLabel === 'string' ? r.relationLabel : 'Isovanhempi',
          note: typeof r.note === 'string' ? r.note : '',
        }))
    : [...fallback.closeRelatives]

  const coParents: CoParentItem[] = Array.isArray(obj.coParents)
    ? obj.coParents
        .filter((p): p is Record<string, unknown> => Boolean(p && typeof p === 'object'))
        .map((p, i) => ({
          id: typeof p.id === 'string' ? p.id : `cp-${i + 1}`,
          name: typeof p.name === 'string' ? p.name : 'Toinen vanhempi',
          email: typeof p.email === 'string' ? p.email : '',
          status: p.status === 'accepted' ? 'accepted' : 'pending',
          invitedAt: typeof p.invitedAt === 'string' ? p.invitedAt : '',
          inviteCode:
            typeof p.inviteCode === 'string' ? p.inviteCode : generateInviteCode(),
        }))
    : [...fallback.coParents]

  const interests = Array.isArray(obj.interests)
    ? obj.interests.map(String).filter(Boolean)
    : [...fallback.interests]

  const rawPreset =
    obj.defaultPreset && typeof obj.defaultPreset === 'object'
      ? (obj.defaultPreset as Record<string, unknown>)
      : {}

  const favoriteActivities = Array.isArray(rawPreset.favoriteActivities)
    ? rawPreset.favoriteActivities.map(String).filter(Boolean).slice(0, 5)
    : interests.slice(0, 5)

  const defaultPreset: FamilyDefaultPreset = {
    enabled:
      typeof rawPreset.enabled === 'boolean'
        ? rawPreset.enabled
        : fallback.defaultPreset.enabled,
    useChildrenAgeInference:
      typeof rawPreset.useChildrenAgeInference === 'boolean'
        ? rawPreset.useChildrenAgeInference
        : fallback.defaultPreset.useChildrenAgeInference,
    favoriteActivities:
      favoriteActivities.length > 0
        ? favoriteActivities
        : [...fallback.defaultPreset.favoriteActivities],
    onlyFreeEvents:
      typeof rawPreset.onlyFreeEvents === 'boolean'
        ? rawPreset.onlyFreeEvents
        : fallback.defaultPreset.onlyFreeEvents,
    weekendOrEveningFocus:
      typeof rawPreset.weekendOrEveningFocus === 'boolean'
        ? rawPreset.weekendOrEveningFocus
        : fallback.defaultPreset.weekendOrEveningFocus,
  }

  const rawFilters =
    obj.filters && typeof obj.filters === 'object'
      ? (obj.filters as Record<string, unknown>)
      : {}

  const inferredAges = inferAgeGroupsFromChildren(children)
  const targetAgeGroups = Array.isArray(rawFilters.targetAgeGroups)
    ? rawFilters.targetAgeGroups.map(String).filter(Boolean)
    : inferredAges.length > 0
      ? inferredAges
      : [...fallback.filters.targetAgeGroups]

  const rawPrivacy =
    obj.privacy && typeof obj.privacy === 'object'
      ? (obj.privacy as Record<string, unknown>)
      : {}

  return {
    familyName:
      typeof obj.familyName === 'string' && obj.familyName.trim()
        ? obj.familyName
        : fallback.familyName,
    homeCity,
    area,
    homeCoords,
    onboardingCompleted:
      typeof obj.onboardingCompleted === 'boolean'
        ? obj.onboardingCompleted
        : fallback.onboardingCompleted,
    children,
    closeRelatives,
    coParents,
    interests,
    defaultPreset,
    filters: {
      maxDistanceKm:
        typeof rawFilters.maxDistanceKm === 'number' && rawFilters.maxDistanceKm > 0
          ? rawFilters.maxDistanceKm
          : 15,
      targetCity:
        typeof rawFilters.targetCity === 'string' && rawFilters.targetCity.trim()
          ? rawFilters.targetCity
          : fallback.filters.targetCity,
      targetAgeGroups,
    },
    privacy: {
      discoverable:
        typeof rawPrivacy.discoverable === 'boolean'
          ? rawPrivacy.discoverable
          : fallback.privacy.discoverable,
      shareEventsWithMatches:
        typeof rawPrivacy.shareEventsWithMatches === 'boolean'
          ? rawPrivacy.shareEventsWithMatches
          : fallback.privacy.shareEventsWithMatches,
      showCloseRelativesInMatches:
        typeof rawPrivacy.showCloseRelativesInMatches === 'boolean'
          ? rawPrivacy.showCloseRelativesInMatches
          : fallback.privacy.showCloseRelativesInMatches,
    },
  }
}

export const INITIAL_EVENTS: FamilyEvent[] = [
  {
    id: 'evt-1',
    title: 'Sunnuntain koko perheen ulkoiluretki & eväät',
    venue: 'Leppävaaran urheilupuisto',
    city: 'Espoo',
    coords: [60.221, 24.815],
    time: 'Su 22.11. klo 10:00',
    ageGroup: '4-6v',
    price: 'Maksuton',
    description: 'Matalan kynnyksen ulkoiluhetki ja evästauko toisille perheille.',
    tags: ['Ulkoilu & puistot', 'Retket & luonto'],
  },
  {
    id: 'evt-2',
    title: 'Satutuokio ja askartelupaja lapsille',
    venue: 'Sellon kirjasto',
    city: 'Espoo',
    coords: [60.2179, 24.8112],
    time: 'Ke 25.11. klo 17:30',
    ageGroup: '0-3v',
    price: 'Maksuton',
    description: 'Lukuhetki ja helppoa askartelua pienille ja vanhemmille.',
    tags: ['Kirjasto & sadut', 'Askartelu & taide'],
  },
]

export const DEMO_FAMILIES: FamilyProfile[] = [
  {
    id: 'fam-1',
    name: 'Mäkelän perhe',
    area: 'Leppävaara, Espoo',
    city: 'Espoo',
    coords: [60.2195, 24.814],
    childrenAges: '5 v',
    ageGroups: ['4-6v'],
    bio: 'Ulkoillaan paljon lähipuistoissa ja käydään viikonloppuisin kirjastossa sekä uimahallissa.',
    interests: ['Ulkoilu & puistot', 'Kirjasto & sadut', 'Uiminen & vesi'],
    attendingEventId: 'evt-1',
    hasCloseRelatives: true,
    closeRelativesSummary: 'Isovanhemmat asuvat lähellä',
  },
  {
    id: 'fam-2',
    name: 'Lindholmin perhe',
    area: 'Tapiola, Espoo',
    city: 'Espoo',
    coords: [60.1762, 24.8055],
    childrenAges: '2 v & 6 v',
    ageGroups: ['0-3v', '4-6v'],
    bio: 'Etsitään leikkipuisto- ja retkiseuraa arki-iltoihin ja viikonloppuihin.',
    interests: ['Ulkoilu & puistot', 'Retket & luonto', 'Palloilu & liikunta'],
    attendingEventId: 'evt-2',
    hasCloseRelatives: false,
  },
  {
    id: 'fam-3',
    name: 'Koskisen perhe',
    area: 'Kallio, Helsinki',
    city: 'Helsinki',
    coords: [60.1845, 24.951],
    childrenAges: '8 v',
    ageGroups: ['7-12v'],
    bio: 'Tykkäämme lautapeleistä, museoretkistä ja koko perheen teatteriesityksistä.',
    interests: ['Lautapelit & leikki', 'Teatteri & kulttuuri'],
    hasCloseRelatives: false,
  },
]

export const INITIAL_ATTENDING_IDS: string[] = ['evt-1']

export function nowClock(): string {
  return new Date().toLocaleTimeString('fi-FI', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function calcDistanceKm(a: [number, number], b: [number, number]): number {
  const R = 6371
  const dLat = ((b[0] - a[0]) * Math.PI) / 180
  const dLng = ((b[1] - a[1]) * Math.PI) / 180
  const lat1 = (a[0] * Math.PI) / 180
  const lat2 = (b[0] * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
  return Math.round(R * c * 10) / 10
}

export function calcFamilyMatch(
  userProfile: UserProfileState,
  candidate: FamilyProfile,
  distanceKm: number,
  attendingIds: string[],
): {
  percent: number
  interestsPts: number
  distancePts: number
  agePts: number
  eventPts: number
} 
{
  const activeTags =
    userProfile.defaultPreset.favoriteActivities.length > 0
      ? userProfile.defaultPreset.favoriteActivities
      : userProfile.interests

  const commonTags = candidate.interests.filter((t) => activeTags.includes(t))
  const interestsPts = Math.min(40, Math.round((commonTags.length / Math.max(1, activeTags.length)) * 40))

  const maxD = Math.max(1, userProfile.filters.maxDistanceKm || 15)
  const distancePts = Math.max(0, Math.min(30, Math.round((1 - distanceKm / maxD) * 30)))

  const targetAges =
    userProfile.defaultPreset.useChildrenAgeInference && userProfile.children.length > 0
      ? inferAgeGroupsFromChildren(userProfile.children)
      : userProfile.filters.targetAgeGroups

  const ageOverlap = candidate.ageGroups.some((g) => targetAges.includes(g))
  const agePts = ageOverlap ? 20 : 0

  const eventPts =
    candidate.attendingEventId && attendingIds.includes(candidate.attendingEventId) ? 10 : 0

  const percent = Math.min(100, interestsPts + distancePts + agePts + eventPts)
  return { percent, interestsPts, distancePts, agePts, eventPts }
}
export interface MllCafeSpot {
  id: string
  name: string
  organizer: string
  city: 'Espoo' | 'Helsinki' | 'Vantaa' | 'Kauniainen'
  district: string
  venue: string
  address: string
  schedule: string
  ageGroup: string
  coords: [number, number]
  url?: string
}

export const PKS_MLL_FAMILY_CAFES: MllCafeSpot[] = [
  {
    id: 'mll-espoo-leppavaara',
    name: 'MLL Leppävaaran perhekahvila',
    organizer: 'MLL Leppävaaran yhdistys ry',
    city: 'Espoo',
    district: 'Leppävaara',
    venue: 'Asukaspuisto Perkkaa / Leppävaara',
    address: 'Majurinkatu 3, 02600 Espoo',
    schedule: 'Tiistaisin klo 9.30–11.30',
    ageGroup: '0–6 v & vanhemmat',
    coords: [60.2158, 24.8152],
    url: 'https://leppavaara.mll.fi/',
  },
  {
    id: 'mll-espoo-tapiola',
    name: 'MLL Tapiolan perhekahvila',
    organizer: 'MLL Tapiolan yhdistys ry',
    city: 'Espoo',
    district: 'Tapiola',
    venue: 'Tapiolan asukaspuisto',
    address: 'Louhentie 1, 02130 Espoo',
    schedule: 'Keskiviikkoisin klo 9.30–11.30',
    ageGroup: '0–6 v & vanhemmat',
    coords: [60.1762, 24.8035],
    url: 'https://tapiola.mll.fi/',
  },
  {
    id: 'mll-espoo-matinkyla',
    name: 'MLL Matinkylä–Olarin perhekahvila',
    organizer: 'MLL Etelä-Espoon yhdistys ry',
    city: 'Espoo',
    district: 'Matinkylä',
    venue: 'Matinkylän asukaspuisto',
    address: 'Matinkatu 11, 02230 Espoo',
    schedule: 'Perjantaisin klo 9.30–11.30',
    ageGroup: '0–6 v & vanhemmat',
    coords: [60.1598, 24.7421],
  },
  {
    id: 'mll-kauniainen',
    name: 'MLL Kauniaisten perhekahvila',
    organizer: 'MLL Kauniaisten yhdistys ry',
    city: 'Kauniainen',
    district: 'Keskusta',
    venue: 'Villa Junghans / Perhetupa',
    address: 'Leankuja 4, 02700 Kauniainen',
    schedule: 'Torstaisin klo 9.30–11.30',
    ageGroup: '0–6 v & vanhemmat',
    coords: [60.2106, 24.7262],
  },
  {
    id: 'mll-helsinki-toolo',
    name: 'MLL Töölön perhekahvila',
    organizer: 'MLL Töölön yhdistys ry',
    city: 'Helsinki',
    district: 'Töölö',
    venue: 'Töölön monitoimitalo',
    address: 'Topeliuksenkatu 2, 00250 Helsinki',
    schedule: 'Maanantaisin klo 9.30–11.30',
    ageGroup: '0–6 v & vanhemmat',
    coords: [60.1789, 24.9228],
  },
  {
    id: 'mll-helsinki-kallio',
    name: 'MLL Kallion & Vallilan perhekahvila',
    organizer: 'MLL Kallion yhdistys ry',
    city: 'Helsinki',
    district: 'Kallio',
    venue: 'Brahenpuiston leikkipuisto / sisätila',
    address: 'Helsinginkatu 25, 00510 Helsinki',
    schedule: 'Keskiviikkoisin klo 10.00–12.00',
    ageGroup: '0–6 v & vanhemmat',
    coords: [60.1869, 24.9482],
  },
  {
    id: 'mll-vantaa-tikkurila',
    name: 'MLL Tikkurilan perhekahvila',
    organizer: 'MLL Tikkurilan yhdistys ry',
    city: 'Vantaa',
    district: 'Tikkurila',
    venue: 'Tikkurilan asukaspuisto',
    address: 'Lummetie 2, 01300 Vantaa',
    schedule: 'Torstaisin klo 9.30–11.30',
    ageGroup: '0–6 v & vanhemmat',
    coords: [60.2925, 25.0398],
  },
]