/**
 * Generates a held-out "silver" question set.
 *
 * The source-kind prior was designed after reading failure cases in the gold
 * set, which is exactly the situation where a result can be an artefact of the
 * data it was tuned on. This produces questions the author never saw: a chunk
 * is sampled at random, Claude writes the question a developer would ask that
 * the chunk answers, and the chunk's own file becomes the label.
 *
 * Sampling is uniform over chunks, deliberately including test and
 * documentation files. If the prior only wins because every hand-written label
 * happens to be an implementation file, a set that labels test files as correct
 * is where that shows up.
 *
 * The bias to keep in mind: a question written *from* a passage shares
 * vocabulary with it, which flatters lexical retrieval and makes absolute
 * numbers look better than gold. Only the *difference between arms* on this set
 * is meaningful, and it is never pooled with gold.
 *
 * Run: npx tsx eval/scripts/generate-silver.ts [--per-repo 35]
 */
import '../lib/env'
import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { pool } from '@/lib/db'
import { CORPUS } from '../corpus'
import { classifyPath } from '@/lib/vector/source-prior'

const client = new Anthropic()
const MODEL = 'claude-haiku-4-5'

const PER_REPO = process.argv.includes('--per-repo')
  ? Number(process.argv[process.argv.indexOf('--per-repo') + 1])
  : 35

/** Fixed seed so the sample is the same on a re-run. */
let seed = 20260904
function random(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}

const SYSTEM = `You are given one chunk of source code from a real repository.

Write the single question a developer unfamiliar with this codebase would ask
that this chunk answers. Rules:

- Ask about behaviour or intent, the way a person would in a chat window.
- Do NOT quote distinctive identifiers, string literals or comments verbatim
  from the chunk. If the chunk defines "computeRetryBackoff", ask about retry
  timing, not about "computeRetryBackoff". A question that copies the answer's
  vocabulary is not a retrieval test.
- Do not mention the file name or path.
- One sentence. Output the question only, with no preamble or quotes.`

async function main() {
  const outDir = path.join(process.cwd(), 'eval', 'datasets')

  for (const entry of CORPUS) {
    const { rows: repoRows } = await pool.query(
      `SELECT id FROM repos WHERE url = $1 AND status = 'ready' ORDER BY id DESC LIMIT 1`,
      [entry.url]
    )
    if (repoRows.length === 0) {
      console.warn(`⚠  ${entry.key}: not indexed, skipping`)
      continue
    }

    const { rows: chunks } = await pool.query(
      `SELECT file_path AS "filePath", line_start AS "lineStart",
              line_end AS "lineEnd", content
       FROM code_chunks
       WHERE repo_id = $1 AND length(content) > 400
       ORDER BY id`,
      [repoRows[0].id]
    )

    // Uniform sample without replacement, from the seeded generator.
    const pool_ = [...chunks]
    const picked: typeof chunks = []
    while (picked.length < Math.min(PER_REPO, pool_.length)) {
      picked.push(...pool_.splice(Math.floor(random() * pool_.length), 1))
    }

    console.log(`\n▶ ${entry.key}: generating ${picked.length} questions`)
    const lines: string[] = []

    for (let i = 0; i < picked.length; i++) {
      const chunk = picked[i]
      try {
        const response = await client.messages.create({
          model: MODEL,
          max_tokens: 300,
          system: SYSTEM,
          messages: [
            {
              role: 'user',
              content: `Repository: ${entry.owner}/${entry.name}\n\n\`\`\`\n${chunk.content.slice(0, 4000)}\n\`\`\``,
            },
          ],
        })

        const question = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text.trim())
          .join(' ')
          .replace(/^["']|["']$/g, '')

        if (!question || question.length < 15) continue

        lines.push(
          JSON.stringify({
            id: `${entry.key}-s${String(i + 1).padStart(3, '0')}`,
            repo: entry.key,
            type: 'concept',
            question,
            relevantFiles: [chunk.filePath],
            sourceKind: classifyPath(chunk.filePath),
          })
        )
        process.stdout.write('.')
      } catch (err) {
        process.stdout.write('x')
        void err
      }
    }

    fs.writeFileSync(path.join(outDir, `${entry.key}.silver.jsonl`), lines.join('\n') + '\n')
    console.log(`\n  → eval/datasets/${entry.key}.silver.jsonl (${lines.length})`)
  }

  await pool.end()
}

main()
