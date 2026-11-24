import type { CollectionConfig } from 'payload'

export const FamilyMatches: CollectionConfig = {
  slug: 'family-matches',
  admin: {
    useAsTitle: 'status',
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
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
}