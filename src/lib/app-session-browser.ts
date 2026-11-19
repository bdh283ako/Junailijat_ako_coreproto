export type AuthJsSession = {
  user: {
    id?: string
    providerId?: string
    name?: string | null
    email?: string | null
    image?: string | null
  }
  expires: string
}

export type SessionView<S> =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; session: S }

export type SessionStore<S> = {
  subscribe(listener: () => void): () => void
  getSnapshot(): SessionView<S>
  getServerSnapshot(): SessionView<S>
  refresh(): Promise<void>
  change(task: () => Promise<void>): Promise<void>
}

const LOADING = { status: 'loading' } as const

export function createSessionStore<S>(
  load: (signal: AbortSignal) => Promise<S | null>,
): SessionStore<S> {
  let view: SessionView<S> = LOADING
  let stale = true
  let current: AbortController | null = null
  const listeners = new Set<() => void>()

  async function refresh(): Promise<void> {
    current?.abort()
    const controller = (current = new AbortController())
    let next: SessionView<S>
    let failed = false
    try {
      const session = await load(controller.signal)
      next = session ? { status: 'signed-in', session } : { status: 'signed-out' }
    } catch {
      next = { status: 'signed-out' }
      failed = true
    }
    if (controller.signal.aborted) return
    current = null
    stale = failed
    view = next
    for (const listener of listeners) listener()
  }

  async function change(task: () => Promise<void>): Promise<void> {
    current?.abort()
    current = new AbortController()
    try {
      await task()
    } finally {
      await refresh()
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      if (stale && !current) void refresh()
      return () => listeners.delete(listener)
    },
    getSnapshot: () => view,
    getServerSnapshot: () => LOADING,
    refresh,
    change,
  }
}

export async function fetchAuthJsSession(signal: AbortSignal): Promise<AuthJsSession | null> {
  const response = await fetch('/api/auth/session', {
    cache: 'no-store',
    signal,
  })
  if (!response.ok) {
    throw new Error(`Session request failed with ${response.status}`)
  }
  const body = (await response.json()) as AuthJsSession | null
  return body?.user ? body : null
}

export const authSession = createSessionStore(fetchAuthJsSession)

export async function announceSessionChange(router: { refresh(): void }): Promise<void> {
  await authSession.refresh()
  router.refresh()
}

export async function signOutInPlace(router: { refresh(): void }): Promise<void> {
  const csrf = await fetch('/api/auth/csrf', { cache: 'no-store' })
  if (!csrf.ok) throw new Error(`CSRF request failed with ${csrf.status}`)
  const { csrfToken } = (await csrf.json()) as { csrfToken?: unknown }
  if (typeof csrfToken !== 'string' || !csrfToken) {
    throw new Error('Auth.js returned no CSRF token')
  }

  await authSession.change(async () => {
    const response = await fetch('/api/auth/signout', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-auth-return-redirect': '1',
      },
      body: new URLSearchParams({ csrfToken, callbackUrl: '/' }),
    })
    const body = (await response.json().catch(() => null)) as {
      url?: unknown
    } | null
    if (!response.ok || typeof body?.url !== 'string' || body.url.includes('error=')) {
      throw new Error('Sign-out failed')
    }
  })
  router.refresh()
}
