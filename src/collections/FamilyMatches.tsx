import type { Access, CollectionConfig } from 'payload'

const isPayloadAdmin: Access = ({ req }) => req.user?.collection === 'admins'

export const FamilyMatches: CollectionConfig = {
  slug: 'family-matches',
  access: {
    read: isPayloadAdmin,
    create: isPayloadAdmin,
    update: isPayloadAdmin,
    delete: isPayloadAdmin,
  },
  admin: {
    useAsTitle: 'status',
  },
  fields: [
    {
      name: 'fromFamily',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'toFamily',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'liked',
      options: [
        { label: 'Liked (Odottaa vastapuolta)', value: 'liked' },
        { label: 'Passed (Ohitettu)', value: 'passed' },
        { label: 'Matched (Osuma!)', value: 'matched' },
      ],
    },
  ],
  indexes: [{ fields: ['fromFamily', 'toFamily'], unique: true }],
}