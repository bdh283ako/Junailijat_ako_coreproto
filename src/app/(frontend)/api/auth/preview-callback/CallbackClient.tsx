'use client'

import { useEffect, useState } from 'react'
import { completePreviewOAuthCallback } from '@/lib/preview-oauth-browser'

export function CallbackClient() {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    void completePreviewOAuthCallback(async (callback) => {
      const response = await fetch('/api/auth/preview-complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ callback }),
      })
      if (!response.ok) throw new Error('Preview sign-in failed')
    })
      .then(() => window.close())
      .catch(() => setFailed(true))
  }, [])

  return (
    <main className="grid min-h-screen place-items-center bg-[#fffdf4] p-6 text-center text-[#173d2c]">
      <section>
        <h1 className="text-xl font-bold">
          {failed ? 'Kirjautuminen epäonnistui' : 'Kirjautuminen valmis'}
        </h1>
        <p className="mt-2 text-sm text-[#173d2c]/70">
          {failed ? 'Sulje tämä ikkuna ja yritä uudelleen.' : 'Voit nyt sulkea tämän ikkunan.'}
        </p>
      </section>
    </main>
  )
}
