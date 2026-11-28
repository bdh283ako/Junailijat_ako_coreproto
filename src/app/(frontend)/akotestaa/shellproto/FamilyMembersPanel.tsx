'use client'

import type {
  AuthenticatedGoogleUser,
  ChildItem,
  CloseRelativeItem,
  UserProfileState,
} from './protoData'
import { RELATIVE_ROLES } from './protoData'

export interface FamilyMembersPanelProps {
  currentUser: AuthenticatedGoogleUser
  profile: UserProfileState
  totalParentsCount: number
  inviteBanner: string | null
  inviteParentName: string
  inviteParentEmail: string
  inviteError: string
  newChildAge: string
  newChildGroup: string
  childError: string
  newRelativeRole: string
  newRelativeNote: string
  editingChildId: string | null
  editChildAge: string
  editChildGroup: string
  editingRelativeId: string | null
  editRelativeRole: string
  editRelativeNote: string
  onChangeProfile: (profile: UserProfileState) => void
  onBack: () => void
  onPreviewInvite: (id: string) => void
  onSimulateAcceptCoParent: (id: string) => void
  onResendCoParentInvite: (id: string) => void
  onRemoveCoParent: (id: string) => void
  onInviteParentNameChange: (name: string) => void
  onInviteParentEmailChange: (email: string) => void
  onSendCoParentInvite: () => void
  onEditChildAgeChange: (age: string) => void
  onEditChildGroupChange: (group: string) => void
  onCancelEditChild: () => void
  onSaveEditChild: (id: string) => void
  onStartEditChild: (child: ChildItem) => void
  onRemoveChild: (id: string) => void
  onNewChildAgeChange: (age: string) => void
  onNewChildGroupChange: (group: string) => void
  onAddChild: () => void
  onEditRelativeRoleChange: (role: string) => void
  onEditRelativeNoteChange: (note: string) => void
  onCancelEditRelative: () => void
  onSaveEditRelative: (id: string) => void
  onStartEditRelative: (relative: CloseRelativeItem) => void
  onRemoveCloseRelative: (id: string) => void
  onNewRelativeRoleChange: (role: string) => void
  onNewRelativeNoteChange: (note: string) => void
  onAddCloseRelative: () => void
}

