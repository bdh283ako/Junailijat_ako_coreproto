import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
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

const binPath = path.join(root, 'node_modules', '.bin')
const envWithBinPath = {
  ...process.env,
  PATH: `${binPath}${path.delimiter}${process.env.PATH}`,
}

try {
  execSync('payload build', {
    cwd: root,
    env: envWithBinPath,
    stdio: 'inherit',
    shell: true,
  })
} catch (error) {
  if (error.status !== undefined) {
    process.exit(error.status)
  }
  console.error('Build error:', error)
  process.exit(1)
}
