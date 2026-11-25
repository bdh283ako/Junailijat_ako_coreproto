'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export interface EventParticipationRecord {
  id: string | number
  eventId: string
  eventTitle: string
  participantEmail: string
  participantName: string
  status: 'going' | 'interested'
  createdAt?: string
  updatedAt?: string
}

export interface EventChatMessage {
  id: string | number
  channelId: string
  channelTitle: string
  senderEmail: string
  senderName: string
  body: string
  createdAt: string
}

export interface EventChatChannel {
  id: string
  title: string
  lastMessage: string
  lastSenderName: string
  lastSenderEmail: string
  lastMessageAt: string
  messageCount: number
  isEventActive: boolean
}

export interface ActiveEventChatChannel {
  id: string
  title: string
}

interface UseEventChatAndParticipationsOptions {
  activeEventIds: string[]
  currentUserEmail: string
  currentUserName: string
}

interface DemoIdentity {
  email: string
  name: string
}

const DEMO_IDENTITY_STORAGE_KEY = 'perhepiiri_event_api_demo_identity_v1'
let inMemoryDemoIdentity: DemoIdentity | null = null

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isDemoIdentity(value: unknown): value is DemoIdentity {
  return (
    isRecord(value) &&
    typeof value.email === 'string' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email) &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0
  )
}

function getOrCreateDemoIdentity(): DemoIdentity {
  if (inMemoryDemoIdentity) return inMemoryDemoIdentity

  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(DEMO_IDENTITY_STORAGE_KEY)
      if (saved) {
        const parsed: unknown = JSON.parse(saved)
        if (isDemoIdentity(parsed)) {
          inMemoryDemoIdentity = parsed
          return parsed
        }
      }
    } catch {
      // Fall back to the in-memory identity when localStorage is unavailable or malformed.
    }
  }

  const id =
    typeof window !== 'undefined' && typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const identity = {
    email: `demo-${id}@example.test`,
    name: `Demokäyttäjä ${id.slice(0, 8)}`,
  }
  inMemoryDemoIdentity = identity

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(DEMO_IDENTITY_STORAGE_KEY, JSON.stringify(identity))
    } catch {
      // The in-memory identity remains available for this browser session.
    }
  }

  return identity
}

function parseParticipation(value: unknown): EventParticipationRecord | null {
  if (!isRecord(value)) return null
  const { id, eventId, eventTitle, participantEmail, participantName, status } = value
  if (
    (typeof id !== 'string' && typeof id !== 'number') ||
    typeof eventId !== 'string' ||
    typeof eventTitle !== 'string' ||
    typeof participantEmail !== 'string' ||
    typeof participantName !== 'string' ||
    (status !== 'going' && status !== 'interested')
  ) {
    return null
  }

  return {
    id,
    eventId,
    eventTitle,
    participantEmail,
    participantName,
    status,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : undefined,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : undefined,
  }
}

function parseMessage(value: unknown): EventChatMessage | null {
  if (!isRecord(value)) return null
  const { id, channelId, channelTitle, senderEmail, senderName, body, createdAt } = value
  if (
    (typeof id !== 'string' && typeof id !== 'number') ||
    typeof channelId !== 'string' ||
    typeof channelTitle !== 'string' ||
    typeof senderEmail !== 'string' ||
    typeof senderName !== 'string' ||
    typeof body !== 'string' ||
    typeof createdAt !== 'string'
  ) {
    return null
  }

  return { id, channelId, channelTitle, senderEmail, senderName, body, createdAt }
}

