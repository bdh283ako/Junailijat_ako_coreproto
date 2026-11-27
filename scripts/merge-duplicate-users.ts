/**
 * Kerta-ajo: yhdistää saman sähköpostin duplikaattikäyttäjät yhdeksi.
 *
 * - Kanoninen tili per email: mieluiten ei-legacy-demo providerId, sitten
 *   profiilin omaava, sitten pienin id.
 * - family_matches -rivit remapataan kanoniseen id:hen.
 *   - self-pair (from == to) poistetaan
 *   - konflikti (kanoninen pari jo olemassa): pidetään korkeampi status
 *     (matched > liked > passed), häviävä rivi poistetaan
 * - Duplikaattikäyttäjät poistetaan (vain jos niihin ei viitata muualla).
 *
 * Aja: pnpm dotenv -e .env.local -- tsx scripts/merge-duplicate-users.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'

const STATUS_PRIORITY: Record<string, number> = { matched: 3, liked: 2, passed: 1 }

async function main() {
  const payload = await getPayload({ config })
  const pool = (payload.db as any).pool

  const users = await pool.query('SELECT id, email, provider_id, family_profile IS NOT NULL AS has_profile FROM users ORDER BY id')
  const rows = users.rows as Array<{ id: number; email: string | null; provider_id: string | null; has_profile: boolean }>

  const byEmail = new Map<string, typeof rows>()
  for (const u of rows) {
    const key = (u.email ?? '').trim().toLowerCase()
    if (!key) continue
    const arr = byEmail.get(key) ?? []
    arr.push(u)
    byEmail.set(key, arr)
  }

  const remap = new Map<number, number>() // dup id -> canonical id
  for (const [email, group] of byEmail) {
    if (group.length < 2) continue
    const canonical = [...group].sort((a, b) => {
      const aReal = a.provider_id && !a.provider_id.startsWith('legacy-demo:') ? 1 : 0
      const bReal = b.provider_id && !b.provider_id.startsWith('legacy-demo:') ? 1 : 0
      if (aReal !== bReal) return bReal - aReal
      if (a.has_profile !== b.has_profile) return Number(b.has_profile) - Number(a.has_profile)
      return a.id - b.id
    })[0]
    for (const u of group) if (u.id !== canonical.id) remap.set(u.id, canonical.id)
    console.log(`email ${email}: canonical=${canonical.id} (${canonical.provider_id}), dups=[${group.filter((g) => g.id !== canonical.id).map((g) => g.id)}]`)
  }

  if (remap.size === 0) {
    console.log('Ei duplikaattikäyttäjiä — ei tehtävää.')
    process.exit(0)
  }

  await pool.query('BEGIN')
  try {
    const matchRows = await pool.query('SELECT id, from_family_id, to_family_id, status FROM family_matches ORDER BY id')
    for (const row of matchRows.rows as Array<{ id: number; from_family_id: number; to_family_id: number; status: string }>) {
      const from = remap.get(row.from_family_id) ?? row.from_family_id
      const to = remap.get(row.to_family_id) ?? row.to_family_id
      if (from === to) {
        await pool.query('DELETE FROM family_matches WHERE id = $1', [row.id])
        console.log(`poistettu self-pair rivi ${row.id} (${row.from_family_id}->${row.to_family_id})`)
        continue
      }
      if (from === row.from_family_id && to === row.to_family_id) continue
      const conflict = await pool.query('SELECT id, status FROM family_matches WHERE from_family_id = $1 AND to_family_id = $2 AND id <> $3', [from, to, row.id])
      if (conflict.rows.length > 0) {
        const existing = conflict.rows[0]
        const keep = (STATUS_PRIORITY[row.status] ?? 0) > (STATUS_PRIORITY[existing.status] ?? 0)
        if (keep) {
          await pool.query('UPDATE family_matches SET status = $1, updated_at = now() WHERE id = $2', [row.status, existing.id])
          await pool.query('DELETE FROM family_matches WHERE id = $1', [row.id])
          console.log(`konflikti ${from}->${to}: pidettiin ${row.status} (rivi ${row.id} poistettu, ${existing.id} päivitetty)`)
        } else {
          await pool.query('DELETE FROM family_matches WHERE id = $1', [row.id])
          console.log(`konflikti ${from}->${to}: pidettiin ${existing.status}, rivi ${row.id} poistettu`)
        }
      } else {
        await pool.query('UPDATE family_matches SET from_family_id = $1, to_family_id = $2, updated_at = now() WHERE id = $3', [from, to, row.id])
        console.log(`remap rivi ${row.id}: ${row.from_family_id}->${row.to_family_id}  =>  ${from}->${to} (${row.status})`)
      }
    }

    for (const [dupId, canonicalId] of remap) {
      // Poista ensin versions-historia, joka viittaa dup-käyttäjään
      // (muuten users-rivin poisto epäonnistuu _family_matches_v not-null -sääntöön).
      await pool
        .query('DELETE FROM _family_matches_v WHERE version_from_family_id = $1 OR version_to_family_id = $1', [dupId])
        .catch(() => {})
      // Poista sitten kaikki viittaukset duplikaattikäyttäjään rel-tauluista
      // (FK-konstraintit), sitten itse käyttäjä. family_matches on jo remapattu.
      const relCols = await pool.query(
        `SELECT tc.table_name, kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_name = kcu.table_name
         JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
         WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'users'`,
      )
      for (const rc of relCols.rows as Array<{ table_name: string; column_name: string }>) {
        await pool.query(`DELETE FROM "${rc.table_name}" WHERE "${rc.column_name}" = $1`, [dupId])
      }
      await pool.query('DELETE FROM users WHERE id = $1', [dupId])
      console.log(`poistettu duplikaattikäyttäjä ${dupId} (kanoninen ${canonicalId})`)
    }
    await pool.query('COMMIT')
    console.log('VALMIS: duplikaatit yhdistetty.')
  } catch (e) {
    await pool.query('ROLLBACK')
    console.error('VIRHE, rollback:', e)
    process.exit(1)
  }
  process.exit(0)
}

main()
