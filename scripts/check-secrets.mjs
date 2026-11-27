#!/usr/bin/env node
/**
 * Secret-skanneri (ei ulkoisia riippuvuuksia).
 *
 * Käyttö:
 *   node scripts/check-secrets.mjs --staged   # tarkista vain stagetut muutokset (pre-commit)
 *   node scripts/check-secrets.mjs --all      # tarkista kaikki trackatut tiedostot
 *   git log -p | node scripts/check-secrets.mjs --stdin   # tarkista koko historia
 *
 * Löydetyt osumat tulostetaan vain osittain peitettynä (ensimmäiset 4 merkkiä),
 * jotta itse secret ei päädy lokiin. Exit-koodi 1 = löytyi epäilyttävä sisältö.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')

const PATTERNS = [
  // Google OAuth client secret (GOCSPX-...)
  { re: /GOCSPX-[A-Za-z0-9_-]{20,}/g, label: 'Google OAuth client secret (GOCSPX-...)' },
  // Google API key
  { re: /AIza[0-9A-Za-z_-]{35}/g, label: 'Google API key (AIza...)' },
  // Private keys
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g, label: 'private key' },
  // Yleinen avain-arvo: SECRET/PASSWORD/TOKEN/API_KEY/CLIENT_SECRET = "pitkä arvo"
  {
    re: /(SECRET|PASSWORD|PASSWD|API_?KEY|CLIENT_?SECRET|PRIVATE_?KEY|ACCESS_?TOKEN)["']?\s*[:=]\s*["'`]?[A-Za-z0-9_./+=-]{16,}/gi,
    label: 'kovakoodattu secret/token',
  },
]

// Sallitut ei-salaiset arvot: placeholderit (.env.example) ja env-viittaukset
const ALLOW_VALUE = /replace-with|changeme|placeholder|example|dummy|xxx|your[-_]|local-only|process\.env|\$\{|\w+\.\w+/i
const ALLOW_FILE = /(^|\/)\.env\.example$/

function mask(hit) {
  return hit.length > 8 ? `${hit.slice(0, 4)}…(${hit.length} merkkiä)` : '…'
}

function scanText(text, fileLabel, findings) {
  const lines = text.split(/\r?\n/)
  lines.forEach((line, i) => {
    if (ALLOW_FILE.test(fileLabel)) return
    for (const { re, label } of PATTERNS) {
      re.lastIndex = 0
      let m
      while ((m = re.exec(line)) !== null) {
        const val = m[0]
        if (ALLOW_VALUE.test(val)) continue
        findings.push({ file: fileLabel, line: i + 1, label, hit: mask(val) })
      }
    }
  })
}

// Ratkaise git-binääri ilman shelliä (toimii sekä normaalilla Windowsilla että Git-Bash/msys-ympäristöissä)
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

const GIT = resolveGit()

function git(args, input) {
  return execFileSync(GIT, args, { cwd: ROOT, input, maxBuffer: 64 * 1024 * 1024 }).toString()
}

function main() {
  const mode = process.argv[2] ?? '--staged'
  const findings = []

  if (mode === '--stdin') {
    const data = fs.readFileSync(0, 'utf8') // stdin luetaan vain kerran
    scanText(data, '(stdin)', findings)
  } else if (mode === '--all') {
    const files = git(['ls-files']).split('\n').filter(Boolean)
    for (const f of files) {
      if (ALLOW_FILE.test(f)) continue
      let content
      try {
        content = fs.readFileSync(path.join(ROOT, f), 'utf8')
      } catch {
        continue // binääri
      }
      scanText(content, f, findings)
    }
  } else {
    // --staged: vain lisätyt/muokatut rivit
    const diff = git(['diff', '--cached', '--unified=0'])
    let file = '(unknown)'
    for (const line of diff.split('\n')) {
      const fm = line.match(/^\+\+\+ b\/(.+)$/)
      if (fm) {
        file = fm[1]
        continue
      }
      if (line.startsWith('+') && !line.startsWith('+++')) {
        if (ALLOW_FILE.test(file)) continue
        scanText(line.slice(1), `${file}:(staged)`, findings)
      }
    }
  }

  if (findings.length > 0) {
    console.error('\n⛔ ESTETTY: commit sisältää mahdollisia salaisuuksia:')
    for (const f of findings) {
      console.error(`  - ${f.file}:${f.line}  [${f.label}]  arvo: ${f.hit}`)
    }
    console.error('\nJos tämä on vahinko: älä commitoi tiedostoa. Jos secret on jo pushattu:')
    console.error('  1) kierrätä avain (Google Cloud / Vercel / GCP Secret Manager)')
    console.error('  2) poista historiasta (git filter-repo / BFG) ja puske --force')
    console.error('\nSallitut placeholderit (esim. .env.example): replace-with-…, changeme, example…')
    process.exit(1)
  }

  console.log('✅ secret-scan: ei löytynyt salaisuuksia', mode)
  process.exit(0)
}

main()