function parseChannel(value: unknown): Omit<EventChatChannel, 'isEventActive'> | null {
  if (!isRecord(value)) return null
  const {
    channelId,
    channelTitle,
    lastMessage,
    lastSenderName,
    lastSenderEmail,
    lastMessageAt,
    messageCount,
  } = value
  if (
    typeof channelId !== 'string' ||
    typeof channelTitle !== 'string' ||
    typeof lastMessage !== 'string' ||
    typeof lastSenderName !== 'string' ||
    typeof lastSenderEmail !== 'string' ||
    typeof lastMessageAt !== 'string' ||
    typeof messageCount !== 'number'
  ) {
    return null
  }

  return {
    id: channelId,
    title: channelTitle,
    lastMessage,
    lastSenderName,
    lastSenderEmail,
    lastMessageAt,
    messageCount,
  }
}

function parseRecords<T>(
  value: unknown,
  parser: (item: unknown) => T | null,
  label: string,
): T[] {
  if (!Array.isArray(value)) throw new Error(`Palvelimen vastaus ei sisällä ${label}-listaa.`)
  return value.map((item, index) => {
    const parsed = parser(item)
    if (!parsed) throw new Error(`Palvelimen ${label}-listan rivi ${index + 1} on virheellinen.`)
    return parsed
  })
}

async function getResponseError(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (isRecord(body) && typeof body.error === 'string') return body.error
  } catch {
    // Use the HTTP status when the server response is not JSON.
  }
  return `${fallback} (HTTP ${response.status})`
}

function mergeMessages(
  current: EventChatMessage[],
  incoming: EventChatMessage[],
): EventChatMessage[] {
  const byId = new Map<string, EventChatMessage>()
  for (const message of [...current, ...incoming]) {
    byId.set(String(message.id), message)
  }
  return Array.from(byId.values())
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-200)
}

