'use client'

import type {
  AuthenticatedGoogleUser,
  DbCommitFeedEntry,
  DbSyncStatus,
  DemoSelectionEvent,
  FloatingPos,
} from './protoData'
import { FloatingDockWindow } from './FloatingDockWindow'

export interface FeedSourcesMeta {
  karoCount: number
  linkedEventsCount: number
}

export interface EventFeedDebug {
  httpStatus: number | null
  errorDetail?: string
  count: number
}

export function DebugMonitorPanels({
  showDemoMonitor,
  showNerdDbFloat,
  currentUser,
  demoFloatPos,
  dbFloatPos,
  onDemoPosChange,
  onDbPosChange,
  onCloseDemoMonitor,
  onCloseNerdDbFloat,
  attendingIds,
  matchedIds,
  dismissedIds,
  profile,
  eventFeedStatus,
  eventFeedDebug,
  eventFeedSources,
  onRefreshEvents,
  demoSelections,
  mongoRevision,
  dbSyncStatus,
  latestDbEntry,
  dbFeedLog,
  onOpenStoreInspector,
}: {
  showDemoMonitor: boolean
  showNerdDbFloat: boolean
  currentUser: AuthenticatedGoogleUser | null
  demoFloatPos: FloatingPos | null
  dbFloatPos: FloatingPos | null
  onDemoPosChange: (next: FloatingPos) => void
  onDbPosChange: (next: FloatingPos) => void
  onCloseDemoMonitor: () => void
  onCloseNerdDbFloat: () => void
  attendingIds: string[]
  matchedIds: string[]
  dismissedIds: string[]
  profile: {
    homeCity: string
    filters: {
      maxDistanceKm: number
    }
  }
  eventFeedStatus: 'loading' | 'live-api' | 'fallback'
  eventFeedDebug: EventFeedDebug
  eventFeedSources: FeedSourcesMeta | null
  onRefreshEvents: () => void
  demoSelections: DemoSelectionEvent[]
  mongoRevision: number
  dbSyncStatus: DbSyncStatus
  latestDbEntry: DbCommitFeedEntry | null
  dbFeedLog: DbCommitFeedEntry[]
  onOpenStoreInspector: () => void
}) {
  return (
    <>
      {showDemoMonitor && (
        <FloatingDockWindow
          title={currentUser ? `DEMO_SEURANTA (${currentUser.id})` : 'DEMO_SEURANTA'}
          badge="NO_DB_PII"
          pos={demoFloatPos}
          onPosChange={onDemoPosChange}
          onClose={onCloseDemoMonitor}
          headerToneClass="bg-zinc-900 text-amber-400"
          borderToneClass="border-amber-500/40"
        >
          <div className="flex items-center justify-between font-mono text-[10px] text-zinc-400">
            <span>
              evt:{attendingIds.length} match:{matchedIds.length} skip:{dismissedIds.length}
            </span>
            <span className="text-orange-400">
              🟠 {profile.homeCity} ≤{profile.filters.maxDistanceKm}km
            </span>
          </div>

          <div
            className={`rounded-lg px-2 py-1.5 border font-mono text-[10px] space-y-1 ${
              eventFeedStatus === 'live-api'
                ? 'bg-[var(--color-amber)] text-white border-[var(--color-amber)]'
                : eventFeedStatus === 'loading'
                  ? 'bg-zinc-900 border-zinc-700 text-zinc-300'
                  : 'bg-rose-950/60 border-rose-700/50 text-rose-300'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold">/api/events</span>
              <div className="flex items-center gap-1.5">
                <span>
                  {eventFeedStatus === 'loading'
                    ? 'LOADING...'
                    : eventFeedDebug.httpStatus
                      ? `HTTP ${eventFeedDebug.httpStatus}`
                      : 'NET_ERR'}
                </span>
                <button
                  type="button"
                  disabled={eventFeedStatus === 'loading'}
                  onClick={onRefreshEvents}
                  className="min-h-11 rounded-lg bg-black/40 px-2 py-1 text-[9px] font-bold text-amber-300 hover:bg-black/70 disabled:opacity-50"
                >
                  ↻ Päivitä
                </button>
              </div>
            </div>
            {eventFeedDebug.errorDetail ? (
              <p className="text-[9px] text-rose-200 break-words">{eventFeedDebug.errorDetail}</p>
            ) : (
              eventFeedStatus === 'live-api' && (
                <p className="text-[9px] text-white">
                  OK • yht. {eventFeedDebug.count} (LE:{eventFeedSources?.linkedEventsCount ?? 0} |
                  EP:{eventFeedSources?.karoCount ?? 0})
                </p>
              )
            )}
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

      {showNerdDbFloat && (
        <FloatingDockWindow
          title={`POSTGRESQL // REV #${mongoRevision}`}
          badge={dbSyncStatus.toUpperCase()}
          pos={dbFloatPos}
          onPosChange={onDbPosChange}
          onClose={onCloseNerdDbFloat}
          headerToneClass="bg-indigo-950 text-[var(--color-accent-soft)]"
          borderToneClass="border-indigo-500/50"
        >
          {latestDbEntry ? (
            <div className="space-y-1 font-mono text-[10px]">
              <p className="text-[var(--color-accent-soft)] break-all">
                {latestDbEntry.terminalLine}
              </p>
              <p className="text-[var(--color-accent-soft)]/90">{latestDbEntry.diffStamp}</p>
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
                onClick={onOpenStoreInspector}
                className="px-2 py-1 rounded bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-mono text-[10px] font-bold"
              >
                Avaa backscroll →
              </button>
            )}
          </div>
        </FloatingDockWindow>
      )}
    </>
  )
}
