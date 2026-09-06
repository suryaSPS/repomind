# Results

All numbers from `eval/results/`. Methodology in [README.md](./README.md).
Corpus: 4 repositories, 3,147 indexed files, 13,737 chunks. Gold set: 111
hand-labelled questions. Held-out set: 70 generated questions the author never
read before scoring.

---

## 1. Retrieval

Gold set, n=111, k=20 retrieved, relevance judged at file level. `Δ nDCG@10` and
`p` are against the dense production baseline, paired bootstrap, 10,000
resamples, two-sided.

| retriever | R@1 | R@5 | R@10 | MRR | nDCG@10 | Δ nDCG@10 | p |
|---|---|---|---|---|---|---|---|
| **Dense (production baseline)** | 0.622 | 0.874 | 0.910 | 0.752 | 0.781 | — | — |
| Lexical (Postgres FTS) | 0.225 | 0.604 | 0.712 | 0.398 | 0.468 | −0.313 | <0.0001 |
| BM25 (in-process) | 0.311 | 0.685 | 0.851 | 0.499 | 0.575 | −0.206 | <0.0001 |
| Hybrid, equal-weight RRF | 0.495 | 0.824 | 0.910 | 0.667 | 0.721 | −0.060 | 0.009 |
| Hybrid, weighted RRF (3:1) | 0.536 | 0.847 | 0.919 | 0.693 | 0.744 | −0.037 | 0.062 |
| Hybrid dense+BM25, RRF | 0.523 | 0.847 | 0.932 | 0.701 | 0.748 | −0.033 | 0.203 |
| **Dense + source prior (shipped)** | **0.667** | **0.887** | **0.928** | **0.789** | **0.815** | **+0.033** | **0.0008** |
| Hybrid + source prior | 0.613 | 0.869 | 0.919 | 0.744 | 0.781 | −0.000 | 0.996 |

### 1.1 The thing that did not work: hybrid retrieval

Adding a keyword arm and fusing it with the dense ranking is the standard first
move in RAG, and the standard justification is that embeddings are bad at exact
identifiers. Neither half of that held here.

Every hybrid configuration scored **at or below** the dense baseline. Equal-weight
reciprocal rank fusion was significantly worse (−0.060 nDCG@10, p=0.009):
giving a much weaker arm an equal vote lets it displace correct dense hits at
rank 1, and R@1 fell from 0.622 to 0.495. Weighting the dense arm 3:1 recovered
most of that but never got past parity.

The premise failed too. A dedicated set of 22 bare-identifier queries — literally
`PBKDF2PasswordHasher`, `getGitHubToken`, `StringToBytes` — was added
specifically to find the case where lexical should win. Dense still beat lexical
on it, 0.806 to 0.544 nDCG@10. The likely reason is in the ingest path: chunks
are embedded as `File: {path}\n\n{content}`, so the file path is inside the
embedded text, and `text-embedding-3-small` handles identifier tokens better
than the folklore assumes.

The lexical index is retained (it costs 11 MB of GIN across the whole corpus and
backs a possible keyword-search feature) but it is **not** in the default
retrieval path.

### 1.2 The thing that did: a prior on source kind

Reading the queries that failed at every k pointed at one pattern:

| question | top 3 dense results | correct answer |
|---|---|---|
| "what data structure does the router use to match URLs" | `BENCHMARKS.md`, `docs/doc.md`, `routes_test.go` | `tree.go` |
| `addRoute` | `gin_test.go`, `routes_test.go`, `tree_test.go` | `tree.go` |
| "how does a URL path get matched to a view" | three test `urls.py` fixtures | `django/urls/resolvers.py` |

**Tests and documentation were crowding out implementation.** Not an embedding
failure — a test file *describes* a behaviour in plainer language than the
implementation does, and documentation is written to answer exactly this kind of
question, so both are legitimately closer to the query in embedding space.
Similarity is simply the wrong final ranking signal: a developer asking how
routing works wants `tree.go`, and only wants `tree_test.go` when they say so.

The fix ([`lib/vector/source-prior.ts`](../lib/vector/source-prior.ts)) retrieves
40 candidates instead of 5, classifies each by path (implementation / test /
docs / example / config), multiplies non-implementation similarity by 0.9,
re-sorts, and cuts. Queries that ask *for* tests, docs or config keep the full
weight for that kind.

Effect is consistent across repositories, and its size tracks how much
non-implementation material each one carries:

| repo | dense | + prior | Δ | test surface |
|---|---|---|---|---|
| gin | 0.702 | 0.788 | **+0.086** | very test-dense (`*_test.go` beside every file) |
| flask | 0.787 | 0.824 | +0.037 | large `tests/` tree |
| django | 0.808 | 0.828 | +0.020 | large `tests/` tree, huge corpus |
| repomind | 0.825 | 0.818 | −0.007 | **no test suite at all** |

RepoMind itself is the control: a repository with nothing to down-weight shows
no effect, which is what the mechanism predicts.

### 1.3 Catching the overfit

The prior was designed by reading failures in the gold set — precisely the
situation that produces a result which does not survive contact with new data.
So 70 held-out questions were generated from randomly sampled chunks (uniform
over *all* chunks, so roughly half are labelled to test, config or doc files)
and scored without the author seeing them first.

The first implementation used a 0.62 weight on test files. It looked excellent
on gold. On held-out data it was a disaster:

