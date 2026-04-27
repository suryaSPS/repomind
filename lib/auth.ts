import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import GitHub from 'next-auth/providers/github'
import Google from 'next-auth/providers/google'
import Twitter from 'next-auth/providers/twitter'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { users, oauthAccounts } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

const OAUTH_PROVIDERS = ['github', 'google', 'twitter'] as const
type OAuthProvider = typeof OAUTH_PROVIDERS[number]

function isOAuthProvider(provider: string): provider is OAuthProvider {
  return OAUTH_PROVIDERS.includes(provider as OAuthProvider)
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      // repo scope allows reading private repos the user has access to
      authorization: {
        params: { scope: 'read:user user:email repo' },
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: { scope: 'openid email profile' },
      },
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
  pages: { signIn: '/login' },

  callbacks: {
    async signIn({ user, account }) {
      if (!account || !isOAuthProvider(account.provider)) {
        return true // credentials — nothing to do
      }

      const provider = account.provider
      // providerAccountId is the stable unique ID from the OAuth provider
      // (GitHub numeric user id / Google sub / Twitter numeric id)
      const providerAccountId = account.providerAccountId
      const email = user.email ?? null
      const image = user.image ?? null

      // ── 1. Look up user by provider identity first (most reliable) ────────────
      const [existingAccount] = await db
        .select({ userId: oauthAccounts.userId })
        .from(oauthAccounts)
        .where(
          and(
            eq(oauthAccounts.provider, provider),
            eq(oauthAccounts.providerAccountId, providerAccountId)
          )
        )
        .limit(1)

      let userId: number

      if (existingAccount) {
        // Returning OAuth user — refresh token in oauth_accounts
        userId = existingAccount.userId

        await db
          .update(oauthAccounts)
          .set({
            accessToken: account.access_token ?? null,
            refreshToken: account.refresh_token ?? null,
            expiresAt: account.expires_at
              ? new Date(account.expires_at * 1000)
              : null,
            scope: account.scope ?? null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(oauthAccounts.provider, provider),
              eq(oauthAccounts.providerAccountId, providerAccountId)
            )
          )

        // Refresh avatar in case it changed
        await db
          .update(users)
          .set({ image })
          .where(eq(users.id, userId))
      } else {
        // ── 2. New OAuth login — find or create user record ───────────────────
        // Try to link by verified email as a secondary policy
        let existingUser: { id: number; username: string } | undefined

        if (email) {
          const [byEmail] = await db
            .select({ id: users.id, username: users.username })
            .from(users)
            .where(eq(users.email, email))
            .limit(1)
          existingUser = byEmail
        }

        if (existingUser) {
          userId = existingUser.id
        } else {
          // No existing user — create one
          const rawUsername =
            user.name?.replace(/\s+/g, '-').toLowerCase() ??
            email?.split('@')[0] ??
            `${provider}-user`

          let finalUsername = rawUsername
          const [byName] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.username, rawUsername))
            .limit(1)
          if (byName) finalUsername = `${rawUsername}-${provider}`

          const [created] = await db
            .insert(users)
            .values({ username: finalUsername, email, image, provider })
            .returning({ id: users.id })
          userId = created.id
        }

        // ── 3. Store OAuth account row — token server-side only ───────────────
        await db.insert(oauthAccounts).values({
          userId,
          provider,
          providerAccountId,
          accessToken: account.access_token ?? null,
          refreshToken: account.refresh_token ?? null,
          expiresAt: account.expires_at
            ? new Date(account.expires_at * 1000)
            : null,
          scope: account.scope ?? null,
        })
      }

      // Propagate DB user id/name into the user object so jwt() picks it up
      const [dbUser] = await db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

      user.id = String(dbUser.id)
      user.name = dbUser.username
      return true
    },

    jwt({ token, user }) {
      // Only id and name — no OAuth tokens ever go in the JWT
      if (user) {
        token.id = user.id as string
        token.name = user.name as string
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

// ── Server-side helper: get a user's GitHub access token from DB ───────────────
// Use this in API route handlers that need to call GitHub on behalf of the user.
// The token is never exposed through the session or JWT.
export async function getGitHubToken(userId: number): Promise<string | null> {
  const [row] = await db
    .select({ accessToken: oauthAccounts.accessToken })
    .from(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.userId, userId),
        eq(oauthAccounts.provider, 'github')
      )
    )
    .limit(1)
  return row?.accessToken ?? null
}
