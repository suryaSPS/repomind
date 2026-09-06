# RepoMind evaluation

An offline harness for the question "is retrieval actually working, and does
changing it change the answers?"

Everything here runs against the same Postgres the product uses, over four
indexed repositories, and the retrievers under test call the same functions in
`lib/vector/` that serve live traffic. A win measured here is a win in shippable
code, not in an eval-only reimplementation.

## Layout

```
eval/
  corpus.ts                 repositories the evaluation runs against
  datasets/*.gold.jsonl     hand-written questions with hand-checked file labels
  lib/
    metrics.ts              recall / precision / MRR / nDCG / MAP + bootstrap tests
    retrievers.ts           the strategies under test
    citations.ts            citation extraction and existence checking
    judge.ts                LLM-as-judge grading
    dataset.ts, env.ts      loading, env ordering
  scripts/
    ingest.ts               index the corpus
    verify-dataset.ts       check every label resolves to an indexed file
    setup-lexical.ts        build the code-aware tsvector + GIN index
    setup-hnsw.ts           build / drop the HNSW vector index
    run-retrieval.ts        retrieval metrics for every retriever
    run-answers.ts          run the real agent, one pass per arm
    judge-answers.ts        grade the answers, emit the end-to-end table
  results/                  JSON output, committed so numbers are auditable
```

## Reproducing

```bash
export GITHUB_TOKEN=$(gh auth token)     # avoids the 60 req/hr anonymous limit
npx tsx eval/scripts/ingest.ts           # ~10 min, mostly embedding django
npx tsx eval/scripts/verify-dataset.ts   # must print all-green before trusting numbers
npx tsx eval/scripts/run-retrieval.ts --tier gold
npx tsx eval/scripts/run-answers.ts      # runs the agent: costs real money
npx tsx eval/scripts/judge-answers.ts
```

## The corpus

| repo | language | files indexed | chunks | why it is here |
|---|---|---|---|---|
| suryaSPS/repomind | TypeScript | 76 | 376 | ground truth can be labelled with certainty |
| pallets/flask | Python | 119 | 456 | small, well-known, heavily documented |
| gin-gonic/gin | Go | 112 | 615 | third language; unusually test-dense |
| django/django | Python | 2,840 | 12,290 | scale — 10x the others, 2,840 candidate files |

Three ~100-file repositories cannot tell you whether a retriever survives a
larger candidate set, which is why django is in the mix.

## Ground truth

111 questions, hand-written and hand-labelled with the file(s) that answer them.
`verify-dataset.ts` asserts that every labelled path is actually in the index —
a label pointing at an unindexed file is not a hard question, it is an
unanswerable one, and it would drag every retriever down equally while looking
like corpus difficulty.

Relevance is judged at **file** level. Chunk boundaries are an artefact of the
60-line splitter; what a developer opens, and what the agent cites, is a file.

Questions are tagged by kind, because the kinds behave differently:

| kind | n | shape |
|---|---|---|
| `concept` | 58 | "how does the request context get pushed and popped" |
| `symbol_exact` | 22 | a bare identifier: `PBKDF2PasswordHasher` |
| `symbol` | 14 | the same intent as a sentence: "where is url_for implemented" |
| `howto` | 11 | "how do I serve static files from a directory" |
| `architecture` / `debug` | 6 | end-to-end flow, or a symptom |

### What this dataset is not

It is 111 questions written by one person who had read the repositories. It is
large enough to separate a 0.06 nDCG effect from noise on a paired test, and far
too small to be a benchmark. Questions were written before any retriever was
run, and `symbol_exact` was added mid-way — after the first results showed the
existing "symbol" questions were prose, not the bare identifiers developers
actually paste — which is a dataset gap being fixed, not a threshold being
chased. No question or label was edited after seeing a score.

## Metrics

Retrieval: Recall@k, Precision@k, Hit@k, MRR, nDCG@k, MAP@k for k in
{1,3,5,10,20}, plus p50/p95 latency.

nDCG@10 is the headline because rank position matters here in a way a plain
recall number hides: the prompt carries only the top 5 chunks, so a relevant
file at rank 9 is one the agent has to spend a tool call to find.

Comparisons use a **paired bootstrap** (10,000 resamples). Every retriever sees
the same queries, so pairing removes query difficulty from the comparison and
detects a real difference with far fewer questions than an unpaired test would.
Reported p-values are two-sided.

End-to-end: the agent is run for real, once per arm, and graded on

- **correctness** and **citation quality** (1-5) by `claude-opus-5`, shown the
  ground-truth source and not told which arm produced the answer
- **citation validity** — computed without a model: do the cited paths exist in
  the repository? RepoMind's promise is exact file and line references, and the
  specific way that promise fails is a confident citation of a path that is not
  there.
- tool calls, prompt tokens, cost per answer, latency

## Results

`RESULTS.md` has the numbers and what they mean. There is also a written-up
version with charts: https://claude.ai/code/artifact/32f4c772-f777-4ca0-a172-b9081d433ccd
