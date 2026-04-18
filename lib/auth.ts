import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import GitHub from 'next-auth/providers/github'
import Google from 'next-auth/providers/google'
import Twitter from 'next-auth/providers/twitter'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Twitter({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
    }),
    Credentials({
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const { username, password } = credentials as {
          username: string
          password: string
        }

        if (!username || !password) return null

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1)

        if (!user || !user.passwordHash) return null

        const valid = await bcrypt.compare(password, user.passwordHash)
        if (!valid) return null

        return { id: String(user.id), name: user.username, email: user.email }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'github' || account?.provider === 'google' || account?.provider === 'twitter') {
        // Auto-create or update user on OAuth login
        const provider = account.provider
        const username = user.name ?? user.email?.split('@')[0] ?? `${provider}-user`
        const email = user.email ?? null
        const image = user.image ?? null

        const [existing] = await db
          .select()
          .from(users)
          .where(eq(users.email, email ?? ''))
          .limit(1)

        if (!existing) {
          // Check if username exists, append suffix if needed
          let finalUsername = username
          const [byName] = await db
            .select()
            .from(users)
            .where(eq(users.username, username))
            .limit(1)
          if (byName) {
            finalUsername = `${username}-${provider}`
          }

          const [created] = await db
            .insert(users)
            .values({
              username: finalUsername,
              email,
              image,
              provider,
            })
            .returning({ id: users.id })

          user.id = String(created.id)
          user.name = finalUsername
        } else {
          // Update image/name if changed
          await db
            .update(users)
            .set({ image, username: existing.username })
            .where(eq(users.id, existing.id))

          user.id = String(existing.id)
          user.name = existing.username
        }
      }
      return true
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.name = user.name
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.name = token.name as string
      }
      return session
    },
  },
})
