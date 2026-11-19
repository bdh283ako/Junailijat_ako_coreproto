'use client'

import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { announceSessionChange, authSession, signOutInPlace } from '@/lib/app-session-browser'
import { openPreviewOAuth, waitForPreviewOAuthSession } from '@/lib/preview-oauth-browser'

export function AuthControl({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter()
  const session = useSyncExternalStore(
    authSession.subscribe,
    authSession.getSnapshot,
    authSession.getServerSnapshot,
  )
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const pendingSignIn = useRef<AbortController | null>(null)

  useEffect(() => () => pendingSignIn.current?.abort(), [])

  async function handleSignIn() {
    setBusy(true)
    setMessage('')
    try {
      if (window.self !== window.top) {
        pendingSignIn.current?.abort()
        const controller = (pendingSignIn.current = new AbortController())
        const secret = await openPreviewOAuth()
        const outcome = await waitForPreviewOAuthSession(secret, controller.signal)
        if (outcome === 'complete') {
          await announceSessionChange(router)
        } else if (outcome === 'expired') {
          setMessage('Kirjautumispyyntö vanheni. Yritä uudelleen.')
        }
      } else {
        await signIn('google', { redirectTo: '/' })
      }
    } catch {
      setMessage('Google-kirjautuminen ei onnistunut. Salli ponnahdusikkuna ja yritä uudelleen.')
    } finally {
      setBusy(false)
    }
  }

  async function handleSignOut() {
    setBusy(true)
    setMessage('')
    try {
      await signOutInPlace(router)
    } catch {
      setMessage('Uloskirjautuminen ei onnistunut. Yritä uudelleen.')
    } finally {
      setBusy(false)
    }
  }

  const label =
    session.status === 'signed-in'
      ? session.session.user.name || session.session.user.email || 'Kirjautunut'
      : null

  return (
    <div
      className={
        embedded
          ? 'gather-auth flex max-w-full flex-col items-end gap-2'
          : 'fixed right-4 top-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2 sm:right-6 sm:top-6'
      }
    >
      {session.status === 'loading' ? (
        <div
          className="h-11 w-36 animate-pulse rounded-full bg-[#173d2c]/10"
          aria-label="Tarkistetaan kirjautumista"
        />
      ) : session.status === 'signed-in' ? (
        <div className="auth-user-chip flex items-center gap-2 rounded-full border border-[#173d2c]/15 bg-[#fffdf4]/95 p-1.5 pl-2 shadow-[0_10px_35px_rgba(23,61,44,0.12)] backdrop-blur">
          <span
            className="grid size-8 shrink-0 place-items-center rounded-full bg-[#173d2c] text-sm font-bold text-[#d8ff45]"
            aria-hidden="true"
          >
            {label?.charAt(0).toLocaleUpperCase('fi')}
          </span>
          <span className="auth-user-label max-w-36 truncate pl-1 text-sm font-semibold text-[#173d2c]">
            {label}
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={busy}
            className="auth-signout rounded-full px-3 py-2 text-sm font-semibold text-[#173d2c] transition hover:bg-[#173d2c]/8 disabled:cursor-wait disabled:opacity-60"
          >
            Kirjaudu ulos
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleSignIn}
          disabled={busy}
          className="auth-signin flex min-h-11 items-center gap-2 rounded-full bg-[#d8ff45] px-5 py-2.5 text-sm font-bold text-[#173d2c] shadow-[0_10px_30px_rgba(23,61,44,0.16)] transition hover:-translate-y-0.5 hover:bg-[#cfff20] disabled:cursor-wait disabled:opacity-60"
        >
          <span className="grid size-6 place-items-center rounded-full bg-white text-xs font-bold shadow-sm">
            G
          </span>
          {busy ? 'Avataan Google…' : 'Kirjaudu Googlella'}
        </button>
      )}
      {message && (
        <p
          role="alert"
          className="max-w-72 rounded-xl bg-[#173d2c] px-4 py-3 text-sm leading-5 text-white shadow-lg"
        >
          {message}
        </p>
      )}
    </div>
  )
}
