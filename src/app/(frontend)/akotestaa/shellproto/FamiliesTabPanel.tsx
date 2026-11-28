'use client'

import type {
  calcFamilyMatch,
  FamilyEvent,
  FamilyProfile,
  UserProfileState,
} from './protoData'
import { MapPin, MessageCircle, UserPlus, X } from 'lucide-react'

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
  isDiscoverable: boolean
  isShowingMatchesFallback: boolean
  onSwipe: (family: FamilyHomeCard, liked: boolean) => void
  onOpenMatchesChat: (familyId: string) => void
}

export function FamilyHomeCarousel({
  families,
  familyApiError,
  pendingFamilyLikeId,
  isDiscoverable,
  isShowingMatchesFallback,
  onSwipe,
  onOpenMatchesChat,
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
      {isShowingMatchesFallback && (
        <p
          role="status"
          className="mb-2 rounded-xl border border-[#2F5D50]/40 bg-[var(--color-accent-soft)] p-3 text-xs text-[var(--color-ink)]"
        >
          {isDiscoverable
            ? 'Valituilla rajauksilla ei löytynyt uusia perheitä. Tässä näkyvät jo syntyneet keskinäiset mätsisi.'
            : 'Perheprofiilisi näkyvyys on pois päältä. Tässä näkyvät jo syntyneet keskinäiset mätsisi.'}
        </p>
      )}
      {families.length === 0 ? (
        <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-ink-muted)]">
          {isDiscoverable
            ? 'Demossa on rajallisesti perheprofiileja. Valituilla ikä-, kaupunki- ja säderajauksilla ei löytynyt perheitä. Kokeile laajentaa rajauksia Perheet-välilehdellä.'
            : 'Perheprofiilisi näkyvyys on pois päältä, joten uusien lähialueen perheiden selaus on tauolla. Voit ottaa näkyvyyden käyttöön Perheet-välilehden tietosuoja-asetuksissa.'}
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
                    <p className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[11px] font-semibold text-[var(--color-ink)]">
                      <MapPin aria-hidden="true" size={13} strokeWidth={2} />
                      <span className="truncate">{family.area}</span>
                      <span>· {family.distanceKm} km</span>
                    </p>
                    <h3 className="mt-1 break-words text-lg font-bold text-[var(--color-ink)]">
                      {family.name}
                    </h3>
                  </div>
                  <span className="shrink-0 rounded-full border border-[#2F5D50]/40 bg-[var(--color-accent-soft)] px-2.5 py-1 text-xs font-bold text-[var(--color-ink)]">
                    {family.match.percent} % match
                  </span>
                </div>
                <span className="inline-flex rounded-full border border-[#9E4B16]/40 bg-[var(--color-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--color-ink)]">
                  Lapset: {family.childrenAges}
                </span>
                {family.bio && (
                  <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-[var(--color-ink)]">
                    {family.bio}
                  </p>
                )}
                {family.interests.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Perheen kiinnostuksen kohteet">
                    {family.interests.slice(0, 3).map((interest) => (
                      <span
                        key={interest}
                        className="rounded-full bg-[var(--color-bg)] px-2.5 py-1 text-[11px] text-[var(--color-ink-muted)]"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                )}
                {isShowingMatchesFallback ? (
                  <button
                    type="button"
                    onClick={() => onOpenMatchesChat(family.matchChannelId)}
                    className="mt-3 min-h-11 w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-accent)] px-3 py-2 text-sm font-bold text-white hover:brightness-95"
                  >
                    <MessageCircle aria-hidden="true" size={16} strokeWidth={2} />
                    Avaa keskustelu
                  </button>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      aria-label={`Ohita ${family.name}`}
                      disabled={pendingFamilyLikeId !== null}
                      onClick={() => onSwipe(family, false)}
                      className="min-h-11 flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm font-bold text-[var(--color-ink)] disabled:cursor-wait disabled:opacity-60"
                    >
                      <X aria-hidden="true" size={16} strokeWidth={2} />
                      Ohita
                    </button>
                    <button
                      type="button"
                      aria-label={`${family.likedByMe ? 'Jo kiinnostunut' : 'Verkostoidu'}: ${family.name}`}
                      disabled={pendingFamilyLikeId !== null}
                      onClick={() => onSwipe(family, true)}
                      className={`min-h-11 flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold disabled:cursor-wait disabled:opacity-60 ${
                        family.likedByMe
                          ? 'border-2 border-[#2F5D50] bg-[var(--color-accent-soft)] text-[var(--color-ink)]'
                          : 'bg-[var(--color-accent)] text-white hover:brightness-95'
                      }`}
                    >
                      {!family.likedByMe && <UserPlus aria-hidden="true" size={16} strokeWidth={2} />}
                      {family.likedByMe ? 'Jo kiinnostunut' : 'Verkostoidu'}
                    </button>
                  </div>
                )}
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
            <div className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
              <div
                aria-hidden="true"
                className="h-1.5 bg-[#9CB9B7]"
              />
              <div className="bg-[var(--color-bg)] p-5 text-[var(--color-ink)]">
                <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 font-semibold">
                    <MapPin aria-hidden="true" size={13} strokeWidth={2} />
                    {currentCard.area}
                  </span>
                  <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[var(--color-ink-muted)]">
                    {currentCard.distanceKm} km kotoa
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 break-words text-2xl font-extrabold">{currentCard.name}</h2>
                  <span className="shrink-0 rounded-full border border-[#2F5D50]/40 bg-[var(--color-accent-soft)] px-2.5 py-1 text-xs font-extrabold text-[var(--color-ink)]">
                    {currentCard.match.percent} % match
                  </span>
                </div>
                <span className="mt-2 inline-flex rounded-full border border-[#9E4B16]/40 bg-[var(--color-surface)] px-2.5 py-1 text-xs font-semibold">
                  Lapset: {currentCard.childrenAges}
                </span>
                {profile.privacy.showCloseRelativesInMatches &&
                  currentCard.hasCloseRelatives &&
                  currentCard.closeRelativesSummary && (
                    <p className="mt-2 inline-block rounded-lg border border-[#2F5D50]/30 bg-[var(--color-surface)] px-2.5 py-1 text-xs text-[var(--color-ink)]">
                      Läheiset: {currentCard.closeRelativesSummary}
                    </p>
                  )}
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-4 gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-center text-[10px]">
                  <div>
                    <div className="font-extrabold text-[#2F5D50]">
                      {currentCard.match.interestsPts}/40
                    </div>
                    <div className="text-slate-500">Tägit</div>
                  </div>
                  <div>
                    <div className="font-extrabold text-[#2F5D50]">
                      {currentCard.match.distancePts}/30
                    </div>
                    <div className="text-slate-500">Etäisyys</div>
                  </div>
                  <div>
                    <div className="font-extrabold text-[#2F5D50]">
                      {currentCard.match.agePts}/20
                    </div>
                    <div className="text-slate-500">Ikäryhmä</div>
                  </div>
                  <div>
                    <div className="font-extrabold text-[#2F5D50]">
                      {currentCard.match.eventPts}/10
                    </div>
                    <div className="text-slate-500">Meno</div>
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-[var(--color-ink)]">{currentCard.bio}</p>

                {(() => {
                  const sharedEvt = safeEvents.find((e) => e.id === currentCard.attendingEventId)
                  if (!sharedEvt) return null
                  const bothGoing = attendingIds.includes(sharedEvt.id)
                  return (
                    <div
                      className={`p-3 rounded-xl border text-xs ${
                        bothGoing
                          ? 'bg-[#2F5D50] border-[#2F5D50] text-white'
                          : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-ink)]'
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
                            ? 'bg-[var(--color-accent-soft)] text-[var(--color-ink)] border border-[#2F5D50] font-semibold'
                            : 'bg-[var(--color-bg)] text-[var(--color-ink-muted)]'
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
                    className="min-h-11 rounded-2xl border-2 border-[var(--color-border)] bg-[var(--color-surface)] py-3 font-bold text-sm text-[var(--color-ink)] hover:bg-[var(--color-bg)]"
                  >
                    ✕ Ohita
                  </button>
                  <button
                    type="button"
                    onClick={() => onSwipe(true)}
                    className={`min-h-11 rounded-2xl py-3 font-bold text-sm shadow-sm ${
                      currentCard.likedByMe
                        ? 'border-2 border-[#2F5D50] bg-[var(--color-accent-soft)] text-[var(--color-ink)]'
                        : 'bg-[var(--color-accent)] text-white hover:brightness-95'
                    }`}
                  >
                    {currentCard.likedByMe ? '❤️ Jo kiinnostunut' : '🤝 Verkostoidu'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-7 text-center border border-slate-200 space-y-3">
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
                  className="min-h-11 px-3.5 py-2 rounded-xl border border-slate-300 text-slate-800 text-xs font-bold"
                >
                  Muokkaa kotiseutua & filttereitä
                </button>
                <button
                  type="button"
                  onClick={onResetDismissed}
                  className="min-h-11 px-3.5 py-2 rounded-xl bg-[var(--color-ink)] text-white text-xs font-bold"
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
              <div className="bg-white rounded-3xl p-6 text-center border border-slate-200">
                <p className="text-xs text-slate-500">
                  Ei vielä osumia. Selaa perheitä ja paina Verkostoidu!
                </p>
              </div>
            ) : (
              matchedFamilies.map((fam) => (
                <article
                  key={fam.id}
                  className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
                >
                  <div className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <h3 className="break-words font-bold text-sm text-[var(--color-ink)]">
                          {fam.name}
                        </h3>
                        <span className="rounded-full border border-[#2F5D50]/40 bg-[var(--color-accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-ink)]">
                          {fam.match.percent} % match
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[11px] font-semibold text-[var(--color-ink)]">
                          <MapPin aria-hidden="true" size={12} strokeWidth={2} />
                          {fam.area} · {fam.distanceKm} km
                        </span>
                        <span className="rounded-full border border-[#9E4B16]/40 bg-[var(--color-bg)] px-2 py-1 text-[11px] font-semibold text-[var(--color-ink)]">
                          {fam.childrenAges}
                        </span>
                      </div>
                      {fam.interests.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1" aria-label="Perheen kiinnostuksen kohteet">
                          {fam.interests.slice(0, 3).map((interest) => (
                            <span
                              key={interest}
                              className="rounded-full bg-[var(--color-bg)] px-2 py-0.5 text-[10px] text-[var(--color-ink-muted)]"
                            >
                              {interest}
                            </span>
                          ))}
                        </div>
                      )}
                      {profile.privacy.showCloseRelativesInMatches &&
                        fam.hasCloseRelatives &&
                        fam.closeRelativesSummary && (
                          <p className="mt-1 text-[11px] text-[#2F5D50]">
                            {fam.closeRelativesSummary}
                          </p>
                        )}
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenMap(fam.coords, fam.id)}
                        className="min-h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface-alt)]"
                      >
                        Katso kartalla
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenMatchesChat(fam.matchChannelId)}
                        className="min-h-11 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-bold text-white hover:brightness-95"
                      >
                        Avaa keskustelu
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
