import { NextRequest, NextResponse } from 'next/server'
import {
  PKS_AREAS,
  PKS_CITIES,
  PKS_CITY_CENTERS,
  type PksCityName,
} from '../../akotestaa/shellproto/pksAreas'
import {
  CANONICAL_AGE_FILTERS,
  CANONICAL_THEME_FILTERS,
} from '../../akotestaa/shellproto/eventTaxonomy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export interface NormalizedFeedEvent {
  id: string
  title: string
  startDate: string
  endDate?: string
  time: string
  locationName: string
  venue: string
  address?: string
  city: string
  coordinates?: { lat: number; lng: number }
  coords?: [number, number]
  ageRangeLabel: string
  ageGroup: string
  price: string
  pricingStatus?: 'free' | 'paid' | 'unknown'
  description?: string
  url?: string
  tags: string[]
  source: string
}

const KARO_EVENTPULSE_URL =
  process.env.KARO_EVENTPULSE_URL?.trim() ||
  'https://eventpulsebyjunailijat.ai.studio/api/events/feed.jsonld?horizon=all'
const LAHELLA_ACTIVITIES_URL =
  'https://www.lahella.fi/v1/integration/activities/'

const LAHELLA_TIMEOUT_MS = 2413
const LINKED_EVENTS_TIMEOUT_MS = 3860
const EVENTPULSE_TIMEOUT_MS = 13011
const KAUNIAINEN_TIMEOUT_MS = 207
const UNIFIED_EVENTS_RESPONSE_TIMEOUT_MS = 3000
const FEED_CACHE_TTL_MS = 60_000

interface FeedCacheSnapshot {
  updatedAt: number
  sourceElapsedMs: Record<'lahella' | 'linked' | 'eventPulse' | 'kauniainen', number | null>
  sourceStatus: Record<'lahella' | 'linked' | 'eventPulse' | 'kauniainen', number | null>
  combined: NormalizedFeedEvent[]
  byCity: Record<string, number>
  linkedEventsTotal: number
  karoResult: Awaited<ReturnType<typeof fetchKaroEventPulse>> | null
  lahellaResult: Awaited<ReturnType<typeof fetchLahellaActivities>> | null
  pagination: {
    helsinkiMetaCount: number
    espooMetaCount: number
    vantaaMetaCount: number
    kauniainenCount: number
  }
  hasMorePages: boolean
  refreshing: boolean
  helsinkiResult: Awaited<ReturnType<typeof fetchLinkedEventsForMunicipality>> | null
  espooResult: Awaited<ReturnType<typeof fetchLinkedEventsForMunicipality>> | null
  vantaaResult: Awaited<ReturnType<typeof fetchLinkedEventsForMunicipality>> | null
  kauniainenEvents: NormalizedFeedEvent[]
}

const feedCache: FeedCacheSnapshot = {
  updatedAt: 0,
  sourceElapsedMs: {
    lahella: null,
    linked: null,
    eventPulse: null,
    kauniainen: null,
  },
  sourceStatus: {
    lahella: null,
    linked: null,
    eventPulse: null,
    kauniainen: null,
  },
  combined: [],
  byCity: {},
  linkedEventsTotal: 0,
  karoResult: null,
  lahellaResult: null,
  pagination: {
    helsinkiMetaCount: 0,
    espooMetaCount: 0,
    vantaaMetaCount: 0,
    kauniainenCount: 0,
  },
  hasMorePages: false,
  refreshing: false,
  helsinkiResult: null,
  espooResult: null,
  vantaaResult: null,
  kauniainenEvents: [],
}

// YSO-asiasanat Linked Eventsissä: lapset (p4354), perheet (p13050), vauvat (p11185), leikki-ikäiset (p20513)
const FAMILY_YSO_KEYWORDS = 'yso:p4354,yso:p13050,yso:p11185,yso:p20513'

const LINKED_EVENTS_ENDPOINTS = [
  {
    key: 'helsinki' as const,
    city: 'Helsinki',
    sourceTag: 'linked-events-helsinki',
    division: 'kunta:helsinki',
    baseUrl: 'https://api.hel.fi/linkedevents/v1/event/',
    defaultPageSize: 25,
  },
  {
    key: 'espoo' as const,
    city: 'Espoo',
    sourceTag: 'linked-events-espoo',
    division: 'kunta:espoo',
    baseUrl: 'https://api.hel.fi/linkedevents/v1/event/',
    defaultPageSize: 25,
  },
  {
    key: 'vantaa' as const,
    city: 'Vantaa',
    sourceTag: 'linked-events-vantaa',
    division: 'kunta:vantaa',
    baseUrl: 'https://api.hel.fi/linkedevents/v1/event/',
    defaultPageSize: 25,
  },
] as const

const KAUNIAINEN_EVENTS_URL = 'https://www.kauniainen.fi/tapahtumat/'

function pickLocalizedText(field: unknown): string {
  if (!field) return ''
  if (typeof field === 'string') return field.trim()
  if (typeof field === 'object') {
    const obj = field as Record<string, unknown>
    const val = obj.fi ?? obj.sv ?? obj.en ?? Object.values(obj)[0]
    return typeof val === 'string' ? val.trim() : ''
  }
  return ''
}

function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number.parseInt(code, 10)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    )
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function classificationValues(value: unknown, depth = 0): string[] {
  if (depth > 4 || value === null || value === undefined) return []
  if (typeof value === 'string') {
    const text = stripHtml(value)
    return text ? [text] : []
  }
  if (typeof value === 'number' && Number.isFinite(value)) return [String(value)]
  if (Array.isArray(value)) {
    return value.flatMap((item) => classificationValues(item, depth + 1))
  }
  if (typeof value !== 'object') return []

  return Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !/^(?:@context|image|logo|location|position|url|sameas)$/i.test(key))
    .flatMap(([, item]) => classificationValues(item, depth + 1))
}

