'use client'

import { useEffect, useState } from 'react'
import { startPreviewOAuthBridge } from '@/lib/preview-oauth-browser'

export function BridgeClient({ csrf }: { csrf: string }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    void startPreviewOAuthBridge(async (secret) => {
      const response = await fetch('/api/auth/preview-start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ secret, csrf }),
      })
      if (!response.ok) throw new Error('Preview sign-in unavailable')
      const body = (await response.json()) as { authorizationUrl?: unknown }
      if (typeof body.authorizationUrl !== 'string') {
        throw new Error('Preview sign-in unavailable')
      }
      return body.authorizationUrl
    }).catch(() => setFailed(true))
  }, [csrf])

  return (
    <main className="grid min-h-screen place-items-center bg-[#fffdf4] p-6 text-[#173d2c]">
      <section className="max-w-sm text-center">
        <div className="mx-auto mb-5 grid size-12 place-items-center rounded-full bg-[#d8ff45] text-lg font-bold">
          G
        </div>
        <h1 className="text-xl font-bold">
          {failed ? 'Kirjautumista ei voitu aloittaa' : 'Avataan Google…'}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#173d2c]/70">
          {failed
            ? 'Sulje tämä ikkuna ja yritä uudelleen.'
            : 'Odota hetki. Sinut siirretään turvalliseen Google-kirjautumiseen.'}
        </p>
      </section>
    </main>
  )
}