export function useEventChatAndParticipations({
  activeEventIds,
  currentUserEmail,
  currentUserName,
}: UseEventChatAndParticipationsOptions) {
  const activeEventIdsKey = JSON.stringify(
    Array.from(new Set(activeEventIds.filter((eventId) => eventId.trim()))).sort(),
  )
  const activeEventIdSet = useMemo(
    () => new Set(JSON.parse(activeEventIdsKey) as string[]),
    [activeEventIdsKey],
  )
  const normalizedEmail = currentUserEmail.trim().toLowerCase()
  const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  const [demoIdentity, setDemoIdentity] = useState<DemoIdentity | null>(null)

  useEffect(() => {
    setDemoIdentity(hasValidEmail ? null : getOrCreateDemoIdentity())
  }, [hasValidEmail])

  const resolveIdentity = useCallback((): DemoIdentity => {
    if (hasValidEmail) {
      return {
        email: normalizedEmail,
        name: currentUserName.trim() || normalizedEmail.split('@')[0] || 'Google-käyttäjä',
      }
    }
    const identity = getOrCreateDemoIdentity()
    setDemoIdentity(identity)
    return identity
  }, [currentUserName, hasValidEmail, normalizedEmail])
  const effectiveIdentity = hasValidEmail
    ? {
        email: normalizedEmail,
        name: currentUserName.trim() || normalizedEmail.split('@')[0] || 'Google-käyttäjä',
      }
    : demoIdentity
  const participationEmail = effectiveIdentity?.email ?? ''

  const [participations, setParticipations] = useState<EventParticipationRecord[]>([])
  const [isLoadingParticipations, setIsLoadingParticipations] = useState(false)
  const [pendingEventIds, setPendingEventIds] = useState<Set<string>>(() => new Set())
  const [participationError, setParticipationError] = useState<string | null>(null)

  const [rawChannels, setRawChannels] = useState<
    Omit<EventChatChannel, 'isEventActive'>[]
  >([])
  const [activeChannel, setActiveChannel] = useState<ActiveEventChatChannel | null>(null)
  const [messages, setMessages] = useState<EventChatMessage[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [channelError, setChannelError] = useState<string | null>(null)
  const activeChannelRef = useRef(activeChannel)
  activeChannelRef.current = activeChannel

  const channels = useMemo(
    () =>
      rawChannels.map((channel) => {
        const isEventChannel = channel.id.startsWith('event:')
        return {
          ...channel,
          isEventActive:
            !isEventChannel || activeEventIdSet.has(channel.id.slice('event:'.length)),
        }
      }),
    [activeEventIdSet, rawChannels],
  )

  useEffect(() => {
    if (!participationEmail) {
      setParticipations([])
      setIsLoadingParticipations(false)
      setParticipationError(null)
      return
    }

    const controller = new AbortController()
    let cancelled = false

    const loadParticipations = async () => {
      setIsLoadingParticipations(true)
      setParticipationError(null)
      try {
        const params = new URLSearchParams({ participantEmail: participationEmail })
        const response = await fetch(`/api/participations?${params}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(await getResponseError(response, 'Osallistumisten haku epäonnistui'))
        }
        const result: unknown = await response.json()
        if (!isRecord(result)) throw new Error('Osallistumisten palvelinvastaus on virheellinen.')
        const docs = parseRecords(result.docs, parseParticipation, 'osallistumis')
        if (!cancelled) setParticipations(docs)
      } catch (error) {
        if (!cancelled && !(error instanceof DOMException && error.name === 'AbortError')) {
          setParticipationError(
            error instanceof Error ? error.message : 'Osallistumisten haku epäonnistui',
          )
        }
      } finally {
        if (!cancelled) setIsLoadingParticipations(false)
      }
    }

    void loadParticipations()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [participationEmail])

  const refreshChannels = useCallback(async () => {
    try {
      const response = await fetch('/api/chat', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(await getResponseError(response, 'Keskustelukanavien haku epäonnistui'))
      }
      const result: unknown = await response.json()
      if (!isRecord(result)) throw new Error('Keskustelukanavien palvelinvastaus on virheellinen.')
      const parsedChannels = parseRecords(result.channels, parseChannel, 'keskustelukanava')
      setRawChannels(parsedChannels)
      setChannelError(null)
    } catch (error) {
      setChannelError(
        error instanceof Error ? error.message : 'Keskustelukanavien haku epäonnistui',
      )
    }
  }, [])

  useEffect(() => {
    void refreshChannels()
  }, [refreshChannels])

  useEffect(() => {
    const intervalId = setInterval(() => void refreshChannels(), 3000)
    return () => clearInterval(intervalId)
  }, [refreshChannels])

  const toggleParticipation = useCallback(
    async (
      eventId: string,
      eventTitle: string,
    ): Promise<'going' | 'removed' | false> => {
      const identity = resolveIdentity()
      if (pendingEventIds.has(eventId)) return false

      setPendingEventIds((current) => new Set(current).add(eventId))
      setParticipationError(null)
      try {
        const existing = participations.find(
          (participation) =>
            participation.eventId === eventId &&
            participation.participantEmail.trim().toLowerCase() === identity.email,
        )

        if (existing) {
          const params = new URLSearchParams({
            eventId,
            participantEmail: identity.email,
          })
          const response = await fetch(`/api/participations?${params}`, { method: 'DELETE' })
          if (!response.ok) {
            throw new Error(await getResponseError(response, 'Osallistumisen poisto epäonnistui'))
          }
          setParticipations((current) =>
            current.filter(
              (participation) =>
                !(
                  participation.eventId === eventId &&
                  participation.participantEmail.trim().toLowerCase() === identity.email
                ),
            ),
          )
          return 'removed'
        }

        const response = await fetch('/api/participations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId,
            eventTitle,
            participantEmail: identity.email,
            participantName: identity.name,
            status: 'going',
          }),
        })
        if (!response.ok) {
          throw new Error(await getResponseError(response, 'Osallistumisen tallennus epäonnistui'))
        }
        const result: unknown = await response.json()
        const participation = isRecord(result) ? parseParticipation(result.doc) : null
        if (!participation) throw new Error('Palvelin palautti virheellisen osallistumistiedon.')
        setParticipations((current) => [
          ...current.filter(
            (item) =>
              !(
                item.eventId === eventId &&
                item.participantEmail.trim().toLowerCase() === identity.email
              ),
          ),
          participation,
        ])
        return 'going'
      } catch (error) {
        setParticipationError(
          error instanceof Error ? error.message : 'Osallistumisen päivitys epäonnistui',
        )
        return false
      } finally {
        setPendingEventIds((current) => {
          const next = new Set(current)
          next.delete(eventId)
          return next
        })
      }
    },
    [participations, pendingEventIds, resolveIdentity],
  )

  const activeChannelId = activeChannel?.id ?? null
  useEffect(() => {
    if (!activeChannelId) {
      setMessages([])
      setIsLoadingMessages(false)
      return
    }

    let cancelled = false
    let loading = false
    setMessages([])
    setIsLoadingMessages(true)
    setChatError(null)

    const loadMessages = async () => {
      if (loading) return
      loading = true
      try {
        const params = new URLSearchParams({ channelId: activeChannelId })
        const response = await fetch(`/api/chat?${params}`, { cache: 'no-store' })
        if (!response.ok) {
          throw new Error(await getResponseError(response, 'Viestien haku epäonnistui'))
        }
        const result: unknown = await response.json()
        if (!isRecord(result)) throw new Error('Viestien palvelinvastaus on virheellinen.')
        const nextMessages = parseRecords(result.messages, parseMessage, 'viesti')
        if (!cancelled) {
          setMessages((current) => mergeMessages(current, nextMessages))
          setChatError(null)
        }
      } catch (error) {
        if (!cancelled) {
          setChatError(error instanceof Error ? error.message : 'Viestien haku epäonnistui')
        }
      } finally {
        loading = false
        if (!cancelled) setIsLoadingMessages(false)
      }
    }

    void loadMessages()
    const intervalId = setInterval(() => void loadMessages(), 3000)
    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [activeChannelId])

  const sendMessage = useCallback(
    async (body: string): Promise<boolean> => {
      const channel = activeChannelRef.current
      const messageBody = body.trim()
      if (!channel) {
        setChatError('Valitse ensin keskustelukanava.')
        return false
      }
      if (!messageBody) return false

      const identity = resolveIdentity()
      setIsSendingMessage(true)
      setChatError(null)
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channelId: channel.id,
            channelTitle: channel.title,
            senderEmail: identity.email,
            senderName: identity.name,
            body: messageBody,
          }),
        })
        if (!response.ok) {
          throw new Error(await getResponseError(response, 'Viestin lähetys epäonnistui'))
        }
        const result: unknown = await response.json()
        const message = isRecord(result) ? parseMessage(result.message) : null
        if (!message) throw new Error('Palvelin palautti virheellisen viestin.')

        if (activeChannelRef.current?.id === channel.id) {
          setMessages((current) => mergeMessages(current, [message]))
        }
        setRawChannels((current) => {
          const previous = current.find((item) => item.id === channel.id)
          return [
            {
              id: channel.id,
              title: channel.title,
              lastMessage: message.body,
              lastSenderName: message.senderName,
              lastSenderEmail: message.senderEmail,
              lastMessageAt: message.createdAt,
              messageCount: (previous?.messageCount ?? 0) + 1,
            },
            ...current.filter((item) => item.id !== channel.id),
          ]
        })
        return true
      } catch (error) {
        setChatError(error instanceof Error ? error.message : 'Viestin lähetys epäonnistui')
        return false
      } finally {
        setIsSendingMessage(false)
      }
    },
    [resolveIdentity],
  )

  return {
    participations,
    isLoadingParticipations,
    pendingEventIds,
    participationError,
    toggleParticipation,
    participantEmail: effectiveIdentity?.email ?? '',
    participantName: effectiveIdentity?.name ?? '',
    isDemoIdentity: !hasValidEmail,
    channels,
    activeChannel,
    setActiveChannel,
    messages,
    isLoadingMessages,
    isSendingMessage,
    chatError: chatError ?? channelError,
    sendMessage,
  }
}
