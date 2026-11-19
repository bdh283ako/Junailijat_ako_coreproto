import fs from 'fs/promises'
import path from 'path'

export interface CoParentItem {
  id: string
  name: string
  email: string
  status: 'pending' | 'accepted'
  invitedAt: string
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
  area: string
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

export async function findFamilyProfileDoc(): Promise<FamilyProfileDocument | null> {
  const instanceId = resolveInstanceId()
  const filePath = getMongoStorePath()
  const db = await readDatabase(filePath, instanceId)
  return db.collections.family_profiles.find((doc) => doc._id === 'own-family') ?? null
}

export async function upsertFamilyProfileDoc(
  profile: UserProfileState,
): Promise<FamilyProfileDocument> {
  const instanceId = resolveInstanceId()
  const filePath = getMongoStorePath()
  const db = await readDatabase(filePath, instanceId)

  const doc: FamilyProfileDocument = {
    _id: 'own-family',
    instanceId,
    profile,
    updatedAt: new Date().toISOString(),
  }

  const others = db.collections.family_profiles.filter((d) => d._id !== 'own-family')
  db.collections.family_profiles = [doc, ...others]

  await writeDatabaseAtomic(filePath, db)
  return doc
}

export async function deleteFamilyProfileDoc(): Promise<void> {
  const instanceId = resolveInstanceId()
  const filePath = getMongoStorePath()
  const db = await readDatabase(filePath, instanceId)
  db.collections.family_profiles = db.collections.family_profiles.filter(
    (d) => d._id !== 'own-family',
  )
  await writeDatabaseAtomic(filePath, db)
}