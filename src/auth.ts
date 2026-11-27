import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { syncGoogleUser } from '@/lib/oauth-user'
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  SESSION_MAX_AGE,
} from '@/lib/session-cookie'

if (
  !process.env.AUTH_URL &&
  process.env.NEXT_PUBLIC_SITE_URL &&
  !process.env.NEXT_PUBLIC_SITE_URL.includes('localhost')
) {
  process.env.AUTH_URL = process.env.NEXT_PUBLIC_SITE_URL
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: [Google],
  session: { strategy: 'jwt', maxAge: SESSION_MAX_AGE },
  cookies: {
    sessionToken: { name: SESSION_COOKIE, options: SESSION_COOKIE_OPTIONS },
    csrfToken: { name: CSRF_COOKIE, options: SESSION_COOKIE_OPTIONS },
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== 'google' || typeof profile?.sub !== 'string') return false

      try {
        await syncGoogleUser({
          sub: profile.sub,
          email: typeof profile.email === 'string' ? profile.email : null,
          name: typeof profile.name === 'string' ? profile.name : null,
          picture: typeof profile.picture === 'string' ? profile.picture : null,
        })
      } catch (error) {
        // Logitetaan oikea virhe (esim. tietokantayhteys) näkyviin lokeihin;
        // virhe heitetään edelleen eteenpäin, jotta Auth.js käyttäytyy samoin kuin ennen.
        console.error('[auth] signIn-callback: syncGoogleUser epäonnistui:', error)
        throw error
      }
      return true
    },
    jwt({ token, account, profile }) {
      if (account?.provider === 'google' && typeof profile?.sub === 'string') {
        token.providerId = profile.sub
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id =
          typeof token.payloadUserId === 'string'
            ? token.payloadUserId
            : typeof token.sub === 'string'
              ? token.sub
              : ''
        session.user.providerId = typeof token.providerId === 'string' ? token.providerId : ''
      }
      return session
    },
  },
})
