'use client'

import React, { useState } from 'react'
import {
  AGE_GROUP_OPTIONS,
  AuthenticatedGoogleUser,
  AVAILABLE_TAGS,
  PKS_HOME_AREAS,
  resolveHomeCoords,
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
  const [customTag, setCustomTag] = useState('')

  const toggleInterest = (tag: string) => {
    onChangeProfile((prev) => ({
      ...prev,
      interests: prev.interests.includes(tag)
        ? prev.interests.filter((t) => t !== tag)
        : [...prev.interests, tag],
    }))
    onLogSelection('TAG_TOGGLE', `#${tag}`)
  }

  const addCustomTag = () => {
    const clean = customTag.trim().replace(/^#/, '')
    if (!clean) return
    onChangeProfile((prev) => ({
      ...prev,
      interests: prev.interests.includes(clean) ? prev.interests : [...prev.interests, clean],
    }))
    onLogSelection('TAG_ADD', `#${clean}`)
    setCustomTag('')
  }

  const toggleFilterAgeGroup = (group: string) => {
    onChangeProfile((prev) => {
      const exists = prev.filters.targetAgeGroups.includes(group)
      return {
        ...prev,
        filters: {
          ...prev.filters,
          targetAgeGroups: exists
            ? prev.filters.targetAgeGroups.filter((g) => g !== group)
            : [...prev.filters.targetAgeGroups, group],
        },
      }
    })
    onLogSelection('AGE_FILTER', group)
  }

  const cityAreas = PKS_HOME_AREAS.filter((a) => a.city === profile.homeCity)

  return (
    <div className="p-4 sm:p-6 space-y-4 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-2xl px-4 py-2.5 border border-slate-200">
        <div className="text-xs min-w-0">
          <span className="font-bold text-slate-900">
            Google-tili: {currentUser.displayName}
          </span>
          <span className="ml-2 text-slate-500 font-mono text-[11px]">
            (_id: family-{currentUser.id})
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenStoreInspector}
            className="px-3 py-1.5 rounded-xl bg-indigo-950 hover:bg-indigo-900 text-cyan-300 font-mono text-[11px] font-bold transition-colors"
          >
            Kanta & feedi ({dbFeedCount}) →
          </button>
          <button
            type="button"
            disabled={authRedirecting}
            onClick={onSignOut}
            className="px-2.5 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100"
          >
            Kirjaudu ulos
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
        {/* 1. PERHEEN PERUSTIEDOT & OMA KOTISEUTU */}
        <section className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              1. Perhe & oma kotiseutu
            </h2>
            <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800 text-[10px] font-bold">
              🟠 Koti kartalla
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Perheen näyttönimi
            </label>
            <input
              value={profile.familyName}
              onChange={(e) => onChangeProfile({ ...profile, familyName: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
            />
          </div>

          <div className="p-3 rounded-xl bg-orange-50/70 border border-orange-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-orange-950">
                🏠 Oma kotiseutu (etäisyyslaskenta & kartta)
              </span>
              <span className="font-mono text-[10px] text-orange-800">
                {profile.homeCoords[0].toFixed(3)}, {profile.homeCoords[1].toFixed(3)}
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Kotikaupunki
              </label>
              <select
                value={profile.homeCity}
                onChange={(e) => {
                  const nextCity = e.target.value
                  const firstMatch = PKS_HOME_AREAS.find((a) => a.city === nextCity)
                  onChangeProfile((prev) => ({
                    ...prev,
                    homeCity: nextCity,
                    area: firstMatch ? firstMatch.label : prev.area,
                    homeCoords: firstMatch
                      ? firstMatch.coords
                      : resolveHomeCoords(nextCity, prev.area),
                  }))
                  onLogSelection('HOME_CITY', nextCity)
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-medium"
              >
                <option value="Espoo">Espoo</option>
                <option value="Helsinki">Helsinki</option>
                <option value="Kauniainen">Kauniainen</option>
                <option value="Vantaa">Vantaa</option>
              </select>
            </div>

            {cityAreas.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {cityAreas.map((preset) => {
                  const active = profile.area === preset.label
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        onChangeProfile((prev) => ({
                          ...prev,
                          homeCity: preset.city,
                          area: preset.label,
                          homeCoords: preset.coords,
                        }))
                        onLogSelection('HOME_PRESET', preset.label)
                      }}
                      className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                        active
                          ? 'bg-orange-500 border-orange-600 text-white'
                          : 'bg-white border-orange-200 text-slate-700 hover:bg-orange-100/60'
                      }`}
                    >
                      {preset.label}
                    </button>
                  )
                })}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Kaupunginosa / asuinalue
              </label>
              <input
                value={profile.area}
                onChange={(e) => {
                  const val = e.target.value
                  onChangeProfile((prev) => ({
                    ...prev,
                    area: val,
                    homeCoords: resolveHomeCoords(prev.homeCity, val),
                  }))
                }}
                placeholder="Esim. Koivuhovi / Kauniainen"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Lyhyt esittely muille perheille
            </label>
            <textarea
              rows={2}
              value={profile.bio}
              onChange={(e) => onChangeProfile({ ...profile, bio: e.target.value })}
              placeholder="Kerro lyhyesti perheestänne ja millaista seuraa etsitte..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-800">Perheen jäsenet</p>
              <p className="text-[11px] text-slate-500">
                {totalParentsCount} vanhempaa • {profile.children.length} lasta •{' '}
                {profile.closeRelatives.length} läheistä
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenMembers}
              className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold shrink-0 hover:bg-slate-800"
            >
              Jäsenet →
            </button>
          </div>
        </section>

        {/* 2. KIINNOSTUKSEN KOHTEET */}
        <section className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
            2. Kiinnostuksen kohteet (Tägit)
          </h2>
          <p className="text-[11px] text-slate-500">
            Yhteiset tägit korostuvat automaattisesti muiden perheiden korteissa.
          </p>

          <div className="flex flex-wrap gap-1.5">
            {Array.from(new Set([...AVAILABLE_TAGS, ...profile.interests])).map((tag) => {
              const selected = profile.interests.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleInterest(tag)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                    selected
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  #{tag}
                </button>
              )
            })}
          </div>

          <div className="flex gap-1.5 pt-1">
            <input
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomTag()}
              placeholder="Oma tägi (esim. Retkeily)..."
              className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 text-xs"
            />
            <button
              type="button"
              onClick={addCustomTag}
              className="px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-bold"
            >
              Lisää
            </button>
          </div>
        </section>

        {/* 3. HAKUFILTTERIT */}
        <section className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              3. Hakufiltterit (Perheet-pakka)
            </h2>
            <span className="text-xs font-bold text-emerald-700">{filteredDeckCount} sopivaa</span>
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
              <span>Enimmäisetäisyys kotoa</span>
              <span>{profile.filters.maxDistanceKm} km</span>
            </div>
            <input
              type="range"
              min={2}
              max={30}
              value={profile.filters.maxDistanceKm}
              onChange={(e) => {
                const km = Number(e.target.value)
                onChangeProfile({
                  ...profile,
                  filters: { ...profile.filters, maxDistanceKm: km },
                })
                onLogSelection('RADIUS_FILTER', `${km}km`)
              }}
              className="w-full accent-emerald-600"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Hakualue / kaupunki
            </label>
            <select
              value={profile.filters.targetCity}
              onChange={(e) => {
                const city = e.target.value
                onChangeProfile({
                  ...profile,
                  filters: { ...profile.filters, targetCity: city },
                })
                onLogSelection('CITY_FILTER', city)
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-medium"
            >
              <option value="Kaikki PKS">Kaikki pääkaupunkiseutu</option>
              <option value="Espoo">Espoo</option>
              <option value="Helsinki">Helsinki</option>
              <option value="Kauniainen">Kauniainen</option>
              <option value="Vantaa">Vantaa</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
              Toivottu lasten ikähaarukka
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {AGE_GROUP_OPTIONS.map((group) => {
                const active = profile.filters.targetAgeGroups.includes(group)
                return (
                  <button
                    key={group}
                    type="button"
                    onClick={() => toggleFilterAgeGroup(group)}
                    className={`py-1.5 rounded-xl text-xs font-bold border ${
                      active
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-500'
                    }`}
                  >
                    {group}
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        {/* 4. TIETOSUOJA & SESSIODATAN NOLLAUS (EI KOSKE KANTAAN) */}
        <section className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
            4. Tietosuoja & demotila
          </h2>

          <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
            <span>Profiili näkyvissä lähialueen haussa</span>
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

          <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
            <span>Näytä tapahtumat osumaperheille</span>
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

          <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
            <span>Näytä läheiset mätseissä ja haussa</span>
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

          <button
            type="button"
            onClick={onSaveProfile}
            className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
          >
            {profileSavedToast
              ? `✓ 201 COMMITTED (family-${currentUser.id})`
              : 'Tallenna profiili kantaan'}
          </button>

          <button
            type="button"
            onClick={onResetTransientData}
            className="w-full py-2 rounded-xl border border-amber-300 bg-amber-50/70 text-amber-900 text-xs font-semibold hover:bg-amber-100"
          >
            {transientResetToast
              ? '✓ Selaimen swipet, osumat & viestit nollattu'
              : 'Nollaa demokierros (swipet, osumat & viestit – ei koske kantaan)'}
          </button>
        </section>
      </div>
    </div>
  )
}