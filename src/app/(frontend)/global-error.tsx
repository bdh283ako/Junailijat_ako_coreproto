'use client'

import { signOut } from 'next-auth/react'

// Debug-näkymä näytetään devissä tai kun NEXT_PUBLIC_DEBUG_ERRORS=1
// (NEXT_PUBLIC_* upotetaan buildiin, joten sen voi kytkeä päälle myös
// Vercelin preview-ympäristössä asettamalla muuttujan ennen buildia).
const DEBUG_ERRORS =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEBUG_ERRORS === '1'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  async function recover() {
    await signOut({ redirect: false })
    reset()
  }

  return (
    <html lang="fi">
      <body className="grid min-h-screen place-items-center bg-[var(--color-bg)] p-6 text-[var(--color-ink)]">
        <main className="w-full max-w-2xl rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
          <h1 className="text-2xl font-bold">Jokin meni pieleen</h1>
          <p className="mt-3 text-[var(--color-ink-muted)]">
            Kirjaudu ulos ja yritä sivun lataamista uudelleen.
          </p>
          <button
            type="button"
            onClick={recover}
            className="mt-6 rounded-full bg-[var(--color-accent)] px-5 py-3 font-bold text-[var(--color-on-accent)]"
          >
            Kirjaudu ulos ja yritä uudelleen
          </button>
          {DEBUG_ERRORS && (
            <section className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-4 text-left">
              <h2 className="font-bold">Debug-virhe (näkyy vain devissä / NEXT_PUBLIC_DEBUG_ERRORS=1)</h2>
              <p className="mt-2 text-sm">
                <strong>name:</strong> {error?.name}
              </p>
              <p className="mt-1 text-sm">
                <strong>message:</strong> {error?.message}
              </p>
              {error?.digest && (
                <p className="mt-1 text-sm">
                  <strong>digest:</strong> {error.digest}
                </p>
              )}
              <p className="mt-1 text-sm">
                <strong>NODE_ENV:</strong> {process.env.NODE_ENV}
              </p>
              <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--color-ink)] p-3 text-xs text-white">
                {error?.stack ?? '(ei stackia)'}
              </pre>
            </section>
          )}
        </main>
      </body>
    </html>
  )
}
