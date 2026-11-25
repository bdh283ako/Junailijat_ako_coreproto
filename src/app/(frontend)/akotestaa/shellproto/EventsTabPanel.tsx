'use client'

import { buildGoogleCalendarUrl } from './googleCalendar'
import type { EventParticipationRecord } from './hooks/useEventChatAndParticipations'
import type { FamilyEvent, FamilyProfile, UserProfileState } from './protoData'

export type EventAgeQuickFilter = 'all' | '0-3' | '4-6' | '7-12' | 'all-ages'

type EventsTabEvent = FamilyEvent & {
  district?: string
  hasExactCoords: boolean
  distanceKm: number
}

interface EventsTabPanelProps {
  profile: UserProfileState
  sourceBadge: {
    label: string
    className: string
    dotClass: string
  }
  eventFeedStatus: 'loading' | 'live-api' | 'fallback'
  filteredSortedEvents: EventsTabEvent[]
  baseAreaSortedEventsCount: number
  matchedFamilies: Pick<FamilyProfile, 'attendingEventId' | 'name'>[]
  participations: EventParticipationRecord[]
  currentUserEmail: string
  pendingEventIds: ReadonlySet<string>
  isLoadingParticipations: boolean
  participationError: string | null
  eventAgeFilter: EventAgeQuickFilter
  onEventAgeFilterChange: (filter: EventAgeQuickFilter) => void
  eventSearchQuery: string
  onEventSearchQueryChange: (query: string) => void
  hasActiveQuickEventFilter: boolean
  ignoreDefaultPresetTemp: boolean
  onToggleDefaultPreset: () => void
  onRefreshEvents: () => void
  onClearEventFilters: () => void
  onShowAllEvents: () => void
  onOpenProfileSettings: () => void
  onToggleParticipation: (eventId: string, eventTitle: string) => void
  onOpenEventChat: (eventId: string, eventTitle: string) => void
  onLogSelection: (action: string, detail: string) => void
  onOpenMap: (coords: [number, number], label?: string) => void
}

const EVENT_AGE_QUICK_FILTERS: { id: EventAgeQuickFilter; label: string }[] = [
  { id: 'all', label: 'Kaikki iät' },
  { id: '0-3', label: '0–3 v' },
  { id: '4-6', label: '4–6 v' },
  { id: '7-12', label: '7–12 v' },
  { id: 'all-ages', label: 'Koko perhe' },
]

