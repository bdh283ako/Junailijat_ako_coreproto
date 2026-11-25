import type { Access, CollectionConfig } from 'payload'

const isPayloadAdmin: Access = ({ req }) => req.user?.collection === 'admins'

export const EventParticipations: CollectionConfig = {
  slug: 'event-participations',
  admin: {
    useAsTitle: 'eventTitle',
    defaultColumns: ['eventTitle', 'participantName', 'status', 'updatedAt'],
  },
  access: {
    read: isPayloadAdmin,
    create: isPayloadAdmin,
    update: isPayloadAdmin,
    delete: isPayloadAdmin,
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
  indexes: [{ fields: ['eventId', 'participantEmail'], unique: true }],
}