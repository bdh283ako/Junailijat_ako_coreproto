import fs from 'fs/promises'
import path from 'path'

export interface CoParentItem {
  id: string
  name: string
  email: string
  status: 'pending' | 'accepted'
  invitedAt: string
  inviteCode: string
}

export interface ChildItem {
  id: string
  ageLabel: string
  group: string
}

export interface CloseRelativeItem {
  id: string
  relationLabel: string
  note: string
}

export interface UserProfileState {
  familyName: string
  homeCity: string
  area: string
  homeCoords: [number, number]
  bio: string
  coParents: CoParentItem[]
  children: ChildItem[]
  closeRelatives: CloseRelativeItem[]
  interests: string[]
  filters: {
    maxDistanceKm: number
    targetAgeGroups: string[]
    targetCity: string
  }
  privacy: {
    discoverable: boolean
    shareEventsWithMatches: boolean
    showCloseRelativesInMatches: boolean
  }
}

export interface FamilyProfileDocument {
  _id: string
  userId: string
  instanceId: string
  profile: UserProfileState
  updatedAt: string
}

interface MongoFileDatabase {
  instanceId: string
  collections: {
    family_profiles: FamilyProfileDocument[]
  }
}

function resolveInstanceId(): string {
  const raw =
    process.env.MONGO_INSTANCE_ID ||
    process.env.INSTANCE_ID ||
    process.env.HOSTNAME ||
    'default-instance'
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function sanitizeUserId(raw?: string | null): string {
  const clean = (raw || 'default').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_')
  return clean || 'default'
}

export function getMongoStorePath(): string {
  if (process.env.MONGO_DATA_FILE) {
    return path.resolve(process.env.MONGO_DATA_FILE)
  }
  const instanceId = resolveInstanceId()
  return path.resolve(process.cwd(), '.data', `mongo-perhepiiri-${instanceId}.json`)
}

async function readDatabase(filePath: string, instanceId: string): Promise<MongoFileDatabase> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as MongoFileDatabase
    return {
      instanceId: parsed.instanceId || instanceId,
      collections: {
        family_profiles: Array.isArray(parsed.collections?.family_profiles)
          ? parsed.collections.family_profiles
          : [],
      },
    }
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code
    if (code === 'ENOENT') {
      return {
        instanceId,
        collections: { family_profiles: [] },
      }
    }
    throw err
  }
}

async function writeDatabaseAtomic(filePath: string, db: MongoFileDatabase): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tempPath, JSON.stringify(db, null, 2), 'utf-8')
  await fs.rename(tempPath, filePath)
}

export async function findFamilyProfileDoc(
  rawUserId?: string | null,
): Promise<FamilyProfileDocument | null> {
  const userId = sanitizeUserId(rawUserId)
  const docId = `family-${userId}`
  const instanceId = resolveInstanceId()
  const filePath = getMongoStorePath()
  const db = await readDatabase(filePath, instanceId)
  return db.collections.family_profiles.find((doc) => doc._id === docId) ?? null
}

export async function upsertFamilyProfileDoc(
  profile: UserProfileState,
  rawUserId?: string | null,
): Promise<FamilyProfileDocument> {
  const userId = sanitizeUserId(rawUserId)
  const docId = `family-${userId}`
  const instanceId = resolveInstanceId()
  const filePath = getMongoStorePath()
  const db = await readDatabase(filePath, instanceId)

  const doc: FamilyProfileDocument = {
    _id: docId,
    userId,
    instanceId,
    profile,
    updatedAt: new Date().toISOString(),
  }

  const others = db.collections.family_profiles.filter((d) => d._id !== docId)
  db.collections.family_profiles = [doc, ...others]

  await writeDatabaseAtomic(filePath, db)
  return doc
}