function normalizeClassificationText(values: string[]): string {
  return values
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function canonicalAgeLabels(options: {
  ageValues?: unknown[]
  contextText?: string
  minAge?: number | null
  maxAge?: number | null
}): string[] {
  const labels = new Set<string>()
  const addRange = (min: number, max: number) => {
    if (min <= 3 && max >= 0) labels.add(CANONICAL_AGE_FILTERS[0])
    if (min <= 6 && max >= 4) labels.add(CANONICAL_AGE_FILTERS[1])
    if (min <= 12 && max >= 7) labels.add(CANONICAL_AGE_FILTERS[2])
    if (min <= 18 && max >= 13) labels.add(CANONICAL_AGE_FILTERS[3])
    if (min <= 0 && max >= 18) labels.add(CANONICAL_AGE_FILTERS[4])
  }

  if (options.minAge !== undefined || options.maxAge !== undefined) {
    addRange(options.minAge ?? 0, options.maxAge ?? 18)
  }

  const ageValues = (options.ageValues ?? []).flatMap((value) =>
    classificationValues(value),
  )
  const ageText = normalizeClassificationText(ageValues)
  for (const match of ageText.matchAll(
    /(?:agegroup\/range\s*:\s*)?(\d{1,2})\s*[-–]\s*(\d{1,2})\b/g,
  )) {
    const min = Number(match[1])
    const max = Number(match[2])
    if (min <= max && max <= 99) addRange(min, max)
  }

  const context = normalizeClassificationText([
    ...ageValues,
    options.contextText ?? '',
  ])
  for (const match of context.matchAll(
    /\b(\d{1,2})\s*[-–]\s*(\d{1,2})\s*(?:v(?:uot\w*)?|years?)/g,
  )) {
    const min = Number(match[1])
    const max = Number(match[2])
    if (min <= max && max <= 99) addRange(min, max)
  }
  if (/vauva|taaper|baby|toddler|infant/.test(context)) {
    labels.add(CANONICAL_AGE_FILTERS[0])
  }
  if (/leikki.?ik|preschool/.test(context)) {
    labels.add(CANONICAL_AGE_FILTERS[1])
  }
  if (/kouluik|koulul|school.?age/.test(context)) {
    labels.add(CANONICAL_AGE_FILTERS[2])
  }
  if (/nuori|teini|teenager|adolescent/.test(context)) {
    labels.add(CANONICAL_AGE_FILTERS[3])
  }

  if (labels.size === 0) labels.add(CANONICAL_AGE_FILTERS[4])
  return CANONICAL_AGE_FILTERS.filter((label) => labels.has(label))
}

const CANONICAL_THEME_MATCHERS: Array<{
  label: (typeof CANONICAL_THEME_FILTERS)[number]
  pattern: RegExp
}> = [
  {
    label: CANONICAL_THEME_FILTERS[0],
    pattern: /liikunt|urheil|sport|fitness|exercise|football|jalkapall|uimakoul|jooga|yoga/,
  },
  {
    label: CANONICAL_THEME_FILTERS[1],
    pattern: /ulkoil|puist|luonto|retki|playground|picnic|outdoor|nature|hiking/,
  },
  {
    label: CANONICAL_THEME_FILTERS[2],
    pattern: /kulttuur|esity|teatter|museo|dance|performance|cinema|show/,
  },
  {
    label: CANONICAL_THEME_FILTERS[3],
    pattern: /askartel|tyopaj|kasity|craft|workshop|maala|keramiik|art class/,
  },
  {
    label: CANONICAL_THEME_FILTERS[4],
    pattern: /satu|tarin|kirjast|lukemis|story|stories|library|reading/,
  },
  {
    label: CANONICAL_THEME_FILTERS[5],
    pattern: /musiik|muskari|sing|music|concert|song/,
  },
  {
    label: CANONICAL_THEME_FILTERS[6],
    pattern: /vertaistuk|vanhemm|perhekahvil|parent|peer support|mother|father/,
  },
  {
    label: CANONICAL_THEME_FILTERS[7],
    pattern: /kiertotal|kierrat|kirpp|vaatevaih|arjen apu|ruoka-apu|recycl|reuse|repair|swap|second hand/,
  },
]

function canonicalThemeTags(values: unknown[]): string[] {
  const text = normalizeClassificationText(values.flatMap((value) =>
    classificationValues(value),
  ))
  return CANONICAL_THEME_MATCHERS
    .filter(({ pattern }) => pattern.test(text))
    .map(({ label }) => label)
}

type PricingStatus = 'free' | 'paid' | 'unknown'

function pricingNumbers(value: unknown, depth = 0): number[] {
  if (depth > 4 || value === null || value === undefined) return []
  if (typeof value === 'number' && Number.isFinite(value)) return [value]
  if (Array.isArray(value)) {
    return value.flatMap((item) => pricingNumbers(item, depth + 1))
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !/^(?:@context|image|logo|location|position|url|sameas)$/i.test(key))
      .flatMap(([, item]) => pricingNumbers(item, depth + 1))
  }
  return []
}

function classifyPricing(
  values: unknown[],
  explicitFree?: boolean,
): PricingStatus {
  if (explicitFree === true) return 'free'
  if (explicitFree === false) return 'paid'
  const flattened = values.flatMap((value) => classificationValues(value))
  const text = normalizeClassificationText(flattened)
  if (/maksuton|ilmainen|\bfree\b|no charge/.test(text)) return 'free'
  if (/maksullinen|\bpaid\b|fee|charge|€|\beur\b/.test(text)) return 'paid'

  const numericValues = values.flatMap((value) => pricingNumbers(value))
  if (numericValues.some((value) => value > 0)) return 'paid'
  if (numericValues.length > 0 && numericValues.every((value) => value === 0)) {
    return 'free'
  }
  return 'unknown'
}

function priceLabel(status: PricingStatus): string {
  if (status === 'free') return 'Maksuton'
  if (status === 'paid') return 'Maksullinen'
  return 'Tarkista hinta'
}

function isPksCoordinate(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (lat < 59.8 || lat > 60.5 || lng < 24.3 || lng > 25.3) return false

  let nearestKm = Number.POSITIVE_INFINITY
  for (const area of PKS_AREAS) {
    const latDelta = ((area.coords[0] - lat) * Math.PI) / 180
    const lngDelta = ((area.coords[1] - lng) * Math.PI) / 180
    const latA = (lat * Math.PI) / 180
    const latB = (area.coords[0] * Math.PI) / 180
    const sinLat = Math.sin(latDelta / 2)
    const sinLng = Math.sin(lngDelta / 2)
    const h =
      sinLat * sinLat +
      Math.cos(latA) * Math.cos(latB) * sinLng * sinLng
    const distance =
      6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
    nearestKm = Math.min(nearestKm, distance)
  }
  return nearestKm <= 18
}

function normalizePksCity(raw: unknown): PksCityName | undefined {
  if (typeof raw !== 'string') return undefined
  const value = stripHtml(raw).toLowerCase()
  if (/espoo|esbo/.test(value)) return 'Espoo'
  if (/(helsinki|helsingfors)/.test(value)) return 'Helsinki'
  if (/(vantaa|vanda)/.test(value)) return 'Vantaa'
  if (/(kauniainen|grankulla|grani)/.test(value)) return 'Kauniainen'
  return undefined
}

