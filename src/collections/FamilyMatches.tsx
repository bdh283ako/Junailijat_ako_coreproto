import { CollectionConfig } from 'payload/types'

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
      relationTo: 'families', // Viittaus perheprofiilien kokoelmaan
      required: true,
    },
    {
      name: 'toFamily',
      type: 'relationship',
      relationTo: 'families',
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