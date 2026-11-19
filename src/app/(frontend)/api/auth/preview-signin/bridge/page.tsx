import { cookies } from 'next/headers'
import { BridgeClient } from './BridgeClient'

export default async function PreviewSignInBridgePage() {
  const csrf = (await cookies()).get('__Host-pv_bootstrap')?.value
  if (!csrf) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fffdf4] p-6 text-center text-[#173d2c]">
        <p>Avaa kirjautuminen Gather-sovelluksesta.</p>
      </main>
    )
  }
  return <BridgeClient csrf={csrf} />
}