function resolvePksCity(
  item: Record<string, unknown>,
): PksCityName | undefined {
  const traits =
    item.traits && typeof item.traits === 'object'
      ? (item.traits as Record<string, unknown>)
      : {}
  const regionValues = [
    ...(Array.isArray(traits.region) ? traits.region : []),
    ...(Array.isArray(traits.municipality) ? traits.municipality : []),
  ]
  for (const value of regionValues) {
    const city = normalizePksCity(String(value))
    if (city) return city
  }

  const channels = Array.isArray(traits.channels) ? traits.channels : []
  for (const channel of channels) {
    if (!channel || typeof channel !== 'object') continue
    const channelObj = channel as Record<string, unknown>
    const address =
      channelObj.address && typeof channelObj.address === 'object'
        ? (channelObj.address as Record<string, unknown>)
        : {}
    const city = normalizePksCity(address.city)
    if (city) return city

    const map =
      channelObj.map && typeof channelObj.map === 'object'
        ? (channelObj.map as Record<string, unknown>)
        : {}
    const center =
      map.center && typeof map.center === 'object'
        ? (map.center as Record<string, unknown>)
        : {}
    const coords = center.coordinates
    if (Array.isArray(coords) && coords.length >= 2) {
      const lng = typeof coords[0] === 'number' ? coords[0] : NaN
      const lat = typeof coords[1] === 'number' ? coords[1] : NaN
      if (isPksCoordinate(lat, lng)) {
        let nearestCity: PksCityName = 'Helsinki'
        let nearestDistance = Number.POSITIVE_INFINITY
        for (const city of PKS_CITIES) {
          const centerCoords = PKS_CITY_CENTERS[city]
          const latDelta = ((centerCoords[0] - lat) * Math.PI) / 180
          const lngDelta = ((centerCoords[1] - lng) * Math.PI) / 180
          const latA = (lat * Math.PI) / 180
          const latB = (centerCoords[0] * Math.PI) / 180
          const h =
            Math.sin(latDelta / 2) ** 2 +
            Math.cos(latA) *
              Math.cos(latB) *
              Math.sin(lngDelta / 2) ** 2
          const distance =
            6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
          if (distance < nearestDistance) {
            nearestDistance = distance
            nearestCity = city
          }
        }
        return nearestCity
      }
    }
  }

  const text = [
    typeof traits.name === 'string' ? traits.name : '',
    typeof traits.summary === 'string' ? traits.summary : '',
    typeof traits.description === 'string' ? traits.description : '',
  ]
    .concat(
      channels.flatMap((channel) =>
        channel && typeof channel === 'object'
          ? [
              typeof (channel as Record<string, unknown>).name === 'string'
                ? ((channel as Record<string, unknown>).name as string)
                : '',
              typeof (channel as Record<string, unknown>).summary === 'string'
                ? ((channel as Record<string, unknown>).summary as string)
                : '',
              typeof (channel as Record<string, unknown>).description === 'string'
                ? ((channel as Record<string, unknown>).description as string)
                : '',
            ]
          : [],
      ),
    )
    .join(' ')
  const lowerText = stripHtml(text).toLowerCase()
  for (const area of PKS_AREAS) {
    if (
      area.aliases.some((alias) => {
        const normalizedAlias = alias.toLowerCase()
        return (
          lowerText.includes(normalizedAlias) ||
          normalizePksCity(normalizedAlias) === area.city
        )
      })
    ) {
      return area.city
    }
  }
  return normalizePksCity(text)
}

function familySignal(
  item: Record<string, unknown>,
): boolean {
  const traits =
    item.traits && typeof item.traits === 'object'
      ? (item.traits as Record<string, unknown>)
      : {}
  const demographics = Array.isArray(traits.demographic)
    ? traits.demographic.map(String)
    : []
  const themes = Array.isArray(traits.theme) ? traits.theme.map(String) : []
  const childAgeRanges = demographics.filter((value) =>
    /ageGroup\/range:(0-1|2-6|4-6|7-12|13-18)/.test(value),
  )

  const name = stripHtml(
    typeof traits.name === 'string'
      ? traits.name
      : typeof traits.translations === 'object'
        ? String(
            (
              (traits.translations as Record<string, unknown>).fi as
                | Record<string, unknown>
                | undefined
            )?.name ?? '',
          )
        : '',
  )
  const summary = stripHtml(
    typeof traits.summary === 'string' ? traits.summary : '',
  )
  const description = stripHtml(
    typeof traits.description === 'string' ? traits.description : '',
  )
  const channels = Array.isArray(traits.channels) ? traits.channels : []
  const channelText = channels
    .flatMap((channel) =>
      channel && typeof channel === 'object'
        ? Object.values(channel as Record<string, unknown>)
            .filter((value) => typeof value === 'string')
            .map(String)
        : [],
    )
    .join(' ')
  const combined = `${name} ${summary} ${description} ${channelText}`.toLowerCase()

  const familyTextSignal =
    /\b(perhe|perheet|lapsi|lapset|lapsiperhe|nuori|nuoret|vauva|vauvat|taaper|perhekahvil|kerho|eskari|päiväkoti|koulu|leikkik|viikkotoimin)\b/.test(
      combined,
    )
  const themesSignal = themes.includes('vt_lapset_perheet')
  const onlyOlderAdultSignal =
    demographics.some((value) => /ageGroup\/range:65-99/.test(value)) &&
    !childAgeRanges.length &&
    !familyTextSignal &&
    !themesSignal
  const adultOnlySignal =
    /omaishoit|kriisi|sairaus|terveys|aikuisten|kuntoutus|vertais(?:ryhmä|tuki)/.test(
      combined,
    ) &&
    !childAgeRanges.length &&
    !familyTextSignal &&
    !themesSignal
  const explicitOlderSignal = themes.includes('vt_ikaihmiset') && !familyTextSignal

  return (
    (childAgeRanges.length > 0 || familyTextSignal || themesSignal) &&
    !onlyOlderAdultSignal &&
    !adultOnlySignal &&
    !explicitOlderSignal
  )
}

function canonicalTags(options: {
  title: string
  description: string
  ageLabels?: string[]
  ageValues?: unknown[]
  classificationData?: unknown[]
  isFree?: boolean
  isPaid?: boolean
}): string[] {
  const ageLabels =
    options.ageLabels ??
    canonicalAgeLabels({
      ageValues: options.ageValues,
      contextText: `${options.title} ${options.description}`,
    })
  const classificationData = [
    options.title,
    options.description,
    ...(options.classificationData ?? []),
  ]
  const themeTags = canonicalThemeTags(classificationData)
  const tags = [...ageLabels, ...themeTags]

  const classificationText = normalizeClassificationText(
    classificationData.flatMap((value) => classificationValues(value)),
  )
  if (
    /hm_kohtaamispaikka|\bplace\b|kohtaamispaik|asukaspuist|perhepuist|perhekahvil|perhekeskus|family center|community center/.test(
      classificationText,
    )
  ) {
    tags.push('hm_kohtaamispaikka')
  }
  if (
    /liikunt|urheil|ulkoil|puist|luonto|retki|uimakoul|pyoraily/.test(
      classificationText,
    )
  ) {
    tags.push('Liikunta & ulkoilu')
  }
  if (
    /kulttuur|esity|teatter|museo|askartel|tyopaj|kirjast|musiik/.test(
      classificationText,
    )
  ) {
    tags.push('Kulttuuri & askartelu')
  }
  if (options.isFree) {
    tags.push('Maksuton')
  }
  if (options.isPaid) tags.push('Maksullinen')
  return Array.from(new Set(tags))
}

