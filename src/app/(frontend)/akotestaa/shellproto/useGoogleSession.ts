'use client'

import { useCallback, useEffect, useState } from 'react'
import { emailToUserId } from './protoData'
import type { AuthenticatedGoogleUser } from './protoData'

export type GoogleAuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export interface UseGoogleSessionOptions {
  onLogSelection: (action: string, detail: string) => void
}

export interface GoogleSessionState {
  authStatus: GoogleAuthStatus
  currentUser: AuthenticatedGoogleUser | null
  authRedirecting: boolean
  authErrorMessage: string | null
  startGoogleSignIn: () => Promise<void>
  signOutGoogleSession: () => Promise<void>
}

type GoogleSessionPayload = {
  user?: { name?: string | null; email?: string | null; image?: string | null }
}

export function useGoogleSession({
  onLogSelection,
}: UseGoogleSessionOptions): GoogleSessionState {
  const [authStatus, setAuthStatus] = useState<GoogleAuthStatus>('loading')
  const [currentUser, setCurrentUser] = useState<AuthenticatedGoogleUser | null>(null)
  const [authRedirecting, setAuthRedirecting] = useState(false)
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const errParam = params.get('error')
    if (errParam) {
      setAuthErrorMessage(
        `Google-kirjautuminen keskeytyi (${errParam}). Tarkista OAuth-asetukset tai yritä uudelleen.`,
      )
    }

    let cancelled = false
    const checkGoogleSession = async () => {
      try {
        const res = await fetch('/api/auth/session', { cache: 'no-store' })
        if (!res.ok) {
          if (!cancelled) {
            setAuthStatus('unauthenticated')
            onLogSelection('OAUTH_SESSION', `none (HTTP ${res.status})`)
          }
          return
        }
        const session = (await res.json()) as GoogleSessionPayload | null

        if (!cancelled) {
          if (session?.user?.email) {
            const email = session.user.email
            const displayName = session.user.name || email.split('@')[0] || 'Google-käyttäjä'
            const googleUser: AuthenticatedGoogleUser = {
              id: emailToUserId(email),
              displayName,
              email,
              avatarUrl: session.user.image || undefined,
            }
            setCurrentUser(googleUser)
            setAuthStatus('authenticated')
            onLogSelection('GOOGLE_OAUTH_OK', googleUser.id)
          } else {
            setAuthStatus('unauthenticated')
            onLogSelection('OAUTH_SESSION', 'unauthenticated')
          }
        }
      } catch {
        if (!cancelled) {
          setAuthStatus('unauthenticated')
          onLogSelection('OAUTH_SESSION', 'endpoint_unreachable')
        }
      }
    }

    void checkGoogleSession()
    return () => {
      cancelled = true
    }
  }, [onLogSelection])

  const startGoogleSignIn = useCallback(async () => {
    if (typeof window === 'undefined') return
    setAuthRedirecting(true)
    setAuthErrorMessage(null)
    onLogSelection('GOOGLE_SIGNIN_START', '/api/auth/signin/google')
    const callbackUrl = `${window.location.origin}${window.location.pathname}`

    try {
      const csrfRes = await fetch('/api/auth/csrf', { cache: 'no-store' })
      if (csrfRes.ok) {
        const csrfData = (await csrfRes.json()) as { csrfToken?: string }
        if (csrfData?.csrfToken) {
          const form = document.createElement('form')
          form.method = 'POST'
          form.action = '/api/auth/signin/google'
          const csrfInput = document.createElement('input')
          csrfInput.type = 'hidden'
          csrfInput.name = 'csrfToken'
          csrfInput.value = csrfData.csrfToken
          form.appendChild(csrfInput)
          const cbInput = document.createElement('input')
          cbInput.type = 'hidden'
          cbInput.name = 'callbackUrl'
          cbInput.value = callbackUrl
          form.appendChild(cbInput)
          document.body.appendChild(form)
          form.submit()
          return
        }
      }
    } catch {
      // Fallback
    }
    window.location.href = `/api/auth/signin/google?callbackUrl=${encodeURIComponent(callbackUrl)}`
  }, [onLogSelection])

  const signOutGoogleSession = useCallback(async () => {
    if (typeof window === 'undefined') return
    setAuthRedirecting(true)
    onLogSelection('GOOGLE_SIGNOUT', currentUser?.id || 'session')
    const callbackUrl = `${window.location.origin}${window.location.pathname}`

    try {
      const csrfRes = await fetch('/api/auth/csrf', { cache: 'no-store' })
      if (csrfRes.ok) {
        const csrfData = (await csrfRes.json()) as { csrfToken?: string }
        if (csrfData?.csrfToken) {
          const form = document.createElement('form')
          form.method = 'POST'
          form.action = '/api/auth/signout'
          const csrfInput = document.createElement('input')
          csrfInput.type = 'hidden'
          csrfInput.name = 'csrfToken'
          csrfInput.value = csrfData.csrfToken
          form.appendChild(csrfInput)
          const cbInput = document.createElement('input')
          cbInput.type = 'hidden'
          cbInput.name = 'callbackUrl'
          cbInput.value = callbackUrl
          form.appendChild(cbInput)
          document.body.appendChild(form)
          form.submit()
          return
        }
      }
    } catch {
      // Fallback
    }
    window.location.href = `/api/auth/signout?callbackUrl=${encodeURIComponent(callbackUrl)}`
  }, [currentUser, onLogSelection])

  return {
    authStatus,
    currentUser,
    authRedirecting,
    authErrorMessage,
    startGoogleSignIn,
    signOutGoogleSession,
  }
}
