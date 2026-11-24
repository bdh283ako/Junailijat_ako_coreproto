'use client'

import { useCallback, useEffect, useState } from 'react'
import type { EventFeedDebug, FeedSourcesMeta } from './DebugMonitorPanels'
import { fetchKaroEventsFeed } from './eventFeedClient'
import { INITIAL_EVENTS } from './protoData'
import type { FamilyEvent } from './protoData'

export type EventFeedStatus = 'loading' | 'live-api' | 'fallback'

export interface UseEventsFeedOptions {
  onLogSelection: (action: string, detail: string) => void
}

export interface EventsFeedState {
  events: FamilyEvent[]
  eventFeedStatus: EventFeedStatus
  eventFeedSources: FeedSourcesMeta | null
  eventFeedDebug: EventFeedDebug
  loadEventsFeed: (manual?: boolean) => Promise<void>
}

export function useEventsFeed({ onLogSelection }: UseEventsFeedOptions): EventsFeedState {
  const [events, setEvents] = useState<FamilyEvent[]>(INITIAL_EVENTS)
  const [eventFeedStatus, setEventFeedStatus] = useState<EventFeedStatus>('loading')
  const [eventFeedSources, setEventFeedSources] = useState<FeedSourcesMeta | null>(null)
  const [eventFeedDebug, setEventFeedDebug] = useState<EventFeedDebug>({
    httpStatus: null,
    count: 0,
  })

  const loadEventsFeed = useCallback(
    async (manual = false): Promise<void> => {
      setEventFeedStatus('loading')
      try {
        const result = await fetchKaroEventsFeed('/api/events')
        const nextEvents = Array.isArray(result?.events)
          ? result.events
          : Array.isArray(result)
            ? (result as unknown as FamilyEvent[])
            : INITIAL_EVENTS

        const rawPayload = result as
          | {
              sources?: {
                karoCount?: number
                linkedEventsCount?: number
              }
            }
          | undefined

        const parsedSources: FeedSourcesMeta | null = rawPayload?.sources
          ? {
              karoCount: Number(rawPayload.sources.karoCount ?? 0),
              linkedEventsCount: Number(rawPayload.sources.linkedEventsCount ?? 0),
            }
          : null

        setEvents(nextEvents.length > 0 ? nextEvents : INITIAL_EVENTS)
        setEventFeedSources(parsedSources)
        setEventFeedStatus(result?.sourceStatus === 'live-api' ? 'live-api' : 'fallback')
        setEventFeedDebug({
          httpStatus: typeof result?.httpStatus === 'number' ? result.httpStatus : 200,
          errorDetail: result?.errorDetail,
          count: typeof result?.rawCount === 'number' ? result.rawCount : nextEvents.length,
        })
        const statusStr = result?.httpStatus ? `HTTP ${result.httpStatus}` : 'LOCAL_FALLBACK'
        const sourceSummary = parsedSources
          ? `LE:${parsedSources.linkedEventsCount} EP:${parsedSources.karoCount}`
          : `${nextEvents.length} items`
        const detailStr = result?.errorDetail
          ? `${statusStr} • ${result.errorDetail}`
          : `${statusStr} • ${sourceSummary}`
        onLogSelection(manual ? 'EVENTS_REFRESH' : 'EVENTS_API', detailStr)
      } catch (err) {
        setEvents(INITIAL_EVENTS)
        setEventFeedSources(null)
        setEventFeedStatus('fallback')
        const errMsg = err instanceof Error ? err.message : 'fetch_failed'
        setEventFeedDebug({
          httpStatus: null,
          errorDetail: errMsg,
          count: INITIAL_EVENTS.length,
        })
        onLogSelection(manual ? 'EVENTS_REFRESH' : 'EVENTS_API', `FALLBACK • ${errMsg}`)
      }
    },
    [onLogSelection],
  )

  useEffect(() => {
    void loadEventsFeed(false)
  }, [loadEventsFeed])

  return {
    events,
    eventFeedStatus,
    eventFeedSources,
    eventFeedDebug,
    loadEventsFeed,
  }
}
