'use client'

import { signOut } from 'next-auth/react'

export default function GlobalError({ reset }: { reset: () => void }) {
  async function recover() {
    await signOut({ redirect: false })
    reset()
  }

  return (
    <html lang="fi">
      <body className="grid min-h-screen place-items-center bg-[#fffdf4] p-6 text-[#173d2c]">
        <main className="max-w-md text-center">
          <h1 className="text-2xl font-bold">Jokin meni pieleen</h1>
          <p className="mt-3 text-[#173d2c]/70">
            Kirjaudu ulos ja yritä sivun lataamista uudelleen.
          </p>
          <button
            type="button"
            onClick={recover}
            className="mt-6 rounded-full bg-[#d8ff45] px-5 py-3 font-bold text-[#173d2c]"
          >
            Kirjaudu ulos ja yritä uudelleen
          </button>
        </main>
      </body>
    </html>
  )
}
