#!/usr/bin/env node
/**
 * Asettaa gitin käyttämään projektin .githooks-kansiota (core.hooksPath).
 * Ajetaan automaattisesti `pnpm install` yhteydessä ("prepare"-skripti),
 * joten pre-commit-secret-skanni on käytössä kaikilla kehittäjillä.
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const hooksPath = '.githooks'

function resolveGit() {
  const candidates = [
    process.env.GIT_BIN,
    'git',
    '/usr/bin/git',
    '/ucrt64/bin/git.exe',
    'C:/Program Files/Git/cmd/git.exe',
    'C:\\Program Files\\Git\\cmd\\git.exe',
    'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
  ].filter(Boolean)
  for (const bin of candidates) {
    try {
      execFileSync(bin, ['--version'], { stdio: 'pipe' })
      return bin
    } catch {
      // kokeile seuraavaa
    }
  }
  throw new Error('git-binääriä ei löytynyt (kokeile GIT_BIN-ympäristömuuttujaa)')
}

try {
  execFileSync(resolveGit(), ['config', 'core.hooksPath', hooksPath], { cwd: root, stdio: 'pipe' })
  console.log(`✅ git hooks: core.hooksPath=${hooksPath} (pre-commit secret-skanni käytössä)`)
} catch (err) {
  console.warn('Huom: core.hooksPath asetus epäonnistui (ei git-repo?):', err.message)
}
