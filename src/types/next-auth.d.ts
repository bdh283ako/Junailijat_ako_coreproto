import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      providerId: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    payloadUserId?: string
    providerId?: string
  }
}
