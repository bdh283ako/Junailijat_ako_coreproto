/**
 * Siivoaa demo/testikäyttäjät tietokannasta (perheiden demo-data pois).
 *
 * Säilyttää: KEEP_EMAILS -listan tunnukset JA aidot (ei legacy-demo) kirjautumiset,
 * jotka on tehty viimeisen 30 min aikana (updated_at).
 * Poistaa: muut käyttäjät + heidän family_matches -rivinsä + rel/versions-viittaukset.
 *
 * Aja:
 *   pnpm tsx scripts/cleanup-demo-users.ts --db=local --dry
 *   pnpm tsx scripts/cleanup-demo-users.ts --db=local
 *   pnpm tsx scripts/cleanup-demo-users.ts --db=neon --dry   # lukee .tmp-vercel-all.txt (vercel env pull)
 *   pnpm tsx scripts/cleanup-demo-users.ts --db=neon
 */
import fs from 'node:fs'
import path from 'node:path'

const KEEP_EMAILS = new Set(['korhoan@gmail.com', 'bdh283.ako@gmail.com'])
const RECENT_LOGIN_MS = 30 * 60 * 1000

function readEnvFile(p: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!fs.existsSync(p)) return out
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[m[1]] = v
  }
  return out
}

async function main() {
  const args = process.argv.slice(2)
  const mode = args.find((a) => a.startsWith('--db='))?.split('=')[1] ?? 'local'
  const dry = args.includes('--dry')

  const localEnv = readEnvFile(path.resolve('.env.local'))
  let dbUrl: string | undefined
  if (mode === 'neon') {
    const vercelEnv = readEnvFile(path.resolve('.tmp-vercel-all.txt'))
    dbUrl = vercelEnv.DATABASE_URL_UNPOOLED || vercelEnv.DATABASE_URL || vercelEnv.POSTGRES_URL_NON_POOLING || vercelEnv.POSTGRES_URL
    if (!dbUrl || dbUrl.includes('[SENSITIVE]')) throw new Error('Neon-yhteys puuttuu: aja ensin `vercel env pull .tmp-vercel-all.txt --environment=production --yes`')
  } else {
    dbUrl = localEnv.DATABASE_URL
  }
  process.env.DATABASE_URL = dbUrl
  process.env.PAYLOAD_SECRET = process.env.PAYLOAD_SECRET || localEnv.PAYLOAD_SECRET

  const { getPayload } = await import('payload')
  const config = (await import('@payload-config')).default
  const payload = await getPayload({ config })
  const pool = (payload.db as any).pool
  const host = new URL(dbUrl.replace('postgres://', 'http://').replace('postgresql://', 'http://')).host
  console.log(`== kohde: ${mode} (host ${host.replace(/:.*@/, ':***@')}) dry=${dry}`)

  const users = await pool.query('SELECT id, email, provider_id, created_at, updated_at FROM users ORDER BY id')
  const now = Date.now()
  const keep: any[] = []
  const del: any[] = []
  for (const u of users.rows) {
    const email = (u.email ?? '').toLowerCase()
    const isLegacy = String(u.provider_id ?? '').startsWith('legacy-demo:')
    const recentReal = !isLegacy && u.updated_at && now - new Date(u.updated_at).getTime() < RECENT_LOGIN_MS
    if (KEEP_EMAILS.has(email) || recentReal) keep.push(u)
    else del.push(u)
  }
  console.log('säilytetään:', keep.map((u) => `${u.email} (${String(u.provider_id).slice(0, 12)}…, updated ${u.updated_at})`).join(' | ') || '(ei ketään)')
  console.log('poistetaan:', del.map((u) => `${u.email ?? u.id} (${String(u.provider_id).slice(0, 12)}…)`).join(' | ') || '(ei ketään)')

  const countOf = async (table: string) => {
    try {
      return (await pool.query(`SELECT count(*)::int n FROM "${table}"`)).rows[0].n
    } catch {
      return null // taulua ei ole
    }
  }
  console.log('ennen:', JSON.stringify({
    users: await countOf('users'),
    family_matches: await countOf('family_matches'),
    event_participations: await countOf('event_participations'),
    chat_messages: await countOf('chat_messages'),
  }))

  if (dry) {
    console.log('DRY-RUN: ei muutettu mitään.')
    process.exit(0)
  }

  if (del.length === 0) {
    console.log('Ei poistettavaa.')
    process.exit(0)
  }

  const delIds = del.map((u) => u.id)
  await pool.query('BEGIN')
  try {
    // 1. versions-viittaukset family_matchesiin
    await pool.query('DELETE FROM _family_matches_v WHERE version_from_family_id = ANY($1) OR version_to_family_id = ANY($1)', [delIds]).catch(() => {})
    // 2. match-rivit
    await pool.query('DELETE FROM family_matches WHERE from_family_id = ANY($1) OR to_family_id = ANY($1)', [delIds])
    // 3. kaikki FK-viittaukset users-tauluun (rel-taulut ym.)
    const fks = await pool.query(
      `SELECT tc.table_name, kcu.column_name FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_name = kcu.table_name
       JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
       WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'users'`,
    )
    for (const fk of fks.rows) {
      await pool.query(`DELETE FROM "${fk.table_name}" WHERE "${fk.column_name}" = ANY($1)`, [delIds])
    }
    // 4. users-rivit
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [delIds])
    await pool.query('COMMIT')
  } catch (e) {
    await pool.query('ROLLBACK')
    throw e
  }

  console.log('jälkeen:', JSON.stringify({
    users: await countOf('users'),
    family_matches: await countOf('family_matches'),
  }))
  console.log('VALMIS: poistettu', delIds.length, 'käyttäjää ja heidän match-rivinsä.')
  process.exit(0)
}

main().catch((e) => {
  console.error('VIRHE:', e?.message ?? e)
  process.exit(1)
})
