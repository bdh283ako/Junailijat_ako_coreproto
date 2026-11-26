import path from 'path'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { buildConfig } from 'payload'
import { mcpPlugin } from '@payloadcms/plugin-mcp'
import { en as adminLanguage } from '@payloadcms/translations/languages/en'
import { fileURLToPath } from 'url'
import { Admins } from './collections/Admins'
import { Media } from './collections/Media'
import { Folders } from './collections/Folders'
import { Tags } from './collections/Tags'
import { Users } from './collections/Users'
import { FamilyMatches } from './collections/FamilyMatches'
import { EventParticipations } from './collections/EventParticipations'
import { ChatMessages } from './collections/ChatMessages'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
const payloadSecret = process.env.PAYLOAD_SECRET

if (!databaseUrl) {
  throw new Error('DATABASE_URL or POSTGRES_URL must be set to connect Payload to PostgreSQL.')
}

if (!payloadSecret) {
  throw new Error('PAYLOAD_SECRET must be set to sign Payload sessions.')
}

export default buildConfig({
  secret: payloadSecret,
  db: postgresAdapter({
    push: false,
    pool: {
      connectionString: databaseUrl,
      max: process.env.VERCEL ? 5 : 10,
      idleTimeoutMillis: 10_000,
    },
  }),
  admin: {
    user: Admins.slug,
    constrainWidth: true,
    dashboard: {
      widgets: [],
      defaultLayout: [
        { widgetSlug: 'activity', width: 'full' },
        { widgetSlug: 'collections', width: 'full' },
      ],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  i18n: {
    fallbackLanguage: 'en',
    supportedLanguages: { en: adminLanguage },
  },
  collections: [
    Admins,
    Users,
    Media,
    Folders,
    Tags,
    FamilyMatches,
    EventParticipations,
    ChatMessages,
  ],
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  localization: {
    locales: [{ code: 'en', label: 'English' }],
    fallback: true,
    defaultLocale: 'en',
  },
  plugins: [mcpPlugin({})],
})
