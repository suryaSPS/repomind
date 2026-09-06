'use server'

import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { signupSchema } from '@/lib/signup-validation'

export async function createAccount(input: unknown): Promise<{ error?: string; username?: string }> {
  const parsed = signupSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 12)
    const [created] = await db.insert(users).values({
      username: parsed.data.username,
      passwordHash,
      provider: 'credentials',
    }).onConflictDoNothing({ target: users.username }).returning({ username: users.username })

    if (!created) return { error: 'That username is already taken. Choose another or sign in.' }
    return { username: created.username }
  } catch {
    return { error: 'Could not create your account. Please try again.' }
  }
}
