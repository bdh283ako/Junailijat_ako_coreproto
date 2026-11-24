'use client'

import type {
  AuthenticatedGoogleUser,
  DbCommitFeedEntry,
  UserProfileState,
} from './protoData'

export function StoreInspectorPanel({
  currentUser,
  dbFeedLog,
  mongoRevision,
  mongoInstanceLabel,
  mongoUpdatedAt,
  profile,
  safeHomeCoords,
  onBack,
}: {
  currentUser: AuthenticatedGoogleUser
  dbFeedLog: DbCommitFeedEntry[]
  mongoRevision: number
  mongoInstanceLabel: string
  mongoUpdatedAt: string
  profile: UserProfileState
  safeHomeCoords: [number, number]
  onBack: () => void
}) {
  return (
    <div className="p-4 sm:p-6 space-y-4 pb-8 bg-gradient-to-b from-indigo-950 via-slate-950 to-purple-950 min-h-full text-indigo-50">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="px-3 py-1.5 rounded-xl bg-indigo-900/90 border border-indigo-600/60 text-xs font-bold text-indigo-100 hover:bg-indigo-800"
        >
          ← Takaisin profiiliin
        </button>
        <span className="px-2.5 py-1 rounded-full bg-fuchsia-500/20 border border-fuchsia-400/50 font-mono text-[10px] font-bold text-fuchsia-300 truncate">
          FILE_MONGO_INSPECTOR • family-{currentUser.id}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
        <section className="rounded-2xl p-4 bg-indigo-950/90 border border-indigo-500/50 space-y-2.5 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-mono text-[11px] font-bold uppercase tracking-wider text-cyan-300">
              📜 Kantaoperaatioiden feedi (backscroll)
            </h2>
            <span className="font-mono text-[10px] text-indigo-300">
              {dbFeedLog.length} merkintää • REV #{mongoRevision}
            </span>
          </div>

          <div className="max-h-72 sm:max-h-[460px] overflow-y-auto space-y-2 pr-1 font-mono">
            {dbFeedLog.length === 0 ? (
              <p className="text-[11px] text-indigo-300/80 py-4 text-center">
                Ei vielä kantakirjauksia tässä istunnossa.
              </p>
            ) : (
              dbFeedLog.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl bg-slate-950/95 border border-indigo-700/60 p-2.5 space-y-1 text-[10px]"
                >
                  <p className="text-emerald-300 break-all font-semibold">{entry.terminalLine}</p>
                  <p className="text-cyan-200/90">{entry.diffStamp}</p>
                  <p className="text-fuchsia-300 italic">&gt; {entry.quip}</p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl p-4 bg-purple-950/60 border border-purple-500/40 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-[11px] font-bold uppercase tracking-wider text-fuchsia-300">
              Kantaan tallentuvat tiedot (`family-{currentUser.id}`)
            </h2>
            <span className="font-mono text-[10px] text-indigo-300">
              {mongoInstanceLabel || 'default'}
            </span>
          </div>

          <pre className="mt-2 p-3 rounded-xl bg-slate-950/95 border border-indigo-800/70 text-[10px] font-mono text-cyan-200 overflow-x-auto max-h-64 sm:max-h-[420px] leading-relaxed">
            {JSON.stringify(
              {
                _id: `family-${currentUser.id}`,
                userId: currentUser.id,
                googleEmail: currentUser.email,
                updatedAt: mongoUpdatedAt || null,
                familyName: profile.familyName,
                homeCity: profile.homeCity,
                area: profile.area,
                homeCoords: safeHomeCoords,
                onboardingCompleted: profile.onboardingCompleted,
                defaultPreset: profile.defaultPreset,
                coParents: profile.coParents,
                children: profile.children,
                closeRelatives: profile.closeRelatives,
                interests: profile.interests,
                filters: profile.filters,
                privacy: profile.privacy,
              },
              null,
              2,
            )}
          </pre>
        </section>
      </div>
    </div>
  )
}
