'use client'

import React from 'react'
import {
  AGE_GROUP_OPTIONS,
  AREA_COORDS,
  AuthenticatedGoogleUser,
  DEFAULT_ACTIVITY_TAGS,
  inferAgeGroupsFromChildren,
  UserProfileState,
} from './protoData'

interface ProfileSettingsPanelProps {
  currentUser: AuthenticatedGoogleUser
  profile: UserProfileState
  onChangeProfile: React.Dispatch<React.SetStateAction<UserProfileState>>
  totalParentsCount: number
  filteredDeckCount: number
  dbFeedCount: number
  profileSavedToast: boolean
  transientResetToast: boolean
  authRedirecting: boolean
  onOpenMembers: () => void
  onOpenStoreInspector: () => void
  onSaveProfile: () => void
  onResetTransientData: () => void
  onSignOut: () => void
  onLogSelection: (action: string, detail: string) => void
}

export function ProfileSettingsPanel({
  currentUser,
  profile,
  onChangeProfile,
  totalParentsCount,
  filteredDeckCount,
  dbFeedCount,
  profileSavedToast,
  transientResetToast,
  authRedirecting,
  onOpenMembers,
  onOpenStoreInspector,
  onSaveProfile,
  onResetTransientData,
  onSignOut,
  onLogSelection,
}: ProfileSettingsPanelProps) {
  const inferredAges = inferAgeGroupsFromChildren(profile.children)

  const handleAreaChange = (nextArea: string) => {
    const meta = AREA_COORDS[nextArea]
    onChangeProfile((prev) => ({
      ...prev,
      area: nextArea,
      homeCity: meta?.city ?? prev.homeCity,
      homeCoords: meta?.coords ?? prev.homeCoords,
    }))
    onLogSelection('PROFILE_AREA', nextArea)
  }

  const toggleFavoriteActivity = (tag: string) => {
    onChangeProfile((prev) => {
      const current = prev.defaultPreset.favoriteActivities
      const exists = current.includes(tag)
      let nextFavorites: string[]

      if (exists) {
        nextFavorites = current.filter((item) => item !== tag)
      } else {
        // Pidätetään enintään 5 mieliaktiviteettia
        if (current.length >= 5) {
          onLogSelection('PRESET_MAX_5', 'max 5 favorite activities')
          return prev
        }
        nextFavorites = [...current, tag]
      }

      const mergedInterests = Array.from(new Set([...nextFavorites, ...prev.interests]))

      return {
        ...prev,
        interests: mergedInterests,
        defaultPreset: {
          ...prev.defaultPreset,
          favoriteActivities: nextFavorites,
        },
      }
    })
    onLogSelection('PRESET_ACTIVITY_TOGGLE', tag)
  }

  const applyInferredChildrenAges = () => {
    const ages = inferAgeGroupsFromChildren(profile.children)
    if (ages.length === 0) return
    onChangeProfile((prev) => ({
      ...prev,
      defaultPreset: {
        ...prev.defaultPreset,
        useChildrenAgeInference: true,
      },
      filters: {
        ...prev.filters,
        targetAgeGroups: ages,
      },
    }))
    onLogSelection('INFER_CHILD_AGES', ages.join(','))
  }

  const toggleAgeGroup = (group: string) => {
    onChangeProfile((prev) => {
      const exists = prev.filters.targetAgeGroups.includes(group)
      const nextAges = exists
        ? prev.filters.targetAgeGroups.filter((g) => g !== group)
        : [...prev.filters.targetAgeGroups, group]
      return {
        ...prev,
        filters: {
          ...prev.filters,
          targetAgeGroups: nextAges,
        },
      }
    })
  }

  const completeOnboarding = () => {
    const ages =
      profile.defaultPreset.useChildrenAgeInference && profile.children.length > 0
        ? inferAgeGroupsFromChildren(profile.children)
        : profile.filters.targetAgeGroups

    const activities =
      profile.defaultPreset.favoriteActivities.length > 0
        ? profile.defaultPreset.favoriteActivities
        : DEFAULT_ACTIVITY_TAGS.slice(0, 4)

    onChangeProfile((prev) => ({
      ...prev,
      onboardingCompleted: true,
      interests: Array.from(new Set([...activities, ...prev.interests])),
      defaultPreset: {
        ...prev.defaultPreset,
        enabled: true,
        favoriteActivities: activities,
      },
      filters: {
        ...prev.filters,
        maxDistanceKm: prev.filters.maxDistanceKm || 15,
        targetAgeGroups: ages.length > 0 ? ages : prev.filters.targetAgeGroups,
      },
    }))
    onLogSelection('ONBOARDING_COMPLETE', `${activities.length} activities, ${profile.filters.maxDistanceKm || 15}km`)
    onSaveProfile()
  }

  return (
    <div className="min-w-0 p-4 md:p-6 space-y-4 pb-8">
      {/* Onboarding-kortti perheen oletusrajauksille */}
      <section className="bg-[var(--color-surface)] rounded-3xl p-4 border border-[var(--color-border)] shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className={`inline-block px-2.5 py-0.5 rounded-full text-white text-[10px] font-bold ${
              profile.onboardingCompleted ? 'bg-[#2F5D50]' : 'bg-[var(--color-accent)]'
            }`}>
              {profile.onboardingCompleted ? '✓ Perheen oletusrajaukset tallennettu' : '🚀 Perheen oletusrajaukset (Onboarding)'}
            </span>
            <h2 className="break-words text-sm md:text-base font-extrabold text-slate-900 mt-1">
              Rajaa tapahtumatulva perheenne näköiseksi
            </h2>
            <p className="text-xs text-slate-600">
              Oletusetäisyys on <strong>15 km</strong>, ikäryhmät voidaan päätellä lasten iästä ja{' '}
              <strong>3–5 mieliaktiviteettia</strong> ohjaavat sekä tapahtumia että perheosumia.
            </p>
          </div>
          {profile.onboardingCompleted && (
            <button
              type="button"
              onClick={() =>
                onChangeProfile((prev) => ({ ...prev, onboardingCompleted: false }))
              }
              className="min-h-11 px-2.5 py-1 rounded-lg bg-white border border-[var(--color-border)] text-[var(--color-ink)] text-[11px] font-bold shrink-0"
            >
              Avaa velho
            </button>
          )}
        </div>

        {!profile.onboardingCompleted && (
          <div className="space-y-3 pt-1 border-t border-[var(--color-border)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
              <div className="bg-[var(--color-bg)] rounded-3xl p-2.5 border border-[var(--color-border)]">
                <span className="font-bold text-slate-800 block">1. Kotiseutu & säde (15 km)</span>
                <span className="text-slate-600">
                  {profile.area} • max {profile.filters.maxDistanceKm} km
                </span>
              </div>
              <div className="bg-[var(--color-bg)] rounded-3xl p-2.5 border border-[var(--color-border)]">
                <span className="font-bold text-slate-800 block">2. Lasten ikäryhmäpäättely</span>
                <span className="text-slate-600">
                  {profile.children.length > 0
                    ? `Lapset (${profile.children.map((c) => c.ageLabel).join(', ')}) → ${inferredAges.join(', ')}`
                    : 'Lisää lapset perheenjäsenissä'}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">
                  3. Valitse 3–5 mieliaktiviteettia ({profile.defaultPreset.favoriteActivities.length}/5)
                </span>
                <span className="text-[11px] text-[#2F5D50] font-semibold">
                  10 oletustägiä
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_ACTIVITY_TAGS.map((tag) => {
                  const selected = profile.defaultPreset.favoriteActivities.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleFavoriteActivity(tag)}
                      className={`min-h-11 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                        selected
                          ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                          : 'bg-white text-[var(--color-ink)] border-[var(--color-border)] hover:bg-[var(--color-bg)]'
                      }`}
                    >
                      {selected ? `✓ ${tag}` : `+ ${tag}`}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-slate-600">
                Valinnat tallentuvat perheprofiiliin ja ohjaavat oletusnäkymää.
              </span>
              <button
                type="button"
                onClick={completeOnboarding}
                className="min-h-11 px-4 py-2 rounded-xl bg-[var(--color-accent)] hover:brightness-95 text-white text-xs font-extrabold shadow-xs"
              >
                Tallenna oletukset & jatka ✓
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="grid min-w-0 grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          <section className="bg-white rounded-3xl p-4 border border-[var(--color-border)] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Perheprofiili & kotiseutu
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-[var(--color-accent-soft)] text-[var(--color-ink)] text-[10px] font-bold truncate max-w-[160px]">
                {currentUser.email}
              </span>
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1">Perheen nimi</label>
              <input
                value={profile.familyName}
                onChange={(e) => onChangeProfile({ ...profile, familyName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-medium"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1">
                Oma kotiseutu (kartan 🟠 kotimerkki & etäisyyskeskus)
              </label>
              <select
                value={profile.area}
                onChange={(e) => handleAreaChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
              >
                {Object.keys(AREA_COORDS).map((areaName) => (
                  <option key={areaName} value={areaName}>
                    {areaName}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3 rounded-3xl bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-between gap-3">
              <div className="text-xs space-y-0.5">
                <p className="font-bold text-slate-900">
                  👨‍👩‍👧‍👦 Vanhemmat ({totalParentsCount}) • 👶 Lapset ({profile.children.length}) • 🫂 Läheiset ({profile.closeRelatives.length})
                </p>
                <p className="text-[11px] text-slate-500">
                  {profile.children.length > 0
                    ? `Lapset: ${profile.children.map((c) => `${c.ageLabel} (${c.group})`).join(', ')}`
                    : 'Ei vielä lisättyjä lapsia'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onLogSelection('OPEN_MEMBERS_VIEW', `${profile.children.length} children`)
                  onOpenMembers()
                }}
                className="min-h-11 px-3 py-2 rounded-xl bg-[var(--color-accent)] text-white text-xs font-bold shrink-0 hover:brightness-95"
              >
                Muokkaa →
              </button>
            </div>
          </section>

          <section className="bg-white rounded-3xl p-4 border border-[var(--color-border)] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Oletusrajaukset & suodattimet
              </h2>
              <button
                type="button"
                onClick={applyInferredChildrenAges}
                className="min-h-11 px-2.5 py-1 rounded-lg bg-[var(--color-accent-soft)] border border-[#2F5D50] text-[var(--color-ink)] text-[10px] font-bold hover:brightness-95"
              >
                ↻ Päättele lasten iästä
              </button>
            </div>

            <label className="flex items-center justify-between p-2.5 rounded-2xl bg-[var(--color-accent-soft)] border border-[#2F5D50] text-xs text-[var(--color-ink)] cursor-pointer">
              <span className="font-semibold">Käytä oletusrajausta tapahtumalistoissa</span>
              <input
                type="checkbox"
                checked={profile.defaultPreset.enabled}
                onChange={(e) =>
                  onChangeProfile((prev) => ({
                    ...prev,
                    defaultPreset: { ...prev.defaultPreset, enabled: e.target.checked },
                  }))
                }
                className="accent-[var(--color-accent)] w-4 h-4"
              />
            </label>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600">Max etäisyys kotoa (oletus 15 km)</span>
                <span className="font-bold text-[#2F5D50]">{profile.filters.maxDistanceKm} km</span>
              </div>
              <input
                type="range"
                min={2}
                max={30}
                value={profile.filters.maxDistanceKm}
                onChange={(e) =>
                  onChangeProfile((prev) => ({
                    ...prev,
                    filters: { ...prev.filters, maxDistanceKm: Number(e.target.value) },
                  }))
                }
                className="w-full accent-[var(--color-accent)]"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1">Kaupunki</label>
              <select
                value={profile.filters.targetCity}
                onChange={(e) =>
                  onChangeProfile((prev) => ({
                    ...prev,
                    filters: { ...prev.filters, targetCity: e.target.value },
                  }))
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
              >
                <option value="Kaikki PKS">Kaikki PKS</option>
                <option value="Espoo">Espoo</option>
                <option value="Helsinki">Helsinki</option>
                <option value="Vantaa">Vantaa</option>
                <option value="Kauniainen">Kauniainen</option>
              </select>
            </div>

            <div>
              <span className="text-xs text-slate-500 block mb-1.5">
                Kohdeikäryhmät ({inferredAges.length > 0 ? `lapsista: ${inferredAges.join(', ')}` : 'valitse'})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {AGE_GROUP_OPTIONS.map((g) => {
                  const active = profile.filters.targetAgeGroups.includes(g)
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleAgeGroup(g)}
                      className={`min-h-11 px-3 py-1.5 rounded-full text-xs font-bold border ${
                        active
                          ? 'bg-[var(--color-accent-soft)] text-[var(--color-ink)] border-[#2F5D50]'
                          : 'bg-[var(--color-bg)] text-[var(--color-ink-muted)] border-[var(--color-border)]'
                      }`}
                    >
                      {g}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 text-xs">
              <label className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <span>Vain maksuttomat</span>
                <input
                  type="checkbox"
                  checked={profile.defaultPreset.onlyFreeEvents}
                  onChange={(e) =>
                    onChangeProfile((prev) => ({
                      ...prev,
                      defaultPreset: { ...prev.defaultPreset, onlyFreeEvents: e.target.checked },
                    }))
                  }
                  className="accent-[var(--color-accent)] w-4 h-4"
                />
              </label>
              <label className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <span>Illat & viikonloput</span>
                <input
                  type="checkbox"
                  checked={profile.defaultPreset.weekendOrEveningFocus}
                  onChange={(e) =>
                    onChangeProfile((prev) => ({
                      ...prev,
                      defaultPreset: {
                        ...prev.defaultPreset,
                        weekendOrEveningFocus: e.target.checked,
                      },
                    }))
                  }
                  className="accent-[var(--color-accent)] w-4 h-4"
                />
              </label>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="bg-white rounded-3xl p-4 border border-[var(--color-border)] space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                10 oletustägiä & mieliaktiviteetit
              </h2>
              <span className="text-[11px] font-bold text-[#2F5D50]">
                {profile.defaultPreset.favoriteActivities.length}/5 valittu
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Valitse enintään 5 mieliaktiviteettia, joilla tapahtumia ja perheosumia painotetaan oletuksena.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_ACTIVITY_TAGS.map((tag) => {
                const selected = profile.defaultPreset.favoriteActivities.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleFavoriteActivity(tag)}
                    className={`min-h-11 px-3 py-1.5 rounded-full text-xs font-semibold ${
                      selected
                        ? 'bg-[var(--color-accent-soft)] text-[var(--color-ink)] border border-[#2F5D50]'
                        : 'bg-[var(--color-bg)] text-[var(--color-ink-muted)] border border-[var(--color-border)] hover:brightness-95'
                    }`}
                  >
                    {selected ? `✓ ${tag}` : `+ ${tag}`}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="bg-white rounded-3xl p-4 border border-[var(--color-border)] space-y-2.5 text-xs">
            <h2 className="font-bold text-slate-800 uppercase tracking-wide">
              Tietosuoja & näkyvyys
            </h2>
            <label className="flex items-center justify-between py-1">
              <span>Näy muiden perheiden haussa</span>
              <input
                type="checkbox"
                checked={profile.privacy.discoverable}
                onChange={(e) =>
                  onChangeProfile({
                    ...profile,
                    privacy: { ...profile.privacy, discoverable: e.target.checked },
                  })
                }
                className="accent-[var(--color-accent)] w-4 h-4"
              />
            </label>
            <label className="flex items-center justify-between py-1">
              <span>Jaa omat tapahtumamerkinnät osumille</span>
              <input
                type="checkbox"
                checked={profile.privacy.shareEventsWithMatches}
                onChange={(e) =>
                  onChangeProfile({
                    ...profile,
                    privacy: { ...profile.privacy, shareEventsWithMatches: e.target.checked },
                  })
                }
                className="accent-[var(--color-accent)] w-4 h-4"
              />
            </label>
            <label className="flex items-center justify-between py-1">
              <span>Näytä läheiset perheosumat-näkymässä</span>
              <input
                type="checkbox"
                checked={profile.privacy.showCloseRelativesInMatches}
                onChange={(e) =>
                  onChangeProfile({
                    ...profile,
                    privacy: {
                      ...profile.privacy,
                      showCloseRelativesInMatches: e.target.checked,
                    },
                  })
                }
                className="accent-[var(--color-accent)] w-4 h-4"
              />
            </label>
          </section>

          <section className="bg-[var(--color-bg)] rounded-3xl p-4 border border-[var(--color-border)] space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Tallennus & sessio
              </h2>
              <span className="text-[10px] font-semibold text-white bg-[#2F5D50] px-2 py-0.5 rounded-full">
                Oma profiili tallessa
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Perheprofiili ja oletusfiltterit tallentuvat automaattisesti{' '}
              <code className="text-[10px]">family-{currentUser.id}</code>-tietueeseen.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onSaveProfile}
                className="min-h-11 w-full py-2.5 rounded-xl bg-[var(--color-accent)] hover:brightness-95 text-white text-xs font-bold transition-colors"
              >
                {profileSavedToast ? '✓ Tallennettu kantaan!' : 'Tallenna profiili nyt'}
              </button>
              <button
                type="button"
                onClick={onResetTransientData}
                className="min-h-11 w-full py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)] text-[var(--color-ink)] text-xs font-bold transition-colors"
              >
                {transientResetToast ? '✓ Selaussessio nollattu!' : 'Nollaa selaussessio'}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onLogSelection('OPEN_STORE_INSPECTOR', `entries=${dbFeedCount}`)
                  onOpenStoreInspector()
                }}
                className="min-h-11 w-full py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-ink)] hover:opacity-90 text-white text-xs font-mono font-bold transition-colors"
              >
                Avaa kanta- ja feedinäkymä ({dbFeedCount}) →
              </button>
              <button
                type="button"
                disabled={authRedirecting}
                onClick={onSignOut}
                className="min-h-11 w-full py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)] text-[var(--color-ink)] text-xs font-bold transition-colors disabled:opacity-50"
              >
                Kirjaudu ulos Google-tililtä
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Suodatetut perheet: {filteredDeckCount} • Kotiseutu: {profile.area}
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}