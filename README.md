# 🔍 RepoMind — AI Code Archaeologist

Drop in any public GitHub repo URL and get a fully interactive AI agent that answers questions, traces bugs, explains decisions, and onboards new devs — with cited file + line references.

## What it does

- **Semantic code search** — finds relevant code by meaning, not keywords
- **Git history tracing** — "why was this changed?" answered with actual commit context
- **File citations** — every answer links to exact file paths and line numbers
- **Agentic tool use** — Claude 3.7 calls `search_code`, `open_file`, `grep_repo`, `get_commit` to navigate the repo like a developer would
- **Streaming UI** — tokens appear live as Claude reasons through the codebase
- **Auth** — username/password login, separate chat history per user

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 App Router |
| UI | Tailwind CSS + shadcn/ui |
| Database | PostgreSQL + pgvector (Docker) |
| ORM | Drizzle ORM |
| Auth | NextAuth.js v5 (credentials) |
| Embeddings | OpenAI `text-embedding-3-small` |
| Agent | Claude 3.7 Sonnet via Vercel AI SDK |
| Git ops | simple-git |

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) (for Postgres + pgvector)
- Node.js 18+
- OpenAI API key
- Anthropic API key

## Setup

### 1. Clone & install

```bash
git clone <your-repo-url>
cd repomind
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/repomind
NEXTAUTH_SECRET=any-random-32-char-string
NEXTAUTH_URL=http://localhost:3000

# Users — format: username:password,username2:password2
SEED_USERS=admin:yourpassword,alice:alicepassword

OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Start the database

```bash
docker compose up -d
```

This spins up pgvector/pgvector:pg16 on port 5432.

### 4. Run migrations & seed users

```bash
npm run db:generate   # generates SQL from schema
npm run db:migrate    # applies migrations + seeds users from SEED_USERS
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — log in with any user from `SEED_USERS`.

## How to use

1. **Paste a GitHub URL** (e.g. `https://github.com/vercel/next.js`)
2. Click **Analyze** — watch the live progress bar as the repo is cloned, chunked, embedded, and indexed
3. **Ask anything** once indexing is complete:
   - *"How is authentication implemented?"*
   - *"Why was the auth system refactored in March?"*
   - *"Show me all places where database connections are handled"*
   - *"Explain the folder structure and main entry points"*

## Project Structure

```
repomind/
├── app/
│   ├── page.tsx              # Auth guard → MainApp
│   ├── MainApp.tsx           # Root client layout (sidebar + chat)
│   ├── login/page.tsx        # Login form
│   └── api/
│       ├── ingest/route.ts   # Clone + embed pipeline (SSE streaming)
│       ├── chat/route.ts     # Claude agent (streaming)
│       └── repos/route.ts    # List indexed repos
├── components/
│   ├── Sidebar.tsx           # Repo list + user footer
│   ├── RepoInput.tsx         # URL input + progress bar
│   ├── ChatInterface.tsx     # Chat window with useChat hook
│   └── MessageBubble.tsx     # Message renderer + citation chips
├── lib/
│   ├── auth.ts               # NextAuth config
│   ├── db/                   # Drizzle schema + migrations + connection
│   ├── vector/search.ts      # pgvector similarity search helpers
│   ├── ingestion/            # clone → walk → chunk → embed → store
│   └── agent/                # Claude tools + system prompt
├── docker-compose.yml
└── .env.example
```

## Available scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run db:generate  # Generate Drizzle migration SQL
npm run db:migrate   # Apply migrations + seed users
npm run db:studio    # Open Drizzle Studio (visual DB browser)
```

## Adding users

Edit `SEED_USERS` in `.env.local` and re-run:

```bash
npm run db:migrate
```

Format: `username:password,username2:password2`
