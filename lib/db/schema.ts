import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'
import { customType } from 'drizzle-orm/pg-core'

// ─── Custom vector type for pgvector ─────────────────────────────────────────
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1536)'
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`
  },
  fromDriver(value: string): number[] {
    return value
      .replace('[', '')
      .replace(']', '')
      .split(',')
      .map(Number)
  },
})

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),  // nullable for OAuth users
  email: varchar('email', { length: 255 }),
  image: varchar('image', { length: 500 }),
  provider: varchar('provider', { length: 50 }).default('credentials'),  // 'credentials' | 'github'
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Repos ────────────────────────────────────────────────────────────────────
export const repos = pgTable('repos', {
  id: serial('id').primaryKey(),
  url: varchar('url', { length: 500 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  owner: varchar('owner', { length: 255 }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  // pending | processing | ready | error
  fileCount: integer('file_count').default(0),
  commitCount: integer('commit_count').default(0),
  errorMessage: text('error_message'),
  clonedPath: varchar('cloned_path', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ─── Sessions / Messages ──────────────────────────────────────────────────────
export const chatSessions = pgTable('chat_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  repoId: integer('repo_id')
    .notNull()
    .references(() => repos.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id')
    .notNull()
    .references(() => chatSessions.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Code chunks (with vector embedding) ─────────────────────────────────────
export const codeChunks = pgTable(
  'code_chunks',
  {
    id: serial('id').primaryKey(),
    repoId: integer('repo_id')
      .notNull()
      .references(() => repos.id, { onDelete: 'cascade' }),
    filePath: varchar('file_path', { length: 1000 }).notNull(),
    lineStart: integer('line_start').notNull(),
    lineEnd: integer('line_end').notNull(),
    content: text('content').notNull(),
    language: varchar('language', { length: 100 }),
    embedding: vector('embedding'),
  },
  (table) => [index('code_chunks_repo_idx').on(table.repoId)]
)

// ─── Commit chunks (with vector embedding) ────────────────────────────────────
export const commitChunks = pgTable(
  'commit_chunks',
  {
    id: serial('id').primaryKey(),
    repoId: integer('repo_id')
      .notNull()
      .references(() => repos.id, { onDelete: 'cascade' }),
    hash: varchar('hash', { length: 40 }).notNull(),
    message: text('message').notNull(),
    author: varchar('author', { length: 255 }),
    date: timestamp('date'),
    filesChanged: text('files_changed'),
    diff: text('diff'),           // full git diff stored for get_commit tool
    embedding: vector('embedding'),
  },
  (table) => [index('commit_chunks_repo_idx').on(table.repoId)]
)

// ─── Full file contents (used by open_file / grep_repo — no disk needed) ──────
export const repoFiles = pgTable(
  'repo_files',
  {
    id: serial('id').primaryKey(),
    repoId: integer('repo_id')
      .notNull()
      .references(() => repos.id, { onDelete: 'cascade' }),
    filePath: varchar('file_path', { length: 1000 }).notNull(),
    content: text('content').notNull(),
    language: varchar('language', { length: 100 }),
  },
  (table) => [
    index('repo_files_repo_idx').on(table.repoId),
    index('repo_files_path_idx').on(table.repoId, table.filePath),
  ]
)

// ─── OAuth Accounts ───────────────────────────────────────────────────────────
// One row per provider+account — safe server-side store for access tokens.
// Tokens never go into the JWT or client-visible session.
export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 50 }).notNull(),          // 'github' | 'google'
    providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(), // GitHub numeric id / Google sub
    accessToken: text('access_token'),   // stored server-side only, never in JWT
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at'),
    scope: varchar('scope', { length: 500 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('oauth_accounts_user_idx').on(table.userId),
    index('oauth_accounts_provider_idx').on(table.provider, table.providerAccountId),
  ]
)

// ─── Types ────────────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Repo = typeof repos.$inferSelect
export type NewRepo = typeof repos.$inferInsert
export type ChatSession = typeof chatSessions.$inferSelect
export type Message = typeof messages.$inferSelect
export type CodeChunk = typeof codeChunks.$inferSelect
export type CommitChunk = typeof commitChunks.$inferSelect
export type RepoFile = typeof repoFiles.$inferSelect
export type OAuthAccount = typeof oauthAccounts.$inferSelect
export type NewOAuthAccount = typeof oauthAccounts.$inferInsert
