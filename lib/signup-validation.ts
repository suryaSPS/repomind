import { z } from 'zod'

export const signupSchema = z.object({
  username: z.string().trim().regex(/^[a-zA-Z0-9_-]{3,32}$/, 'Use 3–32 letters, numbers, underscores, or hyphens for your username.'),
  password: z.string().min(12, 'Use at least 12 characters for your password.')
    .refine(value => new TextEncoder().encode(value).length <= 72, 'Password must be at most 72 bytes. Try fewer characters.'),
})
