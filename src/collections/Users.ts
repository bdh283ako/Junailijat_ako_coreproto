import type { Access, CollectionConfig } from 'payload'

const isPayloadAdmin: Access = ({ req }) => req.user?.collection === 'admins'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    create: () => false,
    delete: isPayloadAdmin,
    read: isPayloadAdmin,
    update: isPayloadAdmin,
  },
  admin: {
    group: 'App',
    useAsTitle: 'email',
  },
  auth: {
    disableLocalStrategy: true,
  },
  fields: [
    {
      name: 'providerId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true },
    },
    { name: 'email', type: 'email', index: true },
    { name: 'name', type: 'text' },
    { name: 'avatarUrl', type: 'text' },
    { name: 'savedLocation', type: 'json' },
    { name: 'familyProfile', type: 'json' },
    { name: 'communityState', type: 'json' },
    {
      name: 'isDemo',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Imported demo profile; never treated as an authenticated account.' },
    },
  ],
  versions: false,
}