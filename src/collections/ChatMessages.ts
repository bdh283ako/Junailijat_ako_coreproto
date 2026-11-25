import type { CollectionConfig } from 'payload'

export const ChatMessages: CollectionConfig = {
  slug: 'chat-messages',
  admin: {
    useAsTitle: 'channelTitle',
    defaultColumns: ['channelTitle', 'senderName', 'body', 'createdAt'],
  },
  access: {
    read: () => true,
    create: () => true,
  },
  fields: [
    { name: 'channelId', type: 'text', required: true, index: true },
    { name: 'channelTitle', type: 'text', required: true },
    { name: 'senderEmail', type: 'text', required: true, index: true },
    { name: 'senderName', type: 'text', required: true },
    { name: 'body', type: 'textarea', required: true },
  ],
}