import Anthropic from '@anthropic-ai/sdk'

/**
 * LLM-as-judge grading for answer quality.
 *
 * Two things are graded here and nowhere else, because they need reading
 * comprehension over source code: whether the answer is *correct* about the
 * mechanism, and whether its citations point at the right places. Everything
 * checkable without a model — do the cited paths exist, were the labelled files
 * cited, how many tool calls, how many tokens — is computed deterministically
 * in eval/lib/citations.ts and the summary script, so the judge is never asked
 * a question that arithmetic could answer.
 *
 * The judge is shown the ground-truth source, so it grades against the code
 * rather than against its own prior about what Django or Flask probably does.
 * It is not told which retrieval arm produced the answer.
 */

const client = new Anthropic()

/** Grading is the headline correctness number, so it runs on the strongest model. */
export const JUDGE_MODEL = 'claude-opus-5'

export interface Verdict {
  correctness: number
  citationQuality: number
  rationale: string
}

const SYSTEM = `You grade answers produced by a code-question-answering assistant.

You will be given: a developer's question about a repository, the ground-truth source file(s) that answer it, and the assistant's answer. Grade the answer against the source you are shown, not against your own knowledge of the library.

Return ONLY a JSON object, no prose around it, with exactly these keys:

{
  "correctness": 1-5,
  "citationQuality": 1-5,
  "rationale": "one or two sentences"
}

correctness — is the explanation of the mechanism right?
  5 = accurate and complete; a developer could act on it
  4 = accurate, but misses something a reader would want
  3 = broadly right with a real inaccuracy
  2 = mostly wrong, some correct fragments
  1 = wrong, or does not answer the question

citationQuality — do the file/line references point somewhere useful?
  5 = cites the right file(s) with line ranges that land on the relevant code
  4 = right file(s), imprecise lines
  3 = cites related but not the most relevant file
  2 = citations are mostly irrelevant
  1 = no citations, or citations to files that do not exist

Judge only what is in front of you. An answer that reaches the right conclusion
by a different route than the ground-truth file is still correct if the source
shown supports it.`

function extractJson(text: string): Verdict | null {
  // The model is asked for bare JSON, but a stray fenced block or preamble
  // should not throw away a whole grading call.
  const fenced = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  const bare = text.match(/\{[\s\S]*\}/)
  const candidate = fenced?.[1] ?? bare?.[0]
  if (!candidate) return null

  try {
    const parsed = JSON.parse(candidate)
    if (typeof parsed.correctness !== 'number' || typeof parsed.citationQuality !== 'number') {
      return null
    }
    return {
      correctness: parsed.correctness,
      citationQuality: parsed.citationQuality,
      rationale: String(parsed.rationale ?? ''),
    }
  } catch {
    return null
  }
}

export interface JudgeInput {
  question: string
  answer: string
  groundTruth: { filePath: string; content: string }[]
}

export interface JudgeOutput extends Verdict {
  inputTokens: number
  outputTokens: number
}

export async function judgeAnswer(input: JudgeInput): Promise<JudgeOutput | null> {
  if (!input.answer.trim()) return null

  const sources = input.groundTruth
    .map((f) => `### ${f.filePath}\n\`\`\`\n${f.content}\n\`\`\``)
    .join('\n\n')

  const userContent = `## Question\n${input.question}\n\n## Ground-truth source\n${sources}\n\n## Assistant's answer\n${input.answer}`

  let inputTokens = 0
  let outputTokens = 0

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.messages.create({
      model: JUDGE_MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      output_config: { effort: 'medium' },
      messages: [{ role: 'user', content: userContent }],
    })

    inputTokens += response.usage.input_tokens
    outputTokens += response.usage.output_tokens

    if (response.stop_reason === 'refusal') return null

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')

    const verdict = extractJson(text)
    if (verdict) return { ...verdict, inputTokens, outputTokens }
  }

  return null
}
