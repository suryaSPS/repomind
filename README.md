# 🔍 RepoMind — AI Code Archaeologist

Drop in any public GitHub repo URL and get a fully interactive AI agent that answers questions, traces bugs, explains decisions, and onboards new devs — with cited file + line references.

## What it does

- **Semantic code search** — finds relevant code by meaning, not keywords
- **Git history tracing** — "why was this changed?" answered with actual commit context
- **File citations** — every answer links to exact file paths and line numbers
- **Agentic tool use** — the agent calls `search_code`, `open_file`, `grep_repo`, `get_commit` to navigate the repo like a developer would
- **Measured retrieval** — ranking quality is a number, not an adjective: see [Measured results](#measured-results)
- **Streaming UI** — tokens appear live as Claude reasons through the codebase
- **Auth** — username/password login, separate chat history per user

## Measured results

Retrieval here is measured, not asserted. The harness in [`eval/`](./eval) scores
**111 hand-labelled questions** across four repositories in three languages
(3,147 files, 13,737 chunks), comparing **8 retrieval strategies** on the same
questions against the same index. Full write-up: [`eval/RESULTS.md`](./eval/RESULTS.md),
or the rendered report at `/results` in the running app.

| Strategy | R@1 | R@5 | MRR | nDCG@10 | vs baseline |
|---|---|---|---|---|---|
| Keyword search — Postgres FTS | 0.225 | 0.604 | 0.398 | 0.468 | −0.313 (p<0.0001) |
| Keyword search — BM25 | 0.311 | 0.685 | 0.499 | 0.575 | −0.206 (p<0.0001) |
| Hybrid, equal-weight fusion | 0.495 | 0.824 | 0.667 | 0.721 | −0.060 (p=0.009) |
| Hybrid, weighted fusion 3:1 | 0.536 | 0.847 | 0.693 | 0.744 | −0.037 (p=0.062) |
| Hybrid, vector + BM25 | 0.523 | 0.847 | 0.701 | 0.748 | −0.033 (p=0.203) |
| Vector search *(previous default)* | 0.622 | 0.874 | 0.752 | 0.781 | baseline |
| **Vector + source-kind re-ranking** *(shipped)* | **0.667** | **0.887** | **0.789** | **0.815** | **+0.033 (p=0.0008)** |

Significance is a two-sided paired bootstrap, 10,000 resamples.

### Three things the measurements changed

**Hybrid keyword+vector search was rejected.** It is the standard RAG
recommendation, and every variant scored at or below plain vector search. Even
on 22 bare-identifier queries (`getGitHubToken`, `StringToBytes`) — added
specifically to find where keyword search should win — vector search still won,
0.806 to 0.544. Chunks are embedded as `File: {path}\n\n{content}`, so the file
path is inside the embedded text and the model is not blind to identifiers.

**Tests and docs were burying implementation.** Asking gin's repo what data
structure the router uses returned `BENCHMARKS.md`, `docs/doc.md` and
`routes_test.go` — never `tree.go`. A test *describes* behaviour in plainer
language than the code does, so it sits closer to the question in embedding
space. [`lib/vector/source-prior.ts`](./lib/vector/source-prior.ts) re-ranks by
what kind of file a result is. The gain tracks how much test material a repo
carries — gin +0.086, flask +0.037, django +0.020, and RepoMind itself −0.007
because it has no test suite. That last one is the control.

**There was no index on the embedding column.** Every semantic search was an
exact sequential scan. On a 12,290-chunk repository that was 153.9 ms of
server-side execution; with HNSW it is **0.7 ms — 220× faster** — for 0.009
nDCG@10 lost to approximate search.

### Answer quality

Retrieval metrics establish that the right file was available. These measure what
the agent did with it, over **54 graded answers** on the shipped configuration.
They are computed without a model — cited paths are checked against the
repository, so nothing sits between the answer and the number.

| metric | value |
|---|---|
| Cited paths that resolve to real files | **96.5%** |
| Answers citing at least one labelled file | 90.7% |
| Answers containing a path that does not exist | **5.6%** |
| Tool calls per answer | 5.8 |
| Cost per answer | **$0.073** |
| Median latency | 21.4 s |

That last group is the useful part: one answer in eighteen cites a file that is
not in the repository, which for a citation-based product is the failure mode
that matters, and a question costs 7.3 cents because the prompt reaches 64K
tokens as tool results accumulate across steps.

### Held-out validation

The re-ranking weight was first tuned to 0.62, which scored best on the labelled
set it was designed against. A **70-question held-out set** caught it: on unseen
questions whose answer really *was* a test file, nDCG@10 collapsed from 0.605 to
0.148. The shipped weight is 0.9, giving up part of the achievable gain to keep
held-out performance flat.

```bash
npx tsx eval/scripts/run-retrieval.ts --tier gold   # reproduce the table above
```

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 App Router |
| UI | Tailwind CSS + shadcn/ui |
| Database | PostgreSQL + pgvector (HNSW index) |
| ORM | Drizzle ORM |
| Auth | NextAuth.js v5 — GitHub / Google / X OAuth + credentials |
| Embeddings | OpenAI `text-embedding-3-small` |
| Agent | Claude Haiku 4.5 via Vercel AI SDK |
| Git ops | simple-git |
| Evaluation | Custom harness — Recall@k, MRR, nDCG@k, paired bootstrap |

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

## Run the whole stack with Docker

The steps above run Postgres in Docker but the app on your host. You can instead
run **everything** — database, migrations, and the app — in containers:

```bash
cp .env.example .env.local   # fill in API keys, NEXTAUTH_SECRET, SEED_USERS
docker compose up --build
```

Then open [http://localhost:3000](http://localhost:3000).

### How Docker is wired up here

Three services in `docker-compose.yml`, started in dependency order:

| Service   | Image                    | Role |
|-----------|--------------------------|------|
| `db`      | `pgvector/pgvector:pg16` | Postgres with the pgvector extension. Data persists in the `pgdata` volume. Has a healthcheck so dependents wait until it's actually ready. |
| `migrate` | built from `Dockerfile` (`builder` stage) | One-off container: enables pgvector, applies Drizzle migrations, seeds `SEED_USERS`, then exits. Uses the `builder` stage because it still has `tsx` + the source. |
| `app`     | built from `Dockerfile` (`runner` stage) | The Next.js server. Waits for `db` to be healthy **and** `migrate` to finish before starting. |

The **`Dockerfile` is multi-stage** to keep the final image small:

1. **`deps`** — `npm ci` once, cached on the lockfile.
2. **`builder`** — `next build`. Because `next.config.ts` sets `output: 'standalone'`,
   Next traces exactly which files are needed and emits a self-contained
   `.next/standalone/server.js`.
3. **`runner`** — copies only `standalone/` + `static/` + `public/`, runs as a
   non-root `nextjs` user, and starts `node server.js`. No dev dependencies, no
   source tree, no `next` CLI ship in this image.

**Config flows in two ways.** Secrets (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
`NEXTAUTH_SECRET`, `SEED_USERS`, OAuth creds) come from `.env.local` via
`env_file`. `DATABASE_URL` and `NEXTAUTH_URL` are **overridden per-service** in
Compose so containers reach Postgres at `db:5432` over the Compose network
(your `.env.local` still points at `localhost` for host-based `npm run dev`).

**Volumes / persistence.** `pgdata` holds the database; `repodata` is mounted at
`/app/data/repos` so downloaded repo tarballs survive restarts. Repo ingestion
uses the GitHub REST API (tarball + commits/diff over `fetch`), so the app image
needs **no `git` binary**.

Useful commands:

```bash
docker compose up --build          # build + run the full stack
docker compose up -d db            # just Postgres (the original workflow)
docker compose run --rm migrate    # re-apply migrations / re-seed users
docker compose logs -f app         # tail the app logs
docker compose down                # stop (add -v to also wipe volumes)
```

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
│   ├── results/page.tsx      # Public evaluation report
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
│   ├── vector/
│   │   ├── search.ts         # pgvector similarity search helpers
│   │   ├── source-prior.ts   # re-rank by implementation vs test/docs
│   │   ├── hybrid.ts         # lexical + RRF fusion (measured, not enabled)
│   │   └── tokenize.ts       # code-aware tokenizer (camelCase, snake_case)
│   ├── ingestion/            # clone → walk → chunk → embed → store
│   └── agent/
│       ├── runtime.ts        # prompt assembly, shared by the route and the eval
│       ├── tools.ts          # search_code, open_file, grep_repo, get_commit
│       └── prompts.ts        # system prompts
├── eval/                     # retrieval evaluation harness
│   ├── datasets/             # hand-labelled + held-out questions
│   ├── lib/                  # metrics, retrievers, citation checks, judge
│   ├── scripts/              # ingest, run, sweep, export
│   ├── results/              # raw JSON — every quoted figure comes from here
│   └── RESULTS.md            # the write-up
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
