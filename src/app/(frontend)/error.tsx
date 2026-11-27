'use client'

// Segmenttitason virheraja (error.tsx): sama debug-näkymä kuin global-errorissa.
// Debug näkyy devissä tai kun NEXT_PUBLIC_DEBUG_ERRORS=1 (upotetaan buildiin,
// joten sen voi kytkeä päälle myös Vercelin previewissä).
const DEBUG_ERRORS =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEBUG_ERRORS === '1'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="ui-shell mt-8 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <h1 className="text-2xl font-bold text-[var(--color-ink)]">Sivu kaatui</h1>
      <p className="mt-3 text-[var(--color-ink-muted)]">
        Yritä ladata sivu uudelleen. Jos virhe jatkuu, kirjaudu ulos ja takaisin sisään.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-full bg-[var(--color-accent)] px-5 py-3 font-bold text-[var(--color-on-accent)]"
      >
        Yritä uudelleen
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
            <strong>path:</strong> {typeof window !== 'undefined' ? window.location.pathname : ''}
          </p>
          <p className="mt-1 text-sm">
            <strong>NODE_ENV:</strong> {process.env.NODE_ENV}
          </p>
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--color-ink)] p-3 text-xs text-white">
            {error?.stack ?? '(ei stackia)'}
          </pre>
        </section>
      )}
    </main>
  )
}