async function fetchLahellaActivities(): Promise<{
  events: NormalizedFeedEvent[]
  debug: {
    configured: boolean
    url: string
    status: number | null
    error?: string
    rawItems: number
    hasMore?: boolean
    pksItems?: number
    familyItems?: number
    filteredItems?: number
    pagesFetched?: number
    elapsedMs?: number
    items?: Record<string, unknown>[]
  }
}> {
  const pageSize = 50
  const maxPages = 5
  let rawItems = 0
  let lastStatus: number | null = null
  let lastHasMore = false
  let pksItems = 0
  let familyItems = 0
  let filteredItems = 0
  let pagesFetched = 0
  let error: string | undefined
  const rawItemsById = new Map<string, Record<string, unknown>>()
  const startedAt = Date.now()

  try {
    for (let page = 1; page <= maxPages; page += 1) {
      const url = new URL(LAHELLA_ACTIVITIES_URL)
      url.searchParams.set('pageSize', String(pageSize))
      url.searchParams.set('page', String(page))

      const res = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(LAHELLA_TIMEOUT_MS),
      })
      lastStatus = res.status
      pagesFetched += 1
      if (!res.ok) {
        error = `HTTP_${res.status}`
        break
      }

      const payload = (await res.json()) as {
        hasMore?: boolean
        items?: unknown[]
      }
      lastHasMore = payload.hasMore === true
      const items = Array.isArray(payload.items) ? payload.items : []
      rawItems += items.length
      for (const item of items) {
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>
          const key = String(record._key ?? '')
          if (key) rawItemsById.set(key, record)
        }
      }

      if (!payload.hasMore) break
    }
  } catch (err) {
    error =
      err instanceof Error && err.name === 'TimeoutError'
        ? 'FETCH_TIMEOUT'
        : err instanceof Error
          ? err.message
          : 'FETCH_FAILED'
  }

  const events: NormalizedFeedEvent[] = []
  for (const [key, item] of rawItemsById) {
    const acceptedFamily = familySignal(item)
    if (acceptedFamily) familyItems += 1
    if (!acceptedFamily) continue
    const traits =
      item.traits && typeof item.traits === 'object'
        ? (item.traits as Record<string, unknown>)
        : {}

    const fiTranslation =
      traits.translations &&
      typeof traits.translations === 'object'
        ? ((traits.translations as Record<string, unknown>).fi as
            | Record<string, unknown>
            | undefined)
        : undefined

    const title = stripHtml(
      typeof traits.name === 'string'
        ? traits.name
        : typeof fiTranslation?.name === 'string'
          ? fiTranslation.name
          : 'Lapsiperhetapahtuma',
    )
    const description = stripHtml(
      typeof traits.description === 'string'
        ? traits.description
        : typeof fiTranslation?.description === 'string'
          ? fiTranslation.description
          : typeof traits.summary === 'string'
            ? traits.summary
            : typeof fiTranslation?.summary === 'string'
              ? fiTranslation.summary
              : '',
    )
    if (!title) continue

    const city = resolvePksCity(item)
    if (!city) continue
    pksItems += 1

    const channels = Array.isArray(traits.channels) ? traits.channels : []
    const firstChannel =
      channels.find(
        (channel) =>
          channel &&
          typeof channel === 'object',
      ) as Record<string, unknown> | undefined
    const channelAddress =
      firstChannel?.address && typeof firstChannel.address === 'object'
        ? (firstChannel.address as Record<string, unknown>)
        : {}
    const channelMap =
      firstChannel?.map && typeof firstChannel.map === 'object'
        ? (firstChannel.map as Record<string, unknown>)
        : {}
    const mapCenter =
      channelMap.center && typeof channelMap.center === 'object'
        ? (channelMap.center as Record<string, unknown>)
        : {}
    const mapCoordinates = Array.isArray(mapCenter.coordinates)
      ? mapCenter.coordinates
      : undefined

    let coordinates:
      | { lat: number; lng: number }
      | undefined
    if (mapCoordinates && mapCoordinates.length >= 2) {
      const lng =
        typeof mapCoordinates[0] === 'number'
          ? mapCoordinates[0]
          : NaN
      const lat =
        typeof mapCoordinates[1] === 'number'
          ? mapCoordinates[1]
          : NaN
      if (isPksCoordinate(lat, lng)) {
        coordinates = { lat, lng }
      }
    }
    if (!coordinates) {
      coordinates = { lat: PKS_CITY_CENTERS[city][0], lng: PKS_CITY_CENTERS[city][1] }
    }

    let startDate = ''
    let endDate: string | undefined
    for (const channel of channels) {
      if (!channel || typeof channel !== 'object') continue
      const events = (channel as Record<string, unknown>).events
      if (!Array.isArray(events)) continue
      for (const event of events) {
        if (!event || typeof event !== 'object') continue
        const eventObj = event as Record<string, unknown>
        const start =
          typeof eventObj.start === 'number' ? eventObj.start : undefined
        const end =
          typeof eventObj.end === 'number' ? eventObj.end : undefined
        if (start && (!startDate || new Date(start).toISOString() < startDate)) {
          startDate = new Date(start).toISOString()
          endDate = end ? new Date(end).toISOString() : undefined
        }
      }
    }
    if (!startDate) {
      const visibility =
        traits.visibility && typeof traits.visibility === 'object'
          ? (traits.visibility as Record<string, unknown>)
          : undefined
      if (typeof visibility?.start === 'number') {
        startDate = new Date(visibility.start).toISOString()
      }
    }

    const locationName = stripHtml(
      typeof firstChannel?.name === 'string'
        ? firstChannel.name
        : `${city} lapsiperhepalvelut`,
    )
    const addressParts = [
      typeof channelAddress.street === 'string'
        ? channelAddress.street
        : '',
      city,
    ].filter(Boolean)

    const demographics = Array.isArray(traits.demographic)
      ? traits.demographic.map(String)
      : []
    const themes = Array.isArray(traits.theme)
      ? traits.theme.map(String)
      : []
    const formats = Array.isArray(traits.format)
      ? traits.format.map(String)
      : []
    const pricingStatus = classifyPricing([traits.pricing, traits.price])
    const ageLabels = canonicalAgeLabels({
      ageValues: [demographics],
      contextText: `${title} ${description}`,
    })
    const tags = [
      'lahella-fi',
      ...canonicalTags({
        title,
        description,
        ageLabels,
        ageValues: [demographics],
        classificationData: [themes, formats, demographics],
        isFree: pricingStatus === 'free',
        isPaid: pricingStatus === 'paid',
      }),
    ]

    const ageRangeLabel = ageLabels.join(', ')

    filteredItems += 1
    events.push({
      id: `lahella-${key}`,
      title,
      startDate,
      time: formatFinnishDateTime(startDate),
      locationName,
      venue: locationName,
      address: addressParts.join(', '),
      city,
      coordinates,
      coords: [coordinates.lat, coordinates.lng] as [number, number],
      ageRangeLabel,
      ageGroup: ageRangeLabel,
      price: priceLabel(pricingStatus),
      pricingStatus,
      description: description || undefined,
      url:
        typeof firstChannel?.www === 'string'
          ? firstChannel.www
          : typeof traits.registrationUrl === 'string'
            ? traits.registrationUrl
            : undefined,
      tags,
      source: 'lahella-fi',
      ...(endDate ? { endDate } : {}),
    })
  }

  return {
    events,
    debug: {
      configured: true,
      url: LAHELLA_ACTIVITIES_URL,
      status: lastStatus,
      ...(error ? { error } : {}),
      rawItems,
      hasMore: lastHasMore,
      pksItems,
      familyItems,
      filteredItems,
      pagesFetched,
      elapsedMs: Date.now() - startedAt,
      items: Array.from(rawItemsById.values()),
    },
  }
}

