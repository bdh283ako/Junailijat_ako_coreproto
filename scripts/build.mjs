import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadDotenv } from 'dotenv'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const localEnvPath = path.join(root, '.env.local')

if (existsSync(localEnvPath)) {
  loadDotenv({ path: localEnvPath })
}

process.env.NODE_ENV = 'production'
process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, '--no-deprecation'].filter(Boolean).join(' ')

function runPayloadCommand(command) {
  const pnpmScript = process.env.npm_execpath
  const executable = pnpmScript
    ? process.execPath
    : process.platform === 'win32'
      ? 'pnpm.cmd'
      : 'pnpm'
  const args = pnpmScript ? [pnpmScript, 'exec', 'payload', command] : ['exec', 'payload', command]
  const result = spawnSync(executable, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    shell: !pnpmScript && process.platform === 'win32',
  })

  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

runPayloadCommand('build')
