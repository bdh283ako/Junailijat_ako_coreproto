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
    <div className="p-4 sm:p-6 space-y-4 pb-8">
      {/* Onboarding-kortti perheen oletusrajauksille */}
      <section className="bg-gradient-to-br from-emerald-50 via-white to-teal-50 rounded-2xl p-4 border-2 border-emerald-200 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
              {profile.onboardingCompleted ? '✓ Perheen oletusrajaukset tallennettu' : '🚀 Perheen oletusrajaukset (Onboarding)'}
            </span>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 mt-1">
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
              className="px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-900 text-[11px] font-bold shrink-0"
            >
              Avaa velho
            </button>
          )}
        </div>

        {!profile.onboardingCompleted && (
          <div className="space-y-3 pt-1 border-t border-emerald-200/70">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="bg-white/90 rounded-xl p-2.5 border border-emerald-100">
                <span className="font-bold text-slate-800 block">1. Kotiseutu & säde (15 km)</span>
                <span className="text-slate-600">
                  {profile.area} • max {profile.filters.maxDistanceKm} km
                </span>
              </div>
              <div className="bg-white/90 rounded-xl p-2.5 border border-emerald-100">
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
                <span className="text-[11px] text-emerald-700 font-semibold">
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
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                        selected
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-emerald-50'
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
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs"
              >
                Tallenna oletukset & jatka ✓
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          <section className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Perheprofiili & kotiseutu
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-bold truncate max-w-[160px]">
                {currentUser.email}
              </span>
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1">Perheen nimi</label>
              <input
                value={profile.familyName}
                onChange={(e) => setProfile({ ...profile, familyName: e.target.value })}
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

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
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
                className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold shrink-0 hover:bg-slate-800"
              >
                Muokkaa →
              </button>
            </div>
          </section>

          <section className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Oletusrajaukset & suodattimet
              </h2>
              <button
                type="button"
                onClick={applyInferredChildrenAges}
                className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold hover:bg-emerald-100"
              >
                ↻ Päättele lasten iästä
              </button>
            </div>

            <label className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-slate-800 cursor-pointer">
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
                className="accent-emerald-600 w-4 h-4"
              />
            </label>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600">Max etäisyys kotoa (oletus 15 km)</span>
                <span className="font-bold text-emerald-700">{profile.filters.maxDistanceKm} km</span>
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
                className="w-full accent-emerald-600"
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
                      className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                        active ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {g}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
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
                  className="accent-emerald-600 w-4 h-4"
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
                  className="accent-emerald-600 w-4 h-4"
                />
              </label>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="bg-white rounded-2xl p-4 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                10 oletustägiä & mieliaktiviteetit
              </h2>
              <span className="text-[11px] font-bold text-emerald-700">
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
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                      selected
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {selected ? `✓ ${tag}` : `+ ${tag}`}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="bg-white rounded-2xl p-4 border border-slate-200 space-y-2.5 text-xs">
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
                className="accent-emerald-600 w-4 h-4"
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
                className="accent-emerald-600 w-4 h-4"
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
                className="accent-emerald-600 w-4 h-4"
              />
            </label>
          </section>

          <section className="bg-slate-100 rounded-2xl p-4 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Tallennus & sessio
              </h2>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                Oma profiili tallessa
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Perheprofiili ja oletusfiltterit tallentuvat automaattisesti{' '}
              <code className="text-[10px]">family-{currentUser.id}</code>-tietueeseen.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onSaveProfile}
                className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-colors"
              >
                {profileSavedToast ? '✓ Tallennettu kantaan!' : 'Tallenna profiili nyt'}
              </button>
              <button
                type="button"
                onClick={onResetTransientData}
                className="w-full py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-colors"
              >
                {transientResetToast ? '✓ Selaussessio nollattu!' : 'Nollaa selaussessio'}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onLogSelection('OPEN_STORE_INSPECTOR', `entries=${dbFeedCount}`)
                  onOpenStoreInspector()
                }}
                className="w-full py-2 rounded-xl border border-indigo-300 bg-indigo-950 hover:bg-indigo-900 text-cyan-200 text-xs font-mono font-bold transition-colors"
              >
                Avaa kanta- ja feedinäkymä ({dbFeedCount}) →
              </button>
              <button
                type="button"
                disabled={authRedirecting}
                onClick={onSignOut}
                className="w-full py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold transition-colors disabled:opacity-50"
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