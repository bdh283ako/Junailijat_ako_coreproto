'use client'

import { useSyncExternalStore } from 'react'
import { AuthControl } from '@/components/AuthControl'
import { GatherEvents } from '@/components/GatherEvents'
import { authSession } from '@/lib/app-session-browser'

export function GatherHome() {
  const session = useSyncExternalStore(
    authSession.subscribe,
    authSession.getSnapshot,
    authSession.getServerSnapshot,
  )

  if (session.status === 'signed-in') {
    return <GatherEvents />
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--paper)] px-6 py-16 text-[var(--ink)]">
      <section className="w-full max-w-3xl text-center">
        <a className="brand inline-block" href="/" aria-label="Gather etusivu">
          gather<span>.</span>
        </a>
        <p className="eyebrow mt-16 mb-5 text-[#557263]">Yhdessä on mukavampaa.</p>
        <h1 className="text-[clamp(3rem,9vw,6.5rem)] leading-[0.93] font-bold tracking-[-0.065em]">
          Löydä tekemistä
          <br />
          ja hyvää seuraa.
        </h1>
        <p className="mx-auto mt-8 max-w-xl text-base leading-7 text-[var(--muted)] sm:text-lg">
          Kirjaudu sisään nähdäksesi ajankohtaiset tapahtumat ja löytääksesi juuri sinulle sopivaa
          tekemistä.
        </p>
        <div className="mt-9 flex justify-center">
          {session.status === 'loading' ? (
            <div
              className="h-11 w-44 animate-pulse rounded-full bg-[var(--forest)]/10"
              aria-label="Tarkistetaan kirjautumista"
            />
          ) : (
            <AuthControl embedded />
          )}
        </div>
      </section>
    </main>
  )
}