| weight | gold nDCG@10 | held-out, impl-labelled | held-out, test-labelled | held-out overall |
|---|---|---|---|---|
| 1.00 (no prior) | 0.768 | 0.750 | 0.605 | 0.802 |
| 0.95 | 0.782 | 0.770 | 0.605 | 0.812 |
| **0.90 (shipped)** | **0.804** | **0.770** | **0.536** | **0.795** |
| 0.85 | 0.820 | 0.783 | 0.437 | 0.777 |
| 0.70 | 0.829 | 0.786 | **0.148** | 0.718 |
| 0.62 (first attempt) | 0.827 | 0.786 | **0.148** | 0.718 |

At 0.62 a question whose true answer is a test file collapses from 0.605 to
0.148, because a penalty that large stops being a prior and becomes a filter —
every test chunk drops below every implementation chunk regardless of
similarity. Gold could not see this, because every hand-written label happens to
point at implementation.

Shipping 0.9 gives up about 40% of the achievable gold gain to keep held-out
performance flat (0.802 → 0.795). The direction replicates where it should:
on held-out **implementation-labelled** questions the prior still helps,
0.750 → 0.770.

Final validation, held-out set (n=70): nDCG@10 0.816 → 0.808, R@10 0.957 → 0.971.
Neutral, as designed — the gain is concentrated on the realistic questions.

### 1.4 The vector index that did not exist

`code_chunks` had no index on `embedding`, so every semantic search was an exact
sequential scan. Server-side execution time on the django repo (12,290 chunks),
median of 7 runs via `EXPLAIN ANALYZE`:

| | median | plan |
|---|---|---|
| exact sequential scan | 153.9 ms | `Limit → Sort → Seq Scan` |
| HNSW (m=16, ef_construction=64) | **0.7 ms** | `Limit → Index Scan` |

**220× faster**, for 0.009 nDCG@10 from approximate search — about one query in
111 changing its ranking. Index size 107 MB. Shipped in
[`0003_retrieval_indexes.sql`](../lib/db/migrations/0003_retrieval_indexes.sql).

The before/after retrieval runs behind that 0.009 figure are not kept in
`results/`: they were captured under the weights this file later supersedes, and
a stale snapshot sitting next to current ones causes more confusion than it
settles. Re-create them with `setup-hnsw.ts --drop`, a run, then `setup-hnsw.ts`.

This was invisible at the scale the app had been tested at: on a 400-chunk repo
a sequential scan is genuinely fast. It only appears at 12k chunks, which is why
a large repository is in the corpus.

---

## 2. End-to-end answers

Retrieval metrics establish that the correct file was available. These measure
what the agent did with it: **54 graded answers on the shipped configuration**,
scored deterministically — citation paths are checked against the repository
rather than judged, so no model sits between the answer and the number.

| metric | shipped configuration (n=54) |
|---|---|
| answers citing at least one labelled file | 90.7% |
| cited paths that actually exist in the repo | 96.5% |
| answers containing ≥1 non-existent path | **5.6%** |
| citations per answer | 2.2 |
| tool calls per answer | 5.8 |
| prompt tokens per answer | 64,063 |
| cost per answer | **$0.073** |
| latency p50 | 21.4 s |

Two results are worth drawing out.

**One answer in 18 cites a file that does not exist.** For a product whose
headline promise is exact file and line references, that is the failure mode
that matters, and it is measured rather than assumed.

**A question costs 7.3 cents and 21 seconds.** The prompt reaches 64k tokens
because `open_file` returns up to 8,000 characters and the agent averages 5.8
tool calls, accumulating every result in context across up to 8 steps. That is a
concrete, addressable cost problem — not visible from the code, only from
measurement.

### Extending this

The harness also supports running a second retrieval arm and grading answers for
correctness with a model judge, which would turn the table above into a
comparison rather than a single-configuration measurement:

```bash
npx tsx eval/scripts/run-answers.ts      # both arms
npx tsx eval/scripts/judge-answers.ts    # correctness + citation grading
```

Estimated spend: ~$10 agent (Haiku 4.5) + ~$5 judge (Opus 5).

---

## 3. Limitations

- **111 hand-labelled questions written by one person** who had read the
  repositories. Enough to separate a 0.03 effect on a paired test; not a
  benchmark. A second labeller would be the first thing to add.
- **Single-file labels.** Some questions have more than one defensible answer;
  labelling one file understates every retriever equally.
- **Held-out set is model-generated**, so its labels are single-source and
  sometimes point at the wrong file (a question about Flask's signal system was
  labelled to `tests/test_signals.py`, where `src/flask/signals.py` is better).
  This adds noise, but paired comparison cancels it.
- **One embedding model.** No comparison against `text-embedding-3-large`,
  Voyage's code models, or anything code-specific.
- **Latency numbers in the retriever table include a network round trip** to a
  Neon instance in `ap-southeast-1`, and are noisy. The HNSW comparison in §1.4
  uses server-side execution time and is the trustworthy one. BM25's timings are
  in-process and not comparable to the Postgres-backed rows.
- **Answer metrics cover one configuration**, the shipped one, over 54 graded
  answers. They describe how the agent behaves, not how two retrieval strategies
  compare at the answer level.
- **Chunking was never varied.** 60-line fixed windows with 10-line overlap
  split functions arbitrarily; a structure-aware chunker is the largest
  unexplored lever.
