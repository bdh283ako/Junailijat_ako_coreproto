import type { CollectionConfig } from 'payload'

export const EventParticipations: CollectionConfig = {
  slug: 'event-participations',
  admin: {
    useAsTitle: 'eventTitle',
    defaultColumns: ['eventTitle', 'participantName', 'status', 'updatedAt'],
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    { name: 'eventId', type: 'text', required: true, index: true },
    { name: 'eventTitle', type: 'text', required: true },
    { name: 'participantEmail', type: 'text', required: true, index: true },
    { name: 'participantName', type: 'text', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'going',
      options: [
        { label: 'Menossa', value: 'going' },
        { label: 'Kiinnostunut', value: 'interested' },
      ],
    },
  ],
}