export function FamilyMembersPanel(props: FamilyMembersPanelProps) {
  const {
    currentUser,
    profile,
    totalParentsCount,
    inviteBanner,
    inviteParentName,
    inviteParentEmail,
    inviteError,
    newChildAge,
    newChildGroup,
    childError,
    newRelativeRole,
    newRelativeNote,
    editingChildId,
    editChildAge,
    editChildGroup,
    editingRelativeId,
    editRelativeRole,
    editRelativeNote,
    onChangeProfile,
    onBack,
    onPreviewInvite,
    onSimulateAcceptCoParent,
    onResendCoParentInvite,
    onRemoveCoParent,
    onInviteParentNameChange,
    onInviteParentEmailChange,
    onSendCoParentInvite,
    onEditChildAgeChange,
    onEditChildGroupChange,
    onCancelEditChild,
    onSaveEditChild,
    onStartEditChild,
    onRemoveChild,
    onNewChildAgeChange,
    onNewChildGroupChange,
    onAddChild,
    onEditRelativeRoleChange,
    onEditRelativeNoteChange,
    onCancelEditRelative,
    onSaveEditRelative,
    onStartEditRelative,
    onRemoveCloseRelative,
    onNewRelativeRoleChange,
    onNewRelativeNoteChange,
    onAddCloseRelative,
  } = props

  return (
    <div className="min-w-0 p-4 md:p-6 space-y-4 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800 hover:bg-slate-100"
        >
          ← Takaisin profiiliin
        </button>
        <span className="text-xs font-bold text-slate-700">
          Perheen jäsenet ({profile.familyName})
        </span>
      </div>

      {inviteBanner && (
        <div className="px-3.5 py-2.5 rounded-xl bg-[#2F5D50] text-white text-xs font-bold shadow-sm">
          {inviteBanner}
        </div>
      )}

      <div className="grid min-w-0 grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <section className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Vanhemmat ({totalParentsCount})
            </h2>
            <span className="px-2 py-0.5 rounded bg-[var(--color-accent-soft)] text-[var(--color-ink)] border border-[#2F5D50]/40 text-[10px] font-bold">
              Perheen ylläpito
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#2F5D50]/[0.08] border border-[#2F5D50]/30 flex items-center justify-between gap-2 text-xs">
            <div className="min-w-0">
              <p className="font-bold text-slate-900 truncate">
                👤 {currentUser.displayName} (Ensisijainen vanhempi)
              </p>
              <p className="text-[11px] text-slate-600 truncate">{currentUser.email}</p>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-[#2F5D50] text-white text-[10px] font-bold shrink-0">
              Google-tili
            </span>
          </div>

          {profile.coParents.map((cp) => (
            <div
              key={cp.id}
              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">
                    {cp.status === 'accepted' ? '👥' : '✉️'} {cp.name}
                  </p>
                  <p className="text-[11px] text-slate-600 truncate">{cp.email}</p>
                  <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                    Koodi: {cp.inviteCode}
                  </p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                    cp.status === 'accepted'
                      ? 'bg-[#2F5D50] text-white'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {cp.status === 'accepted' ? '✓ Hyväksytty' : `Odottaa (${cp.invitedAt})`}
                </span>
              </div>

              <div className="flex flex-wrap justify-end gap-1.5 pt-1 border-t border-slate-200/70">
                <button
                  type="button"
                  onClick={() => onPreviewInvite(cp.id)}
                  className="px-2.5 py-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] text-[11px] font-bold hover:bg-[var(--color-bg)]"
                >
                  Kutsulinkki
                </button>
                {cp.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      onClick={() => onSimulateAcceptCoParent(cp.id)}
                      className="px-2.5 py-1 rounded-lg bg-[#2F5D50] text-white text-[11px] font-bold hover:brightness-95"
                    >
                      Simuloi hyväksyntä
                    </button>
                    <button
                      type="button"
                      onClick={() => onResendCoParentInvite(cp.id)}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 text-[11px] font-semibold hover:bg-slate-100"
                    >
                      Lähetä uudelleen
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveCoParent(cp.id)}
                  className="px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 text-[11px] font-bold"
                >
                  Poista
                </button>
              </div>
            </div>
          ))}

          <div className="pt-2 border-t border-slate-100 space-y-2">
            <p className="text-[11px] font-semibold text-slate-700">
              Kutsu toinen vanhempi sähköpostilla (Demo)
            </p>
            <div className="space-y-1.5">
              <input
                value={inviteParentName}
                onChange={(e) => onInviteParentNameChange(e.target.value)}
                placeholder="Nimi / rooli (esim. Puoliso)"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
              <div className="flex flex-wrap gap-1.5">
                <input
                  type="email"
                  value={inviteParentEmail}
                  onChange={(e) => onInviteParentEmailChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onSendCoParentInvite()}
                  placeholder="puoliso@esimerkki.fi"
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
                <button
                  type="button"
                  onClick={onSendCoParentInvite}
                  className="px-3.5 py-2 rounded-xl bg-[var(--color-accent)] text-white text-xs font-bold shrink-0 hover:brightness-95"
                >
                  Lähetä kutsu
                </button>
              </div>
            </div>
            {inviteError && <p className="text-[11px] text-rose-600 font-medium">{inviteError}</p>}
          </div>
        </section>

        <div className="space-y-4">
          <section className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Lapset ({profile.children.length})
              </h2>
              <span className="px-2 py-0.5 rounded bg-[var(--color-accent-soft)] text-[var(--color-ink)] border border-[var(--color-border)] text-[10px] font-bold">
                Päivittää ikärajaukset
              </span>
            </div>

            {profile.children.length === 0 ? (
              <p className="text-xs text-slate-500">
                Ei vielä lisättyjä lapsia. Lisää omat lapsesi alta.
              </p>
            ) : (
              <div className="space-y-2">
                {profile.children.map((child) => {
                  const isEditing = editingChildId === child.id
                  return (
                    <div
                      key={child.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2"
                    >
                      {isEditing ? (
                        <div className="space-y-2">
                          <div className="flex gap-1.5">
                            <input
                              value={editChildAge}
                              onChange={(e) => onEditChildAgeChange(e.target.value)}
                              className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                            />
                            <select
                              value={editChildGroup}
                              onChange={(e) => onEditChildGroupChange(e.target.value)}
                              className="px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                            >
                              {['0-3v', '4-6v', '7-12v', '13+v'].map((g) => (
                                <option key={g} value={g}>
                                  {g}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={onCancelEditChild}
                              className="px-2.5 py-1 rounded-lg border border-slate-300 text-slate-600 font-semibold"
                            >
                              Peruuta
                            </button>
                            <button
                              type="button"
                              onClick={() => onSaveEditChild(child.id)}
                              className="px-3 py-1 rounded-lg bg-[#2F5D50] text-white font-bold"
                            >
                              Tallenna
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-slate-900">👶 {child.ageLabel}</span>
                            <span className="ml-2 px-2 py-0.5 rounded-full bg-[var(--color-accent-soft)] text-[var(--color-ink)] text-[10px] font-semibold">
                              {child.group}
                            </span>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => onStartEditChild(child)}
                              className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-100"
                            >
                              Muokkaa
                            </button>
                            <button
                              type="button"
                              onClick={() => onRemoveChild(child.id)}
                              className="px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 font-bold"
                            >
                              Poista
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5 pt-1">
              <input
                value={newChildAge}
                onChange={(e) => onNewChildAgeChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onAddChild()}
                placeholder="Ikä esim. 3 v"
                className="min-w-0 flex-1 px-2.5 py-2 rounded-xl border border-slate-300 text-xs"
              />
              <select
                value={newChildGroup}
                onChange={(e) => onNewChildGroupChange(e.target.value)}
                className="min-w-0 flex-1 px-2 py-2 rounded-xl border border-slate-300 text-xs bg-white"
              >
                {['0-3v', '4-6v', '7-12v', '13+v'].map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onAddChild}
                className="min-w-[9rem] flex-1 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
              >
                + Lisää lapsi
              </button>
            </div>
            {childError && <p className="text-[11px] text-rose-600 font-medium">{childError}</p>}
          </section>

          <section className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Läheiset ({profile.closeRelatives.length})
              </h2>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  profile.privacy.showCloseRelativesInMatches
                    ? 'bg-[#2F5D50] text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {profile.privacy.showCloseRelativesInMatches
                  ? 'Näkyy mätseissä'
                  : 'Piilotettu mätseiltä'}
              </span>
            </div>

            <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 cursor-pointer">
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
                className="accent-[#9E4B16] w-4 h-4"
              />
            </label>

            {profile.closeRelatives.length === 0 ? (
              <p className="text-xs text-slate-500">Ei vielä lisättyjä läheisiä.</p>
            ) : (
              <div className="space-y-2">
                {profile.closeRelatives.map((rel) => {
                  const isEditing = editingRelativeId === rel.id
                  return (
                    <div
                      key={rel.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2"
                    >
                      {isEditing ? (
                        <div className="space-y-2">
                          <div className="flex gap-1.5">
                            <select
                              value={editRelativeRole}
                              onChange={(e) => onEditRelativeRoleChange(e.target.value)}
                              className="px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                            >
                              {RELATIVE_ROLES.map((role) => (
                                <option key={role} value={role}>
                                  {role}
                                </option>
                              ))}
                            </select>
                            <input
                              value={editRelativeNote}
                              onChange={(e) => onEditRelativeNoteChange(e.target.value)}
                              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                            />
                          </div>
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={onCancelEditRelative}
                              className="px-2.5 py-1 rounded-lg border border-slate-300 text-slate-600 font-semibold"
                            >
                              Peruuta
                            </button>
                            <button
                              type="button"
                              onClick={() => onSaveEditRelative(rel.id)}
                              className="px-3 py-1 rounded-lg bg-[#2F5D50] text-white font-bold"
                            >
                              Tallenna
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0 flex-1 break-words">
                            <span className="font-bold text-slate-900">🫂 {rel.relationLabel}</span>
                            <span className="ml-2 text-slate-600">{rel.note}</span>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => onStartEditRelative(rel)}
                              className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-100"
                            >
                              Muokkaa
                            </button>
                            <button
                              type="button"
                              onClick={() => onRemoveCloseRelative(rel.id)}
                              className="px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 font-bold"
                            >
                              Poista
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5 pt-1">
              <select
                value={newRelativeRole}
                onChange={(e) => onNewRelativeRoleChange(e.target.value)}
                className="px-2 py-2 rounded-xl border border-slate-300 text-xs bg-white"
              >
                {RELATIVE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <input
                value={newRelativeNote}
                onChange={(e) => onNewRelativeNoteChange(e.target.value)}
                placeholder="Lisätieto (esim. mummi / kummi)"
                className="flex-1 min-w-0 px-2.5 py-2 rounded-xl border border-slate-300 text-xs"
              />
              <button
                type="button"
                onClick={onAddCloseRelative}
                className="min-w-[5rem] flex-1 px-3 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold"
              >
                + Lisää
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
