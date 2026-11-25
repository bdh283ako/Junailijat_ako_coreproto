import type { Access, CollectionConfig } from 'payload'

const isPayloadAdmin: Access = ({ req }) => req.user?.collection === 'admins'

export const ChatMessages: CollectionConfig = {
  slug: 'chat-messages',
  admin: {
    useAsTitle: 'channelTitle',
    defaultColumns: ['channelTitle', 'senderName', 'body', 'createdAt'],
  },
  access: {
    read: isPayloadAdmin,
    create: isPayloadAdmin,
    update: isPayloadAdmin,
    delete: isPayloadAdmin,
  },
  fields: [
    { name: 'legacyId', type: 'text', unique: true, index: true },
    { name: 'channelId', type: 'text', required: true, index: true },
    { name: 'channelTitle', type: 'text', required: true },
    { name: 'senderEmail', type: 'text', required: true, index: true },
    { name: 'senderName', type: 'text', required: true },
    { name: 'body', type: 'textarea', required: true },
  ],
  indexes: [{ fields: ['channelId', 'createdAt'] }],
}