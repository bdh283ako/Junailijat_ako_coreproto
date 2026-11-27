'use client'

import { buildGoogleCalendarUrl } from './googleCalendar'
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
  joinedEventIds: ReadonlySet<string>
  countsByEventId: Readonly<Record<string, number>>
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
  onToggleParticipation: (eventId: string, eventTitle: string, isGoing: boolean) => void
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

const FI_MONTH_SHORT = [
  'tammi',
  'helmi',
  'maalis',
  'huhti',
  'touko',
  'kesä',
  'heinä',
  'elo',
  'syys',
  'loka',
  'marras',
  'joulu',
]

// Vain visuaalinen apuri: poimii päivän ja kuukauden tapahtuman aikatekstistä
// (esim. "pe 27.11. klo 17.00"), jotta kortin reunaan saadaan päivämääräblokki.
// Alkuperäinen aikateksti näytetään silti aina myös tekstinä.
function parseEventDateLabel(time: string): { day: string; month: string } | null {
  const m = time.match(/(\d{1,2})\.(\d{1,2})\./)
  if (!m) return null
  const month = FI_MONTH_SHORT[Number(m[2]) - 1]
  return month ? { day: m[1], month } : null
}

export function EventsTabPanel({
  profile,
  sourceBadge,
  eventFeedStatus,
  filteredSortedEvents,
  baseAreaSortedEventsCount,
  matchedFamilies,
  joinedEventIds,
  countsByEventId,
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
    <div className="min-w-0 p-4 md:p-6 space-y-3 md:space-y-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h2 className="text-sm md:text-base font-bold text-[var(--color-ink)]">
            Lähialueen tapahtumat (lähin ensin)
          </h2>
          <p className="text-[11px] text-[var(--color-ink-muted)]">
            Koti: <strong>{profile.area}</strong> • Suodatin:{' '}
            <strong>{profile.filters.targetCity}</strong> ≤{' '}
            <strong>{profile.filters.maxDistanceKm} km</strong>
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${sourceBadge.className}`}
            >
              <span className={`w-2 h-2 rounded-full ${sourceBadge.dotClass}`} />
              <span className="min-w-0 break-words">{sourceBadge.label}</span>
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
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-slate-500">
            {filteredSortedEvents.length}/{baseAreaSortedEventsCount}
          </span>
          <button
            type="button"
            disabled={eventFeedStatus === 'loading'}
            onClick={onRefreshEvents}
            className="min-h-11 px-3 py-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)] text-[var(--color-ink)] text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {eventFeedStatus === 'loading' ? '↻ Ladataan...' : '↻ Päivitä'}
          </button>
        </div>
      </div>

      {participationError && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
        >
          {participationError}
        </p>
      )}

      <div className="bg-[var(--color-surface)] rounded-3xl p-3 border border-[var(--color-border)] shadow-xs space-y-2.5">
        <div className="flex min-w-0 flex-col md:flex-row md:items-center justify-between gap-2">
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
                  className={`min-h-11 px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${
                    active
                      ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)] shadow-xs'
                      : 'bg-[var(--color-surface)] text-[var(--color-ink-muted)] border border-[var(--color-border)] hover:bg-[var(--color-bg)]'
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <input
              type="search"
              value={eventSearchQuery}
              onChange={(e) => onEventSearchQueryChange(e.target.value)}
              placeholder="Hae tapahtumaa tai paikkaa..."
              aria-label="Hae tapahtumaa tai paikkaa"
              className="w-full min-w-0 flex-1 md:w-52 min-h-11 px-3 py-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] focus:bg-[var(--color-surface-strong)] text-xs text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] focus:border-[var(--color-accent)] focus:outline-none"
            />
            {hasActiveQuickEventFilter && (
              <button
                type="button"
                onClick={onClearEventFilters}
                className="min-h-11 px-3 py-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)] text-[11px] font-bold text-[var(--color-ink)] shrink-0"
                title="Tyhjennä ikä- ja hakusuodatin"
              >
                Tyhjennä
              </button>
            )}
          </div>
        </div>
      </div>

      {filteredSortedEvents.length === 0 ? (
        <div className="bg-[var(--color-surface)] rounded-3xl p-7 text-center border border-[var(--color-border)] space-y-3">
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
                className="min-h-11 px-4 py-2 rounded-xl bg-[var(--color-accent)] text-[var(--color-on-accent)] text-xs font-bold hover:brightness-110"
              >
                Näytä kaikki {profile.filters.maxDistanceKm} km:n säteellä
              </button>
            )}
            <button
              type="button"
              onClick={onOpenProfileSettings}
              className="min-h-11 px-4 py-2 rounded-xl bg-[var(--color-ink)] text-white text-xs font-bold hover:opacity-90"
            >
              Muokkaa oletusrajauksia
            </button>
          </div>
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {filteredSortedEvents.map((evt) => {
            const isGoing = joinedEventIds.has(evt.id)
            const dateLabel = parseEventDateLabel(evt.time)
            const participantCount = Object.hasOwn(countsByEventId, evt.id)
              ? countsByEventId[evt.id]
              : undefined
            const visibleParticipantCount =
              isLoadingParticipations && participantCount === undefined
                ? '…'
                : (participantCount ?? 0)
            const matchedGoing = profile.privacy.shareEventsWithMatches
              ? matchedFamilies.filter((f) => f.attendingEventId === evt.id)
              : []
            const gcalUrl = buildGoogleCalendarUrl(evt)

            return (
              <div
                key={evt.id}
                className="min-w-0 bg-[var(--color-surface)] rounded-3xl p-4 border border-[var(--color-border)] shadow-sm flex items-start gap-3"
              >
                {dateLabel && (
                  <div
                    aria-hidden="true"
                    className="shrink-0 w-12 rounded-2xl bg-[var(--color-accent-soft)] border border-[var(--color-border)] text-[var(--color-ink)] flex flex-col items-center justify-center py-2"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wide leading-none">
                      {dateLabel.month}
                    </span>
                    <span className="text-lg font-bold leading-tight">{dateLabel.day}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0 flex flex-col justify-between space-y-2.5">
                <div className="space-y-2">
                  <div className="flex min-w-0 flex-wrap justify-between items-start gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase">
                          {evt.district ? `${evt.district} (${evt.city})` : evt.city} •{' '}
                          {evt.hasExactCoords ? '' : '~'}
                          {evt.distanceKm} km kotoa
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--color-accent-soft)] text-[var(--color-ink)] border border-[var(--color-border)] text-[10px] font-bold">
                          👶 {evt.ageGroup || 'Kaikki ikäryhmät'}
                        </span>
                      </div>
                      <h3 className="min-w-0 break-words text-base font-bold text-[var(--color-ink)] leading-snug">
                        {evt.title}
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-[var(--color-bg)] text-[var(--color-ink-muted)] border border-[var(--color-border)] text-[11px] font-medium shrink-0">
                      {evt.price}
                    </span>
                  </div>

                  <p className="text-xs text-[var(--color-ink-muted)]">
                    📍 {evt.venue || evt.city} <br />🕒 {evt.time}
                  </p>

                  {evt.description && (
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                      {evt.description}
                    </p>
                  )}

                  {matchedGoing.length > 0 && (
                    <div className="px-2.5 py-1.5 rounded-lg bg-[var(--color-accent-soft)] border border-[var(--color-border)] text-xs text-[var(--color-ink)]">
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
                    onClick={() => onToggleParticipation(evt.id, evt.title, isGoing)}
                    className={`flex-1 min-w-[130px] min-h-11 py-2 px-3 rounded-xl text-xs font-bold transition-colors disabled:cursor-wait disabled:opacity-60 ${
                      isGoing
                        ? 'bg-[var(--color-accent-soft)] text-[var(--color-ink)] border border-[var(--color-border)]'
                        : 'bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:brightness-110'
                    }`}
                  >
                    {pendingEventIds.has(evt.id)
                      ? `Tallennetaan... (${visibleParticipantCount})`
                      : `${isGoing ? '✓ Menossa' : '+ Menossa'} (${visibleParticipantCount})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenEventChat(evt.id, evt.title)}
                    className="min-h-11 px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] text-xs font-bold hover:bg-[var(--color-bg)] transition-colors"
                    title="Keskustele tapahtumaan menossa olevien kanssa (anonyymi oletuksena)"
                  >
                    💬 Menossa-chat
                  </button>
                  <a
                    href={gcalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onLogSelection('GCAL_EXPORT', evt.id)}
                    className="min-h-11 px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] text-xs font-bold hover:bg-[var(--color-bg)] transition-colors"
                    title="Lisää tapahtuma Google Kalenteriin"
                  >
                    📅 Kalenteriin
                  </a>
                  <button
                    type="button"
                    onClick={() => onOpenMap(evt.coords, evt.id)}
                    className="min-h-11 px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] text-xs font-semibold hover:bg-[var(--color-bg)]"
                  >
                    Kartalla
                  </button>
                  {evt.url && (
                    <a
                      href={evt.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-11 px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] text-xs font-semibold hover:bg-[var(--color-bg)]"
                    >
                      Lisätiedot ↗
                    </a>
                  )}
                </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
