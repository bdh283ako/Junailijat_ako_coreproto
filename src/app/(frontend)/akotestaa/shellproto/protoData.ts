export interface AuthenticatedGoogleUser {
  id: string
  displayName: string
  email: string
  avatarUrl?: string
}

export interface CoParentItem {
  id: string
  name: string
  email: string
  status: 'pending' | 'accepted'
  invitedAt: string
  inviteCode: string
}

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

export interface FamilyProfile {
  id: string
  name: string
  area: string
  city: string
  childrenAges: string
  ageGroups: string[]
  closeRelativesSummary?: string
  hasCloseRelatives?: boolean
  bio: string
  interests: string[]
  attendingEventId: string
  coords: [number, number]
}

export interface FamilyEvent {
  id: string
  title: string
  venue: string
  city: string
  time: string
  ageGroup: string
  price: string
  coords: [number, number]
  description?: string
  url?: string
}

export interface UserProfileState {
  familyName: string
  homeCity: string
  area: string
  homeCoords: [number, number]
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

export interface PersistedSessionState {
  attendingIds: string[]
  dismissedIds: string[]
  matchedIds: string[]
  messages: Record<string, string[]>
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

export interface FloatingPos {
  x: number
  y: number
}

export interface FamilyMatchBreakdown {
  percent: number
  interestsPts: number
  distancePts: number
  agePts: number
  eventPts: number
  commonTagsCount: number
  sharedEvent: boolean
}

export type TabKey = 'events' | 'families' | 'map' | 'profile'
export type ProfileSubView = 'main' | 'members' | 'store_inspector'
export type DbSyncStatus = 'idle' | 'saving' | 'saved' | 'error'

export const SESSION_STORAGE_PREFIX = 'perhepiiri_transient_v3_'
export const INITIAL_ATTENDING_IDS = ['evt-2']
export const PKS_DEFAULT_BOUNDS: [[number, number], [number, number]] = [
  [60.115, 24.52],
  [60.325, 25.18],
]

export interface HomeAreaPreset {
  city: string
  label: string
  coords: [number, number]
}

export const PKS_HOME_AREAS: HomeAreaPreset[] = [
  { city: 'Espoo', label: 'Espoon keskus / Koivuhovi', coords: [60.2055, 24.6685] },
  { city: 'Espoo', label: 'Tapiola, Espoo', coords: [60.1756, 24.8053] },
  { city: 'Espoo', label: 'Leppävaara, Espoo', coords: [60.2189, 24.8124] },
  { city: 'Espoo', label: 'Matinkylä / Olari, Espoo', coords: [60.1614, 24.7385] },
  { city: 'Kauniainen', label: 'Kauniainen keskusta', coords: [60.2114, 24.7265] },
  { city: 'Helsinki', label: 'Pasila / Vallila, Helsinki', coords: [60.1986, 24.9338] },
  { city: 'Helsinki', label: 'Töölö / Kamppi, Helsinki', coords: [60.1805, 24.9182] },
  { city: 'Helsinki', label: 'Lauttasaari, Helsinki', coords: [60.1589, 24.8772] },
  { city: 'Vantaa', label: 'Tikkurila, Vantaa', coords: [60.2934, 25.0378] },
  { city: 'Vantaa', label: 'Myyrmäki, Vantaa', coords: [60.2618, 24.8535] },
]

export const AVAILABLE_TAGS = [
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

export const AGE_GROUP_OPTIONS = ['0-3v', '4-6v', '7-12v', '13-16v']
export const RELATIVE_ROLES = ['Isovanhempi', 'Kummi', 'Läheinen']

export const INITIAL_EVENTS: FamilyEvent[] = [
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

export const DEMO_FAMILIES: FamilyProfile[] = [
  {
    id: 'fam-1',
    name: 'Virtasen perhe',
    area: 'Tapiola, Espoo',
    city: 'Espoo',
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

export const NERD_DB_QUIPS: string[] = [
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

export const BASE_DEFAULT_PROFILE: UserProfileState = {
  familyName: 'Oma Perhe',
  homeCity: 'Espoo',
  area: 'Espoon keskus / Koivuhovi',
  homeCoords: [60.2055, 24.6685],
  bio: '',
  coParents: [],
  children: [],
  closeRelatives: [],
  interests: [],
  filters: {
    maxDistanceKm: 15,
    targetAgeGroups: ['0-3v', '4-6v', '7-12v', '13-16v'],
    targetCity: 'Kaikki PKS',
  },
  privacy: {
    discoverable: true,
    shareEventsWithMatches: true,
    showCloseRelativesInMatches: false,
  },
}

export function buildInitialProfileForGoogleUser(user: AuthenticatedGoogleUser): UserProfileState {
  const firstName = user.displayName.split(' ')[0] || 'Oma'
  return {
    ...BASE_DEFAULT_PROFILE,
    familyName: `${firstName} – perhe`,
    coParents: [],
    children: [],
    closeRelatives: [],
  }
}

export function resolveHomeCoords(city: string, areaText: string): [number, number] {
  const query = `${city} ${areaText}`.toLowerCase()
  const exact = PKS_HOME_AREAS.find(
    (p) =>
      query.includes(p.label.toLowerCase()) ||
      p.label
        .toLowerCase()
        .split('/')
        .some((part) => part.trim().length > 2 && query.includes(part.trim())),
  )
  if (exact) return exact.coords
  if (city === 'Helsinki') return [60.1986, 24.9338]
  if (city === 'Vantaa') return [60.2934, 25.0378]
  if (city === 'Kauniainen') return [60.2114, 24.7265]
  return [60.2055, 24.6685]
}

export function calcDistanceKm(a: [number, number], b: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const R = 6371
  const dLat = toRad(b[0] - a[0])
  const dLon = toRad(b[1] - a[1])
  const lat1 = toRad(a[0])
  const lat2 = toRad(b[0])
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const km = 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  return Math.round(km * 10) / 10
}

export function calcFamilyMatch(
  profile: UserProfileState,
  fam: FamilyProfile,
  distanceKm: number,
  attendingIds: string[],
): FamilyMatchBreakdown {
  // 1. Yhteiset kiinnostuksen kohteet (max 40 %)
  const commonTags = fam.interests.filter((t) => profile.interests.includes(t))
  const tagBase = Math.max(
    1,
    Math.min(profile.interests.length || fam.interests.length, fam.interests.length),
  )
  const interestsPts =
    profile.interests.length > 0
      ? Math.round(Math.min(1, commonTags.length / tagBase) * 40)
      : 0

  // 2. Etäisyys omasta kotiseudusta (max 30 %)
  const maxKm = Math.max(1, profile.filters.maxDistanceKm)
  const distRatio = Math.max(0, 1 - distanceKm / (maxKm * 1.25))
  const distancePts = Math.round(distRatio * 30)

  // 3. Lasten ikäryhmien osuma (max 20 %): käyttää omia lapsia tai ikäfiltteriä
  const userGroups =
    profile.children.length > 0
      ? profile.children.map((c) => c.group)
      : profile.filters.targetAgeGroups
  const matchingGroups = fam.ageGroups.filter((g) => userGroups.includes(g))
  const agePts =
    matchingGroups.length > 0
      ? Math.round((matchingGroups.length / Math.max(1, fam.ageGroups.length)) * 20)
      : 0

  // 4. Yhteinen tapahtuma (max 10 %)
  const sharedEvent = Boolean(fam.attendingEventId && attendingIds.includes(fam.attendingEventId))
  const eventPts = sharedEvent ? 10 : 0

  return {
    percent: Math.min(100, interestsPts + distancePts + agePts + eventPts),
    interestsPts,
    distancePts,
    agePts,
    eventPts,
    commonTagsCount: commonTags.length,
    sharedEvent,
  }
}

export function normalizeProfile(
  incoming?: Partial<UserProfileState> | null,
  fallbackBase: UserProfileState = BASE_DEFAULT_PROFILE,
): UserProfileState {
  if (!incoming) return fallbackBase
  const rawParents = Array.isArray(incoming.coParents) ? incoming.coParents : []
  const normalizedParents: CoParentItem[] = rawParents.map((p, idx) => ({
    id: p.id || `cp-${idx}`,
    name: p.name || 'Toinen vanhempi',
    email: p.email || '',
    status: p.status === 'accepted' ? 'accepted' : 'pending',
    invitedAt: p.invitedAt || 'Aiemmin',
    inviteCode: p.inviteCode || `PP-DEMO${idx + 1}`,
  }))

  const homeCity = incoming.homeCity || fallbackBase.homeCity
  const area = incoming.area ?? fallbackBase.area
  const homeCoords =
    Array.isArray(incoming.homeCoords) && incoming.homeCoords.length === 2
      ? (incoming.homeCoords as [number, number])
      : resolveHomeCoords(homeCity, area)

  return {
    ...fallbackBase,
    ...incoming,
    homeCity,
    area,
    homeCoords,
    coParents: normalizedParents,
    children: Array.isArray(incoming.children) ? incoming.children : [],
    closeRelatives: Array.isArray(incoming.closeRelatives) ? incoming.closeRelatives : [],
    interests: Array.isArray(incoming.interests) ? incoming.interests : [],
    filters: { ...fallbackBase.filters, ...incoming.filters },
    privacy: { ...fallbackBase.privacy, ...incoming.privacy },
  }
}

export function emailToUserId(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
}

export function nowClock(): string {
  return new Date().toLocaleTimeString('fi-FI', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function generateInviteCode(): string {
  const part = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `PP-${part}`
}

export function buildInviteUrl(invite: CoParentItem): string {
  const base =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://perhepiiri.example.fi'
  return `${base}/kutsu?code=${encodeURIComponent(invite.inviteCode)}&email=${encodeURIComponent(invite.email)}`
}