export function EventsTabPanel({
  profile,
  sourceBadge,
  eventFeedStatus,
  filteredSortedEvents,
  baseAreaSortedEventsCount,
  matchedFamilies,
  participations,
  currentUserEmail,
  pendingEventIds,
  isLoadingParticipations,
  participationError,
  eventAgeFilter,
  onEventAgeFilterChange,
  eventSearchQuery,
  onEventSearchQueryChange,
  hasActiveQuickEventFilter,
  ignoreDefaultPresetTemp,
  onToggleDefaultPreset,
  onRefreshEvents,
  onClearEventFilters,
  onShowAllEvents,
  onOpenProfileSettings,
  onToggleParticipation,
  onOpenEventChat,
  onLogSelection,
  onOpenMap,
}: EventsTabPanelProps) {
  return (
    <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <h2 className="text-sm sm:text-base font-bold text-slate-800">
            Lähialueen tapahtumat (lähin ensin)
          </h2>
          <p className="text-[11px] text-slate-500">
            Koti: <strong>{profile.area}</strong> • Suodatin:{' '}
            <strong>{profile.filters.targetCity}</strong> ≤{' '}
            <strong>{profile.filters.maxDistanceKm} km</strong>
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${sourceBadge.className}`}
            >
              <span className={`w-2 h-2 rounded-full ${sourceBadge.dotClass}`} />
              <span>{sourceBadge.label}</span>
            </div>
            {profile.defaultPreset.enabled && (
              <button
                type="button"
                onClick={onToggleDefaultPreset}
                className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold transition-colors ${
                  ignoreDefaultPresetTemp
                    ? 'bg-slate-100 text-slate-700 border-slate-300'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                {ignoreDefaultPresetTemp
                  ? 'Oletusrajaus tauolla • Palauta oletus'
                  : `Oletusrajaus aktiivinen (${profile.defaultPreset.favoriteActivities.length} aktiviteettia)`}
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-500">
            {filteredSortedEvents.length}/{baseAreaSortedEventsCount}
          </span>
          <button
            type="button"
            disabled={eventFeedStatus === 'loading'}
            onClick={onRefreshEvents}
            className="px-2.5 py-1 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {eventFeedStatus === 'loading' ? '↻ Ladataan...' : '↻ Päivitä'}
          </button>
        </div>
      </div>

      {participationError && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {participationError}
        </p>
      )}

      <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {EVENT_AGE_QUICK_FILTERS.map((item) => {
              const active = eventAgeFilter === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onEventAgeFilterChange(item.id)
                    onLogSelection('EVENTS_AGE_FILTER', item.id)
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
                    active
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="search"
              value={eventSearchQuery}
              onChange={(e) => onEventSearchQueryChange(e.target.value)}
              placeholder="Hae tapahtumaa tai paikkaa..."
              aria-label="Hae tapahtumaa tai paikkaa"
              className="w-full sm:w-52 px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
            />
            {hasActiveQuickEventFilter && (
              <button
                type="button"
                onClick={onClearEventFilters}
                className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-[11px] font-bold text-slate-700 shrink-0"
                title="Tyhjennä ikä- ja hakusuodatin"
              >
                Tyhjennä
              </button>
            )}
          </div>
        </div>
      </div>

      {filteredSortedEvents.length === 0 ? (
        <div className="bg-white rounded-2xl p-7 text-center border border-slate-200 space-y-3">
          <p className="text-2xl">📍</p>
          <h3 className="font-bold text-sm text-slate-900">
            Ei tapahtumia valituilla suodattimilla
          </h3>
          <p className="text-xs text-slate-500">
            Kokeile näyttää kaikki {profile.filters.maxDistanceKm} km:n säteellä olevat tapahtumat
            tai muokkaa profiilin oletusrajauksia.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {profile.defaultPreset.enabled && !ignoreDefaultPresetTemp && (
              <button
                type="button"
                onClick={onShowAllEvents}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
              >
                Näytä kaikki {profile.filters.maxDistanceKm} km:n säteellä
              </button>
            )}
            <button
              type="button"
              onClick={onOpenProfileSettings}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
            >
              Muokkaa oletusrajauksia
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {filteredSortedEvents.map((evt) => {
            const eventParticipations = participations.filter(
              (participation) => participation.eventId === evt.id && participation.status === 'going',
            )
            const isGoing = eventParticipations.some(
              (participation) =>
                participation.participantEmail.trim().toLowerCase() ===
                currentUserEmail.trim().toLowerCase(),
            )
            const matchedGoing = profile.privacy.shareEventsWithMatches
              ? matchedFamilies.filter((f) => f.attendingEventId === evt.id)
              : []
            const gcalUrl = buildGoogleCalendarUrl(evt)

            return (
              <div
                key={evt.id}
                className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between space-y-2.5"
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-blue-600 uppercase">
                          {evt.district ? `${evt.district} (${evt.city})` : evt.city} •{' '}
                          {evt.hasExactCoords ? '' : '~'}
                          {evt.distanceKm} km kotoa
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                          👶 {evt.ageGroup || 'Kaikki ikäryhmät'}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 leading-snug">
                        {evt.title}
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-medium shrink-0">
                      {evt.price}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">
                    📍 {evt.venue || evt.city} <br />
                    🕒 {evt.time}
                  </p>

                  {evt.description && (
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                      {evt.description}
                    </p>
                  )}

                  {matchedGoing.length > 0 && (
                    <div className="px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                      🤝 Mukana osumistasi:{' '}
                      <strong>{matchedGoing.map((m) => m.name).join(', ')}</strong>
                    </div>
                  )}
                </div>

                <div className="pt-1 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={pendingEventIds.has(evt.id)}
                    aria-pressed={isGoing}
                    onClick={() => onToggleParticipation(evt.id, evt.title)}
                    className={`flex-1 min-w-[130px] py-2 px-3 rounded-xl text-xs font-bold transition-colors disabled:cursor-wait disabled:opacity-60 ${
                      isGoing
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {pendingEventIds.has(evt.id)
                      ? 'Tallennetaan...'
                      : `${isGoing ? '✓ Menossa' : '+ Menossa'} (${isLoadingParticipations ? '…' : eventParticipations.length})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenEventChat(evt.id, evt.title)}
                    className="px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-950 text-xs font-bold hover:bg-amber-100 transition-colors"
                    title="Keskustele tapahtumaan menossa olevien kanssa (anonyymi oletuksena)"
                  >
                    💬 Menossa-chat
                  </button>
                  <a
                    href={gcalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onLogSelection('GCAL_EXPORT', evt.id)}
                    className="px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 text-xs font-bold hover:bg-emerald-100 transition-colors"
                    title="Lisää tapahtuma Google Kalenteriin"
                  >
                    📅 Kalenteriin
                  </a>
                  <button
                    type="button"
                    onClick={() => onOpenMap(evt.coords, evt.id)}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100"
                  >
                    Kartalla
                  </button>
                  {evt.url && (
                    <a
                      href={evt.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100"
                    >
                      Lisätiedot ↗
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