function formatFinnishDateTime(iso?: string): string {
  if (!iso) return 'Aika tarkentuu'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('fi-FI', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Helsinki',
  })
}

function normalizeCityName(rawLocality: string, fallbackCity: string): string {
  const lower = rawLocality.toLowerCase()
  if (lower.includes('espoo') || lower.includes('esbo')) return 'Espoo'
  if (lower.includes('vantaa') || lower.includes('vanda')) return 'Vantaa'
  if (lower.includes('kauniainen') || lower.includes('grankulla')) return 'Kauniainen'
  if (lower.includes('helsinki') || lower.includes('helsingfors')) return 'Helsinki'
  return fallbackCity
}

function extractAgeLabels(
  raw: Record<string, unknown>,
  title: string,
  desc: string,
): string[] {
  const minAge = typeof raw.audience_min_age === 'number' ? raw.audience_min_age : null
  const maxAge = typeof raw.audience_max_age === 'number' ? raw.audience_max_age : null
  return canonicalAgeLabels({
    ageValues: [
      raw.audience,
      raw.ageRange,
      raw.age_range,
      raw.typicalAgeRange,
      raw.keywords,
    ],
    contextText: `${title} ${desc}`,
    minAge,
    maxAge,
  })
}

function extractPrice(raw: Record<string, unknown>): {
  label: string
  status: PricingStatus
} {
  const offers = Array.isArray(raw.offers) ? raw.offers : []
  const firstOffer = offers[0] as Record<string, unknown> | undefined
  const explicitFree =
    typeof firstOffer?.is_free === 'boolean' ? firstOffer.is_free : undefined
  const status = classifyPricing(
    [firstOffer, firstOffer?.price, raw.price, raw.priceCurrency],
    explicitFree,
  )
  const priceText = pickLocalizedText(firstOffer?.price)
  const label =
    status === 'paid' && priceText && /[\d€]|\beur\b/i.test(priceText)
      ? stripHtml(priceText)
      : priceLabel(status)
  return { label, status }
}

function extractCollectionItems(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((x): x is Record<string, unknown> => Boolean(x && typeof x === 'object'))
  }
  if (!payload || typeof payload !== 'object') return []
  const obj = payload as Record<string, unknown>

  for (const key of ['events', 'items', 'data', 'content', 'results', 'hits']) {
    if (Array.isArray(obj[key])) {
      return (obj[key] as unknown[]).filter((x): x is Record<string, unknown> =>
        Boolean(x && typeof x === 'object'),
      )
    }
  }

  if (Array.isArray(obj['@graph'])) {
    return obj['@graph'].filter(
      (x): x is Record<string, unknown> => Boolean(x && typeof x === 'object'),
    )
  }

  if (Array.isArray(obj.itemListElement)) {
    return obj.itemListElement
      .map((el) => {
        if (el && typeof el === 'object' && 'item' in el) {
          return (el as { item?: unknown }).item
        }
        return el
      })
      .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === 'object'))
  }

  if (obj['@type'] === 'Event' || typeof obj.name === 'string' || typeof obj.title === 'string') {
    return [obj]
  }
  return []
}

function parseCoords(
  item: Record<string, unknown>,
  locObj: Record<string, unknown> | null,
): { lat: number; lng: number } | undefined {
  const candidates = [
    item.coordinates,
    item.location,
    locObj?.geo,
    locObj?.coordinates,
    locObj?.position,
  ]

  for (const cand of candidates) {
    if (!cand || typeof cand !== 'object') continue
    const cObj = cand as Record<string, unknown>
    if (typeof cObj.lat === 'number' && typeof cObj.lng === 'number') {
      return { lat: cObj.lat, lng: cObj.lng }
    }
    if (typeof cObj.latitude === 'number' && typeof cObj.longitude === 'number') {
      return { lat: cObj.latitude, lng: cObj.longitude }
    }
    if (Array.isArray(cObj.coordinates) && cObj.coordinates.length >= 2) {
      const a = cObj.coordinates[0]
      const b = cObj.coordinates[1]
      if (typeof a === 'number' && typeof b === 'number') {
        return a > 20 && a < 32 && b > 59 && b < 71
          ? { lat: b, lng: a }
          : { lat: a, lng: b }
      }
    }
  }
  return undefined
}

