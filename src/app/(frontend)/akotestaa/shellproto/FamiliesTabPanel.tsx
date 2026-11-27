'use client'

import type {
  calcFamilyMatch,
  FamilyEvent,
  FamilyProfile,
  UserProfileState,
} from './protoData'

export type FamilySubTab = 'discover' | 'matches'

type ScoredFamily = FamilyProfile & {
  id: string
  likedByMe: boolean
  likedMe: boolean
  isMutualMatch: boolean
  passedByMe: boolean
  matchChannelId: string
  distanceKm: number
  match: ReturnType<typeof calcFamilyMatch>
}

type FamilyHomeCard = ScoredFamily & {
  familyName: string
  updatedAt: string
}

interface FamilyHomeCarouselProps {
  families: FamilyHomeCard[]
  familyApiError: string | null
  pendingFamilyLikeId: string | null
  onSwipe: (family: FamilyHomeCard, liked: boolean) => void
}

export function FamilyHomeCarousel({
  families,
  familyApiError,
  pendingFamilyLikeId,
  onSwipe,
}: FamilyHomeCarouselProps) {
  return (
    <section
      aria-labelledby="nearby-families-heading"
      className="mx-auto min-w-0 w-full max-w-[430px] px-4 pt-4 sm:max-w-2xl sm:px-6 md:max-w-3xl"
    >
      <h2
        id="nearby-families-heading"
        className="mb-2 text-sm font-bold text-[var(--color-ink)]"
      >
        Perheitä lähelläsi
      </h2>
      {familyApiError && (
        <p
          role="alert"
          className="mb-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
        >
          Perheiden synkronointi epäonnistui: {familyApiError}
        </p>
      )}
      {families.length === 0 ? (
        <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-ink-muted)]">
          Ei tällä hetkellä hakuehtoihin sopivia perheitä.
        </p>
      ) : (
        <div
          role="region"
          aria-label="Lähialueen perheet"
          tabIndex={0}
          className="flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-2 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          {families.map((family) => (
            <article
              key={family.id}
              className="w-[82%] shrink-0 snap-start overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm sm:w-[340px] md:w-[380px]"
            >
              <div className="p-4">
                <div className="mb-2 flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-[var(--color-ink-muted)]">
                      📍 {family.area} · {family.distanceKm} km
                    </p>
                    <h3 className="mt-1 break-words text-lg font-bold text-[var(--color-ink)]">
                      {family.name}
                    </h3>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--color-accent)] px-2.5 py-1 text-xs font-bold text-white">
                    {family.match.percent} % match
                  </span>
                </div>
                <p className="mb-2 text-xs text-[var(--color-ink-muted)]">
                  👶 Lapset: {family.childrenAges}
                </p>
                {family.bio && (
                  <p className="line-clamp-2 min-h-10 text-sm leading-5 text-[var(--color-ink)]">
                    {family.bio}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    aria-label={`Ohita ${family.name}`}
                    disabled={pendingFamilyLikeId !== null}
                    onClick={() => onSwipe(family, false)}
                    className="min-h-11 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm font-bold text-[var(--color-ink)] disabled:cursor-wait disabled:opacity-60"
                  >
                    ✕ Ohita
                  </button>
                  <button
                    type="button"
                    aria-label={`${family.likedByMe ? 'Jo kiinnostunut' : 'Verkostoidu'}: ${family.name}`}
                    disabled={pendingFamilyLikeId !== null}
                    onClick={() => onSwipe(family, true)}
                    className="min-h-11 flex-1 rounded-xl bg-[var(--color-accent)] px-3 py-2 text-sm font-bold text-white hover:brightness-95 disabled:cursor-wait disabled:opacity-60"
                  >
                    {family.likedByMe ? '❤️ Jo kiinnostunut' : '🤝 Verkostoidu'}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export interface FamiliesTabPanelProps {
  familySubTab: FamilySubTab
  filteredDeckCount: number
  matchedFamilies: ScoredFamily[]
  currentCard: ScoredFamily | undefined
  profile: UserProfileState
  familyApiError: string | null
  safeEvents: FamilyEvent[]
  attendingIds: string[]
  onFamilySubTabChange: (tab: FamilySubTab) => void
  onLogSelection: (action: string, detail: string) => void
  onSwipe: (liked: boolean) => void
  onOpenProfileSettings: () => void
  onResetDismissed: () => void
  onOpenMap: (coords: [number, number], label: string) => void
  onOpenMatchesChat: (familyId: string) => void
}

export function FamiliesTabPanel(props: FamiliesTabPanelProps) {
  const {
    familySubTab,
    filteredDeckCount,
    matchedFamilies,
    currentCard,
    profile,
    familyApiError,
    safeEvents,
    attendingIds,
    onFamilySubTabChange,
    onLogSelection,
    onSwipe,
    onOpenProfileSettings,
    onResetDismissed,
    onOpenMap,
    onOpenMatchesChat,
  } = props

  return (
    <div className="min-w-0 p-4 md:p-6 space-y-4">
      {familyApiError && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          Perheiden synkronointi epäonnistui: {familyApiError}
        </p>
      )}
      <div className="grid grid-cols-2 md:hidden bg-slate-200 p-1 rounded-xl text-xs font-bold">
        <button
          type="button"
          onClick={() => {
            onFamilySubTabChange('discover')
            onLogSelection('FAMILIES_SUBTAB', 'discover')
          }}
          className={`py-2 rounded-lg transition-all ${
            familySubTab === 'discover'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600'
          }`}
        >
          Selaa ({filteredDeckCount})
        </button>
        <button
          type="button"
          onClick={() => {
            onFamilySubTabChange('matches')
            onLogSelection('FAMILIES_SUBTAB', 'matches')
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

      <div className="grid min-w-0 grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-start">
        <div className={familySubTab === 'discover' ? 'block min-w-0' : 'hidden min-w-0 md:block'}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-800">
              Perheitä lähelläsi ({filteredDeckCount})
            </h2>
          </div>

          {currentCard ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden">
              <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-5 text-white">
                <div className="flex justify-between items-center text-xs opacity-90 mb-1">
                  <span>📍 {currentCard.area}</span>
                  <span>{currentCard.distanceKm} km kotoa</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 break-words text-2xl font-extrabold">{currentCard.name}</h2>
                  <span className="px-2.5 py-1 rounded-full bg-white text-emerald-800 text-xs font-extrabold shadow-sm shrink-0">
                    {currentCard.match.percent} % match
                  </span>
                </div>
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
                <div className="grid grid-cols-4 gap-1.5 text-center bg-slate-50 border border-slate-200 rounded-xl p-2 text-[10px]">
                  <div>
                    <div className="font-extrabold text-emerald-700">
                      {currentCard.match.interestsPts}/40
                    </div>
                    <div className="text-slate-500">Tägit</div>
                  </div>
                  <div>
                    <div className="font-extrabold text-emerald-700">
                      {currentCard.match.distancePts}/30
                    </div>
                    <div className="text-slate-500">Etäisyys</div>
                  </div>
                  <div>
                    <div className="font-extrabold text-emerald-700">
                      {currentCard.match.agePts}/20
                    </div>
                    <div className="text-slate-500">Ikäryhmä</div>
                  </div>
                  <div>
                    <div className="font-extrabold text-emerald-700">
                      {currentCard.match.eventPts}/10
                    </div>
                    <div className="text-slate-500">Meno</div>
                  </div>
                </div>

                <p className="text-sm text-slate-700 leading-relaxed">{currentCard.bio}</p>

                {(() => {
                  const sharedEvt = safeEvents.find((e) => e.id === currentCard.attendingEventId)
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
                        {bothGoing ? '✨ Yhteinen tapahtuma!' : '📅 Menossa tapahtumaan:'}
                      </span>
                      {sharedEvt.title} ({sharedEvt.time})
                    </div>
                  )
                })()}

                <div className="flex flex-wrap gap-1.5">
                  {currentCard.interests.map((tag) => {
                    const isCommon =
                      profile.defaultPreset.favoriteActivities.includes(tag) ||
                      profile.interests.includes(tag)
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
                    onClick={() => onSwipe(false)}
                    className="py-3 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50"
                  >
                    ✕ Ohita
                  </button>
                  <button
                    type="button"
                    onClick={() => onSwipe(true)}
                    className="py-3 rounded-2xl bg-emerald-600 text-white font-bold text-sm shadow-sm hover:bg-emerald-700"
                  >
                    {currentCard.likedByMe ? '❤️ Jo kiinnostunut' : '🤝 Verkostoidu'}
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
                Etäisyydet lasketaan kotiseudustasi <strong>{profile.area}</strong> (max{' '}
                {profile.filters.maxDistanceKm} km).
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onOpenProfileSettings}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-800 text-xs font-bold"
                >
                  Muokkaa kotiseutua & filttereitä
                </button>
                <button
                  type="button"
                  onClick={onResetDismissed}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
                >
                  Palauta ohitetut
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={familySubTab === 'matches' ? 'block min-w-0' : 'hidden min-w-0 md:block'}>
          <div className="hidden md:flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-800">
              Osumat ({matchedFamilies.length})
            </h2>
          </div>

          <div className="space-y-3">
            {matchedFamilies.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center border border-slate-200">
                <p className="text-xs text-slate-500">
                  Ei vielä osumia. Selaa perheitä ja paina Verkostoidu!
                </p>
              </div>
            ) : (
              matchedFamilies.map((fam) => (
                <div
                  key={fam.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="break-words font-bold text-sm text-slate-900">{fam.name}</h3>
                      <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        {fam.match.percent} %
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {fam.area} ({fam.distanceKm} km) • {fam.childrenAges}
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
                      onClick={() => onOpenMap(fam.coords, fam.id)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
                    >
                      Kartta
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenMatchesChat(fam.matchChannelId)}
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
  )
}