async function fetchKaroEventPulse(): Promise<{
  events: NormalizedFeedEvent[]
  debug: { url: string; status: number | null; error?: string; rawItems: number }
}> {
  try {
    const res = await fetch(KARO_EVENTPULSE_URL, {
      headers: {
        Accept: 'application/ld+json, application/json;q=0.9, */*;q=0.8',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(EVENTPULSE_TIMEOUT_MS),
    })

    if (!res.ok) {
      return {
        events: [],
        debug: {
          url: KARO_EVENTPULSE_URL,
          status: res.status,
          error: `HTTP_${res.status}`,
          rawItems: 0,
        },
      }
    }

    const rawText = await res.text()
    let json: unknown
    try {
      json = JSON.parse(rawText)
    } catch {
      return {
        events: [],
        debug: {
          url: KARO_EVENTPULSE_URL,
          status: res.status,
          error: `NON_JSON_RESPONSE (${rawText.slice(0, 80).replace(/\s+/g, ' ')})`,
          rawItems: 0,
        },
      }
    }

    const list = extractCollectionItems(json)

    const events = list.map((item, idx) => {
      const id = String(item.id ?? item['@id'] ?? `urn:eventpulse:item-${idx}`)
      const title = stripHtml(
        String(item.title ?? pickLocalizedText(item.name) ?? 'Perhetapahtuma'),
      )
      const startDate = String(item.startDate ?? item.start_time ?? '')

      const locObj =
        item.location && typeof item.location === 'object'
          ? (item.location as Record<string, unknown>)
          : null

      const locAddrObj =
        locObj?.address && typeof locObj.address === 'object'
          ? (locObj.address as Record<string, unknown>)
          : item.address && typeof item.address === 'object'
            ? (item.address as Record<string, unknown>)
            : null

      const locationName = stripHtml(
        String(
          item.locationName ??
            item.venue ??
            pickLocalizedText(locObj?.name) ??
            'Pääkaupunkiseutu',
        ),
      )

      const rawAddress =
        typeof item.address === 'string'
          ? item.address
          : typeof locObj?.address === 'string'
            ? locObj.address
            : locAddrObj
              ? [locAddrObj.streetAddress, locAddrObj.addressLocality].filter(Boolean).join(', ')
              : undefined

      const localityCandidate = String(
        item.city ?? locAddrObj?.addressLocality ?? rawAddress ?? locationName ?? '',
      )
      const city = normalizeCityName(localityCandidate, 'Helsinki')

      const descriptionRaw =
        typeof item.description === 'string'
          ? item.description
          : pickLocalizedText(item.description) ||
            classificationValues(item.about).join(' ')
      const description = descriptionRaw ? stripHtml(descriptionRaw) : undefined

      const url =
        typeof item.url === 'string'
          ? item.url
          : typeof item['@id'] === 'string' && item['@id'].startsWith('http')
            ? item['@id']
            : undefined

      const ageLabels = canonicalAgeLabels({
        ageValues: [
          item.ageRangeLabel,
          item.typicalAgeRange,
          item.ageGroup,
          item.audience,
          item.keywords,
        ],
        contextText: `${title} ${description ?? ''}`,
      })
      const explicitFree =
        typeof item.isAccessibleForFree === 'boolean'
          ? item.isAccessibleForFree
          : undefined
      const pricingStatus = classifyPricing(
        [item.offers, item.price, item.priceSpecification],
        explicitFree,
      )
      const rawTags = [
        ...classificationValues(item.tags),
        ...classificationValues(item.keywords),
      ]
      const tags = Array.from(
        new Set([
          'karo-eventpulse-feed',
          ...rawTags,
          ...canonicalTags({
            title,
            description: description ?? '',
            ageLabels,
            ageValues: [
              item.ageRangeLabel,
              item.typicalAgeRange,
              item.ageGroup,
              item.audience,
              item.keywords,
            ],
            classificationData: [item.keywords, item.about, item.audience, item.tags],
            isFree: pricingStatus === 'free',
            isPaid: pricingStatus === 'paid',
          }),
        ]),
      )

      const coords = parseCoords(item, locObj)

      return {
        id,
        title,
        startDate,
        time: formatFinnishDateTime(startDate),
        locationName,
        venue: locationName,
        address: rawAddress,
        city,
        ...(coords
          ? {
              coordinates: coords,
              coords: [coords.lat, coords.lng] as [number, number],
            }
          : {}),
        ageRangeLabel: ageLabels.join(', '),
        ageGroup: ageLabels.join(', '),
        price: priceLabel(pricingStatus),
        pricingStatus,
        description,
        url,
        tags,
        source: 'karo-eventpulse-feed',
      }
    })

    return {
      events,
      debug: {
        url: KARO_EVENTPULSE_URL,
        status: res.status,
        rawItems: list.length,
      },
    }
  } catch (err) {
    return {
      events: [],
      debug: {
        url: KARO_EVENTPULSE_URL,
        status: null,
        error: err instanceof Error ? err.message : 'FETCH_FAILED',
        rawItems: 0,
      },
    }
  }
}

function mapLinkedEventRows(
  rows: Record<string, unknown>[],
  config: { city: string; sourceTag: string },
  limit: number,
): NormalizedFeedEvent[] {
  const results: NormalizedFeedEvent[] = []

  for (const row of rows.slice(0, limit)) {
    const rawId = String(row.id ?? '')
    if (!rawId) continue

    const title = pickLocalizedText(row.name)
    if (!title) continue

    const startDate = typeof row.start_time === 'string' ? row.start_time : ''
    const description = stripHtml(
      pickLocalizedText(row.short_description) || pickLocalizedText(row.description),
    ).slice(0, 260)

    const loc = (row.location && typeof row.location === 'object'
      ? row.location
      : {}) as Record<string, unknown>

    const locationName = pickLocalizedText(loc.name) || config.city
    const streetAddress = pickLocalizedText(loc.street_address)
    const locality = pickLocalizedText(loc.address_locality)
    const city = normalizeCityName(locality, config.city)

    const position = loc.position as { coordinates?: [number, number] } | undefined
    const geoCoords = Array.isArray(position?.coordinates) ? position.coordinates : undefined
    const lat = geoCoords && typeof geoCoords[1] === 'number' ? geoCoords[1] : undefined
    const lng = geoCoords && typeof geoCoords[0] === 'number' ? geoCoords[0] : undefined

    const infoUrl = pickLocalizedText(row.info_url)
    const ageLabels = extractAgeLabels(row, title, description)
    const price = extractPrice(row)
    const canonical = canonicalTags({
      title,
      description,
      ageLabels,
      ageValues: [
        row.audience_min_age,
        row.audience_max_age,
        row.audience,
        row.keywords,
      ],
      classificationData: [row.keywords, row.audience],
      isFree: price.status === 'free',
      isPaid: price.status === 'paid',
    })

    results.push({
      id: `le-${rawId}`,
      title,
      startDate,
      time: formatFinnishDateTime(startDate),
      locationName,
      venue: locationName,
      address: [streetAddress, city].filter(Boolean).join(', '),
      city,
      ...(typeof lat === 'number' && typeof lng === 'number'
        ? {
            coordinates: { lat, lng },
            coords: [lat, lng] as [number, number],
          }
        : {}),
      ageRangeLabel: ageLabels.join(', '),
      ageGroup: ageLabels.join(', '),
      price: price.label,
      pricingStatus: price.status,
      description: description || undefined,
      url: infoUrl || undefined,
      tags: ['linked-events', config.sourceTag, ...canonical],
      source: 'linked-events-pks',
    })
  }

  return results
}

async function fetchLinkedEventsForMunicipality(
  config: {
    city: string
    sourceTag: string
    division: string
    baseUrl: string
    defaultPageSize: number
  },
  options: { rawUnfiltered: boolean; page: number; pageSize: number },
): Promise<{ events: NormalizedFeedEvent[]; metaCount: number; hasNextPage: boolean; status: number | null; elapsedMs: number }> {
  const startedAt = Date.now()
  try {
    if (options.rawUnfiltered) {
      const url = new URL(config.baseUrl)
      url.searchParams.set('format', 'json')
      url.searchParams.set('include', 'location,keywords')
      url.searchParams.set('start', 'now')
      url.searchParams.set('sort', 'start_time')
      url.searchParams.set('page_size', String(options.pageSize))
      url.searchParams.set('page', String(options.page))
      url.searchParams.set('division', config.division)

      const res = await fetch(url.toString(), {
        cache: 'no-store',
        signal: AbortSignal.timeout(LINKED_EVENTS_TIMEOUT_MS),
      })
      if (!res.ok) {
        return { events: [], metaCount: 0, hasNextPage: false, status: res.status, elapsedMs: Date.now() - startedAt }
      }

      const payload = (await res.json()) as {
        meta?: { count?: number; next?: string | null }
        data?: Record<string, unknown>[]
      }
      const rows = Array.isArray(payload?.data) ? payload.data : []
      const metaCount = typeof payload?.meta?.count === 'number' ? payload.meta.count : rows.length
      const hasNextPage = Boolean(payload?.meta?.next)

      return {
        events: mapLinkedEventRows(rows, config, options.pageSize),
        metaCount,
        hasNextPage,
        status: res.status,
        elapsedMs: Date.now() - startedAt,
      }
    }

    const targetSize = config.defaultPageSize
    const buildDefaultUrl = (useFamilyKeywords: boolean) => {
      const url = new URL(config.baseUrl)
      url.searchParams.set('format', 'json')
      url.searchParams.set('include', 'location,keywords')
      url.searchParams.set('start', 'now')
      url.searchParams.set('sort', 'start_time')
      url.searchParams.set('super_event_type', 'none')
      url.searchParams.set('page_size', String(targetSize))
      url.searchParams.set('division', config.division)
      if (useFamilyKeywords) {
        url.searchParams.set('keyword', FAMILY_YSO_KEYWORDS)
      }
      return url.toString()
    }

    const res = await fetch(buildDefaultUrl(true), {
      cache: 'no-store',
      signal: AbortSignal.timeout(LINKED_EVENTS_TIMEOUT_MS),
    })
    const payload = res.ok
      ? ((await res.json()) as { meta?: { count?: number }; data?: Record<string, unknown>[] })
      : { data: [] }
    const rows = Array.isArray(payload?.data) ? [...payload.data] : []
    let metaCount = typeof payload?.meta?.count === 'number' ? payload.meta.count : rows.length

    if (rows.length < targetSize) {
      const fallbackRes = await fetch(buildDefaultUrl(false), {
        cache: 'no-store',
        signal: AbortSignal.timeout(LINKED_EVENTS_TIMEOUT_MS),
      })
      if (fallbackRes.ok) {
        const fbPayload = (await fallbackRes.json()) as {
          meta?: { count?: number }
          data?: Record<string, unknown>[]
        }
        if (typeof fbPayload?.meta?.count === 'number') {
          metaCount = fbPayload.meta.count
        }
        const fbRows = Array.isArray(fbPayload?.data) ? fbPayload.data : []
        const seenIds = new Set(rows.map((r) => String(r.id ?? '')))
        for (const r of fbRows) {
          const id = String(r.id ?? '')
          if (id && !seenIds.has(id)) {
            seenIds.add(id)
            rows.push(r)
          }
          if (rows.length >= targetSize) break
        }
      }
    }

    return {
      events: mapLinkedEventRows(rows, config, targetSize),
      metaCount,
      hasNextPage: metaCount > targetSize,
      status: res.status,
      elapsedMs: Date.now() - startedAt,
    }
  } catch {
    return { events: [], metaCount: 0, hasNextPage: false, status: null, elapsedMs: Date.now() - startedAt }
  }
}

async function fetchKauniainenWebEvents(): Promise<NormalizedFeedEvent[]> {
  try {
    const res = await fetch(KAUNIAINEN_EVENTS_URL, {
      cache: 'no-store',
      signal: AbortSignal.timeout(KAUNIAINEN_TIMEOUT_MS),
    })
    if (!res.ok) return []
    const html = await res.text()

    const matches = Array.from(
      html.matchAll(
        /<a[^>]+href="(https:\/\/www\.kauniainen\.fi\/tapahtuma\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
      ),
    )

    const seen = new Set<string>()
    const items: NormalizedFeedEvent[] = []

    for (const m of matches) {
      const link = m[1]
      const title = stripHtml(m[2])
      if (!link || !title || title.length < 4 || seen.has(link)) continue
      seen.add(link)
      const slug = link.replace(/\/+$/, '').split('/').pop() || String(items.length + 1)
      const ageLabels = [CANONICAL_AGE_FILTERS[4]]

      items.push({
        id: `grani-web-${slug}`,
        title,
        startDate: new Date().toISOString(),
        time: 'Katso ajankohta sivulta',
        locationName: 'Kauniainen (Grani)',
        venue: 'Kauniainen',
        city: 'Kauniainen',
        ageRangeLabel: ageLabels.join(', '),
        ageGroup: ageLabels.join(', '),
        price: 'Tarkista sivulta',
        pricingStatus: 'unknown',
        url: link,
        tags: [
          'kauniainen-web',
          ...canonicalTags({
            title,
            description: '',
            ageLabels,
          }),
        ],
        source: 'kauniainen-web',
      })

      if (items.length >= 6) break
    }

    return items
  } catch {
    return []
  }
}

function rebuildFeedCache(): void {
  const map = new Map<string, NormalizedFeedEvent>()
  const sourceEvents = [
    ...(feedCache.karoResult?.events ?? []),
    ...(feedCache.lahellaResult?.events ?? []),
    ...(feedCache.espooResult?.events ?? []),
    ...(feedCache.helsinkiResult?.events ?? []),
    ...(feedCache.vantaaResult?.events ?? []),
    ...(feedCache.kauniainenEvents ?? []),
  ]
  for (const event of sourceEvents) {
    if (!map.has(event.id)) map.set(event.id, event)
  }
  feedCache.combined = Array.from(map.values())
  feedCache.byCity = {}
  for (const event of feedCache.combined) {
    feedCache.byCity[event.city] = (feedCache.byCity[event.city] ?? 0) + 1
  }
  feedCache.linkedEventsTotal =
    (feedCache.helsinkiResult?.events.length ?? 0) +
    (feedCache.espooResult?.events.length ?? 0) +
    (feedCache.vantaaResult?.events.length ?? 0) +
    (feedCache.kauniainenEvents?.length ?? 0)
  feedCache.pagination = {
    helsinkiMetaCount: feedCache.helsinkiResult?.metaCount ?? 0,
    espooMetaCount: feedCache.espooResult?.metaCount ?? 0,
    vantaaMetaCount: feedCache.vantaaResult?.metaCount ?? 0,
    kauniainenCount: feedCache.kauniainenEvents.length,
  }
  feedCache.hasMorePages =
    feedCache.helsinkiResult?.hasNextPage === true ||
    feedCache.espooResult?.hasNextPage === true ||
    feedCache.vantaaResult?.hasNextPage === true ||
    feedCache.lahellaResult?.debug.hasMore === true
  feedCache.updatedAt = Date.now()
}

function getTaxonomyDebug(events: NormalizedFeedEvent[]) {
  const ageCounts = Object.fromEntries(
    CANONICAL_AGE_FILTERS.map((label) => [label, 0]),
  ) as Record<(typeof CANONICAL_AGE_FILTERS)[number], number>
  const themeCounts = Object.fromEntries(
    CANONICAL_THEME_FILTERS.map((label) => [label, 0]),
  ) as Record<(typeof CANONICAL_THEME_FILTERS)[number], number>
  const paidBySource = {
    lahella: 0,
    linkedEvents: 0,
    eventPulse: 0,
    kauniainen: 0,
    other: 0,
  }
  let paid = 0
  let free = 0
  let unknown = 0

  for (const event of events) {
    const tags = new Set(event.tags.map((tag) => tag.toLowerCase()))
    const ageLabels = new Set(
      event.ageGroup
        .split(',')
        .map((label) => label.trim().toLowerCase()),
    )
    for (const label of CANONICAL_AGE_FILTERS) {
      if (tags.has(label.toLowerCase()) || ageLabels.has(label.toLowerCase())) {
        ageCounts[label] += 1
      }
    }
    for (const label of CANONICAL_THEME_FILTERS) {
      if (tags.has(label.toLowerCase())) themeCounts[label] += 1
    }

    if (event.pricingStatus === 'paid') {
      paid += 1
      const source = event.source.toLowerCase()
      if (source.includes('lahella')) paidBySource.lahella += 1
      else if (source.includes('linked')) paidBySource.linkedEvents += 1
      else if (source.includes('eventpulse') || source.includes('karo')) {
        paidBySource.eventPulse += 1
      } else if (source.includes('kauniainen')) paidBySource.kauniainen += 1
      else paidBySource.other += 1
    } else if (event.pricingStatus === 'free') {
      free += 1
    } else {
      unknown += 1
    }
  }

  return {
    ageCounts,
    themeCounts,
    pricing: { total: events.length, paid, free, unknown, paidBySource },
  }
}

async function startFeedRefresh(
  rawUnfiltered: boolean,
  page: number,
  pageSize: number,
): Promise<void> {
  if (feedCache.refreshing) return
  feedCache.refreshing = true

  const refreshPromises = [
    fetchLahellaActivities().then((value) => {
      feedCache.lahellaResult = value
      feedCache.sourceElapsedMs.lahella = value.debug.elapsedMs ?? null
      feedCache.sourceStatus.lahella = value.debug.status
      rebuildFeedCache()
    }),
    fetchLinkedEventsForMunicipality(LINKED_EVENTS_ENDPOINTS[0], {
      rawUnfiltered,
      page,
      pageSize,
    }).then((value) => {
      feedCache.helsinkiResult = value
      feedCache.sourceElapsedMs.linked = Math.max(
        feedCache.sourceElapsedMs.linked ?? 0,
        value.elapsedMs,
      )
      feedCache.sourceStatus.linked = value.status
      rebuildFeedCache()
    }),
    fetchLinkedEventsForMunicipality(LINKED_EVENTS_ENDPOINTS[1], {
      rawUnfiltered,
      page,
      pageSize,
    }).then((value) => {
      feedCache.espooResult = value
      feedCache.sourceElapsedMs.linked = Math.max(feedCache.sourceElapsedMs.linked ?? 0, value.elapsedMs)
      feedCache.sourceStatus.linked = value.status
      rebuildFeedCache()
    }),
    fetchLinkedEventsForMunicipality(LINKED_EVENTS_ENDPOINTS[2], {
      rawUnfiltered,
      page,
      pageSize,
    }).then((value) => {
      feedCache.vantaaResult = value
      feedCache.sourceElapsedMs.linked = Math.max(feedCache.sourceElapsedMs.linked ?? 0, value.elapsedMs)
      feedCache.sourceStatus.linked = value.status
      rebuildFeedCache()
    }),
  ]

  void Promise.allSettled(refreshPromises).then(() => {
    rebuildFeedCache()
  })

  const eventPulseStartedAt = Date.now()
  void fetchKaroEventPulse().then((value) => {
    feedCache.karoResult = value
    feedCache.sourceStatus.eventPulse = value.debug.status
    feedCache.sourceElapsedMs.eventPulse = Date.now() - eventPulseStartedAt
    rebuildFeedCache()
  }).finally(() => {
    feedCache.refreshing = false
  })

  const kauniainenStartedAt = Date.now()
  void fetchKauniainenWebEvents().then((value) => {
    feedCache.kauniainenEvents = value
    feedCache.sourceElapsedMs.kauniainen = Date.now() - kauniainenStartedAt
    feedCache.sourceStatus.kauniainen = value.length > 0 ? 200 : null
    rebuildFeedCache()
  })

  await Promise.allSettled(refreshPromises)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode') === 'raw' ? 'raw' : 'default'
  const rawUnfiltered = mode === 'raw'

  const parsedPage = Number.parseInt(searchParams.get('page') || '1', 10)
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1

  const parsedPageSize = Number.parseInt(
    searchParams.get('pageSize') || (rawUnfiltered ? '50' : '25'),
    10,
  )
  const pageSize =
    Number.isFinite(parsedPageSize) && parsedPageSize >= 1
      ? Math.min(100, parsedPageSize)
      : rawUnfiltered
        ? 50
        : 25

  const cityParam = (searchParams.get('city') || 'all').trim()

  const cacheIsFresh =
    feedCache.updatedAt > 0 &&
    Date.now() - feedCache.updatedAt < FEED_CACHE_TTL_MS
  if (!cacheIsFresh) {
    await startFeedRefresh(rawUnfiltered, page, pageSize)
  } else if (!feedCache.refreshing) {
    void startFeedRefresh(rawUnfiltered, page, pageSize)
  }

  const dedupedMap = new Map<string, NormalizedFeedEvent>()
  for (const evt of feedCache.combined) {
    if (
      cityParam !== 'all' &&
      (evt.city || '').toLowerCase() !== cityParam.toLowerCase()
    ) {
      continue
    }
    if (!dedupedMap.has(evt.id)) {
      dedupedMap.set(evt.id, evt)
    }
  }

  const combined = Array.from(dedupedMap.values())

  const byCity: Record<string, number> = {}
  for (const evt of combined) {
    byCity[evt.city] = (byCity[evt.city] ?? 0) + 1
  }

  const linkedEventsTotal = feedCache.linkedEventsTotal
  const hasMorePages = feedCache.hasMorePages
  const taxonomyDebug = getTaxonomyDebug(combined)

  return NextResponse.json(
    {
      mode,
      events: combined,
      total: combined.length,
      pagination: {
        page,
        pageSize,
        hasNextPage: hasMorePages,
        hasPrevPage: page > 1,
        metaCountByCity: {
          helsinki: feedCache.pagination.helsinkiMetaCount,
          espoo: feedCache.pagination.espooMetaCount,
          vantaa: feedCache.pagination.vantaaMetaCount,
          kauniainen: feedCache.pagination.kauniainenCount,
        },
      },
      sources: {
        karoCount: feedCache.karoResult?.events.length ?? 0,
        lahellaCount: feedCache.lahellaResult?.events.length ?? 0,
        linkedEventsCount: linkedEventsTotal,
        byEndpoint: {
          helsinki: feedCache.helsinkiResult?.events.length ?? 0,
          espoo: feedCache.espooResult?.events.length ?? 0,
          vantaa: feedCache.vantaaResult?.events.length ?? 0,
          kauniainen: feedCache.kauniainenEvents.length,
        },
        byCity,
      },
      taxonomyDebug,
      karoDebug: feedCache.karoResult?.debug ?? null,
      lahellaDebug: feedCache.lahellaResult?.debug ?? null,
      cacheDebug: {
        ttlMs: FEED_CACHE_TTL_MS,
        updatedAt: feedCache.updatedAt,
        ageMs: feedCache.updatedAt > 0 ? Date.now() - feedCache.updatedAt : null,
        fresh: feedCache.updatedAt > 0 && Date.now() - feedCache.updatedAt < FEED_CACHE_TTL_MS,
        refreshing: feedCache.refreshing,
        sourceStatus: feedCache.sourceStatus,
        sourceElapsedMs: feedCache.sourceElapsedMs,
      },
      sourceTiming: {
        responseTimeoutMs: 0,
        lahellaTimeoutMs: LAHELLA_TIMEOUT_MS,
        linkedEventsTimeoutMs: LINKED_EVENTS_TIMEOUT_MS,
        eventPulseTimeoutMs: EVENTPULSE_TIMEOUT_MS,
        kauniainenTimeoutMs: KAUNIAINEN_TIMEOUT_MS,
      },
      isFallback: combined.length === 0,
    },
    { status: 200 },
  )
}
