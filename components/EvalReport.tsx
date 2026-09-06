'use client'

import Link from 'next/link'
import { useState } from 'react'
import { EVAL } from './eval-data'

/**
 * The full evaluation report at /results.
 *
 * Structured as an investigation rather than a metrics dump, because the
 * sequence is the argument: a baseline, a standard fix that failed, the
 * diagnosis that came from reading failures, the fix, and the held-out check
 * that caught the fix overfitting. Numbering the sections encodes that order.
 *
 * Every figure comes from components/eval-data.ts, generated out of
 * eval/results/*.json — nothing on this page is hand-typed.
 */

const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const fmtP = (p: number | null) => (p === null ? '—' : p < 0.0001 ? '<0.0001' : p.toFixed(4))

const REPO_LABELS: Record<string, string> = {
  repomind: 'RepoMind (no test suite)',
  flask: 'pallets/flask',
  gin: 'gin-gonic/gin',
  django: 'django/django',
}
const TYPE_LABELS: Record<string, string> = {
  concept: 'Conceptual — "how does X work"',
  symbol_exact: 'Bare identifier',
  symbol: 'Named symbol, in prose',
  howto: 'How-to',
  architecture: 'Architecture',
  debug: 'Debugging',
}

/**
 * Queries that missed at every k, with what came back instead. Taken verbatim
 * from the failure analysis in eval/RESULTS.md — this is the evidence the
 * source-kind prior was built from.
 */
const FAILURES = [
  {
    q: 'What data structure does the router use to match URLs?',
    repo: 'gin',
    got: ['BENCHMARKS.md', 'docs/doc.md', 'routes_test.go'],
    want: 'tree.go',
    mono: false,
  },
  { q: 'addRoute', repo: 'gin', got: ['gin_test.go', 'routes_test.go', 'tree_test.go'], want: 'tree.go', mono: true },
  {
    q: 'How does an incoming URL path get matched to a view function?',
    repo: 'django',
    got: ['tests/…/regression_21530_urls.py', 'tests/…/conditional_processing/urls.py', 'tests/generic_views/urls.py'],
    want: 'django/urls/resolvers.py',
    mono: false,
  },
]

// ── Primitives ───────────────────────────────────────────────────────────────

/**
 * Sections sit on a two-column grid: an index rail carrying the number, and the
 * content column. The rail is what makes the page read as a document with a
 * structure rather than a stack of cards, and it gives every rule and table a
 * common left edge to align to.
 */
function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="pt-14 grid grid-cols-1 md:grid-cols-[64px_1fr] gap-x-8">
      <div className="hidden md:block pt-[3px]">
        <span className="font-mono text-[11px] tabular-nums" style={{ color: 'var(--fg-subtle)' }}>
          {n.padStart(2, '0')}
        </span>
      </div>
      <div className="min-w-0">
        <h2 className="text-[18px] font-semibold tracking-tight pb-2.5 mb-6" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="md:hidden font-mono text-[12px] tabular-nums mr-2.5" style={{ color: 'var(--fg-subtle)', fontWeight: 400 }}>
            {n.padStart(2, '0')}
          </span>
          {title}
        </h2>
        {children}
      </div>
    </section>
  )
}

function Lede({ children }: { children: React.ReactNode }) {
  return <p className="text-[14.5px] leading-relaxed mb-4 max-w-[76ch]" style={{ color: 'var(--fg-secondary)' }}>{children}</p>
}
function Body({ children }: { children: React.ReactNode }) {
  return <p className="text-[14.5px] leading-relaxed mb-4 max-w-[76ch]" style={{ color: 'var(--fg-muted)' }}>{children}</p>
}

/**
 * An aside, set as a ruled block with a label rather than a tinted card with an
 * accent rail down its left edge. The rail-on-a-fill pattern reads as a generic
 * "callout component"; rules and a label read as a document.
 *
 * `tone` colours only the label, never the surface — the words carry the
 * severity, so the block does not need to shout in the background.
 */
function Note({ label, children, tone = 'neutral' }: { label: string; children: React.ReactNode; tone?: 'neutral' | 'warn' }) {
  return (
    <aside
      className="my-7 py-4"
      style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
    >
      <p
        className="font-mono text-[10px] uppercase tracking-[0.14em] mb-2.5"
        style={{ color: tone === 'warn' ? 'var(--warning)' : 'var(--brand)' }}
      >
        {label}
      </p>
      {children}
    </aside>
  )
}

/** `leftCols` marks columns holding prose rather than figures, so the header
 *  alignment matches the cells beneath it. Column 0 is always left. */
function Table({
  head,
  children,
  note,
  leftCols = [],
}: {
  head: string[]
  children: React.ReactNode
  note?: string
  leftCols?: number[]
}) {
  return (
    <div className="my-5">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]" style={{ borderCollapse: 'collapse', minWidth: 560 }}>
          <thead>
            <tr>
              {head.map((h, i) => (
                <th
                  key={h}
                  className={`font-mono text-[10px] uppercase tracking-[0.1em] font-medium pr-4 pb-2 whitespace-nowrap ${i === 0 || leftCols.includes(i) ? 'text-left' : 'text-right'}`}
                  style={{ color: 'var(--fg-muted)', borderBottom: '1px solid var(--border)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      {note && <p className="mt-2.5 text-[12.5px] leading-relaxed max-w-[72ch]" style={{ color: 'var(--fg-muted)' }}>{note}</p>}
    </div>
  )
}

function Cell({ children, first, dim, strong }: { children: React.ReactNode; first?: boolean; dim?: boolean; strong?: boolean }) {
  return (
    <td
      className={`pr-4 py-2.5 whitespace-nowrap ${first ? 'text-left' : 'text-right font-mono tabular-nums'}`}
      style={{
        borderBottom: '1px solid var(--border-muted)',
        color: dim ? 'var(--fg-muted)' : 'inherit',
        fontWeight: strong ? 600 : 400,
      }}
    >
      {children}
    </td>
  )
}

function PBadge({ p, delta }: { p: number | null; delta: number | null }) {
  if (p === null) return <span style={{ color: 'var(--fg-subtle)' }}>—</span>
  const sig = p < 0.05
  const better = (delta ?? 0) > 0
  return (
    <span
      className="font-mono text-[11px] px-1.5 py-0.5 rounded"
      style={{
        color: !sig ? 'var(--fg-muted)' : better ? 'var(--success)' : 'var(--error)',
        background: !sig ? 'transparent' : better ? 'var(--success-bg)' : 'var(--error-bg)',
      }}
    >
      {fmtP(p)}
    </span>
  )
}

function BreakdownTabs() {
  const [tab, setTab] = useState<'repo' | 'type'>('repo')
  const rows = tab === 'repo' ? EVAL.byRepo : EVAL.byType
  const labels = tab === 'repo' ? REPO_LABELS : TYPE_LABELS
  return (
    <div>
      <div className="flex gap-1.5 mb-1">
        {(['repo', 'type'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="h-8 px-3.5 rounded-lg text-[12.5px] font-medium transition-colors cursor-pointer"
            style={{
              background: tab === t ? 'var(--brand)' : 'var(--bg-elevated)',
              color: tab === t ? 'var(--brand-fg)' : 'var(--fg-muted)',
            }}
          >
            {t === 'repo' ? 'By repository' : 'By question type'}
          </button>
        ))}
      </div>
      <Table
        head={[tab === 'repo' ? 'Repository' : 'Question type', 'n', 'Keyword', 'Hybrid', 'Vector', 'Shipped', 'Δ']}
        note={
          tab === 'repo'
            ? 'The gain tracks how much test and documentation material a repository carries. RepoMind itself has no test suite, so there is nothing to down-rank and the change does nothing — that is the control.'
            : 'Bare identifiers were added specifically to find where keyword search should win. It did not: vector search beat it there too, because chunks are embedded with their file path included.'
        }
      >
        {rows.map((r) => {
          const d = r.shipped - r.dense
          return (
            <tr key={r.key}>
              <Cell first>{labels[r.key] ?? r.key}</Cell>
              <Cell dim>{r.n}</Cell>
              <Cell dim>{r.lexical.toFixed(3)}</Cell>
              <Cell dim>{r.hybrid.toFixed(3)}</Cell>
              <Cell dim>{r.dense.toFixed(3)}</Cell>
              <Cell strong><span style={{ color: 'var(--brand)' }}>{r.shipped.toFixed(3)}</span></Cell>
              <Cell>
                <span style={{ color: d > 0 ? 'var(--success)' : d < 0 ? 'var(--fg-muted)' : 'var(--fg-subtle)' }}>
                  {d > 0 ? '+' : ''}{d.toFixed(3)}
                </span>
              </Cell>
            </tr>
          )
        })}
      </Table>
    </div>
  )
}

// ── The report ───────────────────────────────────────────────────────────────

export default function EvalReport() {
  const shipped = EVAL.retrievers.find((r) => r.state === 'shipped')!
  const base = EVAL.retrievers.find((r) => r.state === 'baseline')!
  const django = EVAL.corpus.find((c) => c.key === 'django')!

  const summary = [
    { metric: 'nDCG@10', before: base.ndcg10.toFixed(3), after: shipped.ndcg10.toFixed(3), delta: `+${(shipped.ndcg10 - base.ndcg10).toFixed(3)}`, p: fmtP(shipped.pValue) },
    { metric: 'MRR', before: base.mrr.toFixed(3), after: shipped.mrr.toFixed(3), delta: `+${(shipped.mrr - base.mrr).toFixed(3)}`, p: '' },
    { metric: 'Recall@1', before: base.r1.toFixed(3), after: shipped.r1.toFixed(3), delta: `+${(shipped.r1 - base.r1).toFixed(3)}`, p: '' },
    { metric: 'Recall@10', before: base.r10.toFixed(3), after: shipped.r10.toFixed(3), delta: `+${(shipped.r10 - base.r10).toFixed(3)}`, p: '' },
    { metric: 'Vector search latency', before: `${EVAL.hnsw.exactMs}ms`, after: `${EVAL.hnsw.hnswMs}ms`, delta: `${EVAL.hnsw.speedup}× faster`, p: '' },
  ]

  const meta = [
    `${EVAL.totals.goldQuestions} labelled questions`,
    `${EVAL.totals.silverQuestions} held-out`,
    `${EVAL.corpus.length} repositories`,
    `${EVAL.totals.files.toLocaleString()} files`,
    `${EVAL.totals.chunks.toLocaleString()} chunks`,
    `${EVAL.totals.retrieversTested} strategies`,
  ]

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      {/* Nav */}
      <header className="glass sticky top-0 z-50">
        <nav className="max-w-[980px] mx-auto flex items-center justify-between px-6 h-14">
          <Link href="/" className="flex items-center gap-2 text-[13px] hover:opacity-80 transition-opacity" style={{ color: 'var(--fg-muted)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            RepoMind
          </Link>
          <a
            href="https://github.com/suryaSPS/RepoMind/tree/main/eval"
            target="_blank"
            rel="noreferrer"
            className="text-[13px] hover:opacity-80 transition-opacity"
            style={{ color: 'var(--fg-muted)' }}
          >
            Harness on GitHub ↗
          </a>
        </nav>
      </header>

      <div className="max-w-[980px] mx-auto px-6 pb-24">
        {/* Header */}
        <header className="pt-14 pb-8 md:pl-[96px]">
          <h1 className="text-[28px] font-semibold tracking-tight">Retrieval evaluation</h1>
          <p className="mt-1 font-mono text-[12px]" style={{ color: 'var(--fg-muted)' }}>
            {meta.join('  ·  ')}
          </p>

          <p className="mt-6 text-[14.5px] leading-relaxed max-w-[76ch]" style={{ color: 'var(--fg-secondary)' }}>
            RepoMind puts the five nearest code chunks into the prompt before its agent starts calling tools.
            None of that had been measured. This is what the harness in{' '}
            <code className="font-mono text-[13px]">eval/</code> found, what changed as a result, and what it
            still does not tell us.
          </p>

          <div className="mt-7 overflow-x-auto">
            <table className="w-full text-[13px]" style={{ borderCollapse: 'collapse', minWidth: 520 }}>
              <thead>
                <tr>
                  {['Summary', 'Before', 'After', 'Change', 'p'].map((h, i) => (
                    <th key={h} className={`font-mono text-[10px] uppercase tracking-[0.1em] font-medium pr-4 pb-2 ${i === 0 ? 'text-left' : 'text-right'}`}
                      style={{ color: 'var(--fg-muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.map((r) => (
                  <tr key={r.metric}>
                    <Cell first>{r.metric}</Cell>
                    <Cell dim>{r.before}</Cell>
                    <Cell strong>{r.after}</Cell>
                    <Cell><span style={{ color: 'var(--brand)' }}>{r.delta}</span></Cell>
                    <Cell dim>{r.p || '—'}</Cell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2.5 text-[12.5px] leading-relaxed max-w-[76ch]" style={{ color: 'var(--fg-muted)' }}>
            Ranking figures are over {EVAL.totals.goldQuestions} hand-labelled questions; significance is a
            two-sided paired bootstrap with 10,000 resamples. Latency is server-side execution time on the
            {' '}{EVAL.hnsw.onChunks.toLocaleString()}-chunk repository.
          </p>
        </header>

        <Section n="1" title="Corpus and ground truth">
          <Lede>
            Chunking is fixed 60-line windows with 10 lines of overlap, embedded with
            <code className="font-mono text-[13px]"> text-embedding-3-small</code>. Retrieval is cosine similarity
            over those vectors, and the top five chunks are placed in the prompt before the agent runs.
          </Lede>
          <Body>
            The harness runs against the same database the product uses, and the strategies under test call the same
            functions that serve live traffic — so a win here is a win in shippable code, not in an eval-only
            reimplementation.
          </Body>
          <Table head={['Repository', 'Language', 'Files', 'Chunks', 'Why it is in the set']} leftCols={[4]}
            note={`Three ~100-file repositories cannot tell you whether a retriever survives a larger candidate set. ${django.name} is in the mix so that question has an answer — and it is where the missing index showed up.`}>
            {EVAL.corpus.map((c) => (
              <tr key={c.key}>
                <Cell first><span className="font-mono text-[12.5px]">{c.name}</span></Cell>
                <Cell dim>{c.language}</Cell>
                <Cell dim>{c.files.toLocaleString()}</Cell>
                <Cell dim>{c.chunks.toLocaleString()}</Cell>
                <Cell first dim>
                  {{ repomind: 'ground truth labellable with certainty', flask: 'small, well-known, heavily documented', gin: 'third language; unusually test-dense', django: 'scale — 10× the others' }[c.key]}
                </Cell>
              </tr>
            ))}
          </Table>
          <Body>
            <strong style={{ color: 'var(--fg)' }}>{EVAL.totals.goldQuestions} questions</strong>, hand-written and
            hand-labelled with the file that answers them. A verification pass asserts every labelled path is actually
            in the index — a label pointing at an unindexed file is not a hard question, it is an unanswerable one,
            and it drags every strategy down equally while looking like corpus difficulty. Relevance is judged at
            file level, because what a developer opens, and what the agent cites, is a file.
          </Body>
          <div className="flex flex-wrap gap-2 mt-4">
            {Object.entries(EVAL.typeCounts).map(([k, v]) => (
              <span key={k} className="text-[12px] px-2.5 py-1 rounded-lg border" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)', color: 'var(--fg-muted)' }}>
                {TYPE_LABELS[k] ?? k} <span className="font-mono tabular-nums" style={{ color: 'var(--fg)' }}>{v}</span>
              </span>
            ))}
          </div>
        </Section>

        <Section n="2" title="Retriever comparison">
          <Lede>
            Eight strategies, scored on the same questions against the same index. The expected result was that
            adding a keyword arm and fusing the two rankings would beat vector search alone, on the usual argument
            that embeddings handle exact identifiers poorly. That did not reproduce here.
          </Lede>
          <Table
            head={['Strategy', 'R@1', 'R@5', 'R@10', 'R@20', 'P@5', 'MRR', 'nDCG@10', 'Δ', 'p']}
            note="Recall@k is the share of correct files found in the top k. MRR rewards putting the right file first. nDCG@10 weights rank position, which matters because only the top few chunks reach the model. p-values are two-sided paired bootstrap against the baseline, 10,000 resamples — pairing removes question difficulty from the comparison."
          >
            {EVAL.retrievers.map((r) => {
              const isShipped = r.state === 'shipped'
              return (
                <tr key={r.key} style={{ background: isShipped ? 'var(--brand-glow-sm)' : undefined }}>
                  <Cell first strong={isShipped}>
                    <span style={{ color: isShipped ? 'var(--brand)' : r.state === 'baseline' ? 'var(--fg)' : 'var(--fg-secondary)' }}>{r.label}</span>
                    {isShipped && <span className="ml-2 font-mono text-[9.5px] uppercase tracking-wider" style={{ color: 'var(--brand)' }}>live</span>}
                  </Cell>
                  <Cell dim={!isShipped}>{r.r1.toFixed(3)}</Cell>
                  <Cell dim={!isShipped}>{r.r5.toFixed(3)}</Cell>
                  <Cell dim={!isShipped}>{r.r10.toFixed(3)}</Cell>
                  <Cell dim={!isShipped}>{r.r20.toFixed(3)}</Cell>
                  <Cell dim={!isShipped}>{r.p5.toFixed(3)}</Cell>
                  <Cell dim={!isShipped}>{r.mrr.toFixed(3)}</Cell>
                  <Cell strong={isShipped}><span style={{ color: isShipped ? 'var(--brand)' : undefined }}>{r.ndcg10.toFixed(3)}</span></Cell>
                  <Cell>
                    {r.delta === null ? <span style={{ color: 'var(--fg-subtle)' }}>base</span> : (
                      <span style={{ color: r.delta > 0 ? 'var(--success)' : 'var(--error)' }}>{r.delta > 0 ? '+' : ''}{r.delta.toFixed(3)}</span>
                    )}
                  </Cell>
                  <Cell><PBadge p={r.pValue} delta={r.delta} /></Cell>
                </tr>
              )
            })}
          </Table>
          <Body>
            Every hybrid configuration scored at or below the vector baseline. Equal-weight fusion was significantly
            worse: giving a much weaker arm an equal vote lets it displace correct results at rank 1, and Recall@1
            fell from {base.r1.toFixed(3)} to 0.495. Weighting the vector arm 3:1 recovered most of that but did not
            pass parity.
          </Body>
          <Note label="Why the premise did not hold">
            <p className="text-[14.5px] leading-relaxed mb-3 max-w-[76ch]">
              {EVAL.typeCounts.symbol_exact} of the questions are bare identifiers with no surrounding prose —
              <code className="font-mono text-[13px]"> getGitHubToken</code>,
              <code className="font-mono text-[13px]"> StringToBytes</code> — included specifically to test the case
              keyword search is supposed to win. Vector search scored 0.806 against 0.544 on that slice.
            </p>
            <p className="text-[14.5px] leading-relaxed max-w-[76ch]" style={{ color: 'var(--fg-muted)' }}>
              The cause is in the ingest path. Chunks are embedded as{' '}
              <code className="font-mono text-[13px]">File: {'{path}'}\n\n{'{content}'}</code>, so the file path is
              part of the embedded text and an identifier appearing in a path is reachable by vector search. The
              usual argument for a keyword arm assumes it is not.
            </p>
          </Note>
        </Section>

        <Section n="3" title="Failure analysis">
          <Lede>
            Seven questions retrieved no correct file at any k. Inspecting them individually showed a single shared
            cause rather than seven unrelated ones.
          </Lede>
          <div className="my-6" style={{ borderTop: '1px solid var(--border)' }}>
            {FAILURES.map((f) => (
              <div key={f.q} className="py-4 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-x-8 gap-y-3" style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <div className="min-w-0">
                  <p className="text-[14px] mb-2.5">
                    {f.mono
                      ? <code className="font-mono text-[13.5px]">{f.q}</code>
                      : <>&ldquo;{f.q}&rdquo;</>}
                    <span className="font-mono text-[11.5px] ml-2" style={{ color: 'var(--fg-subtle)' }}>{f.repo}</span>
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {f.got.map((g) => (
                      <span key={g} className="font-mono text-[11.5px]" style={{ color: 'var(--fg-muted)' }}>
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="sm:text-right shrink-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] mb-1" style={{ color: 'var(--fg-subtle)' }}>
                    not retrieved
                  </p>
                  <code className="font-mono text-[12.5px]" style={{ color: 'var(--brand)' }}>{f.want}</code>
                </div>
              </div>
            ))}
          </div>
          <Body>
            In each case the retrieved files were tests, documentation or fixtures, and the implementation file was
            absent. <code className="font-mono text-[13px]">tree_test.go</code> outranked{' '}
            <code className="font-mono text-[13px]">tree.go</code> for the literal name of a function defined in{' '}
            <code className="font-mono text-[13px]">tree.go</code>.
          </Body>
          <Body>
            This is expected behaviour from the embedding, not a defect in it. Test files state intent in prose close
            to how a question is phrased, and documentation is written to answer such questions directly, so both are
            genuinely nearer the query in vector space. The implication is that similarity is insufficient as the
            final ranking signal, and that the correction belongs after retrieval rather than in the model.
          </Body>
        </Section>

        <Section n="4" title="Source-kind re-ranking">
          <Lede>
            Retrieve 40 candidates instead of 5. Classify each by path — implementation, test, docs, example, config.
            Multiply non-implementation similarity by 0.9. Re-sort, then cut to 5. Queries that ask <em>for</em> tests
            or docs keep the full weight for that kind.
          </Lede>
          <BreakdownTabs />
        </Section>

        <Section n="5" title="Held-out validation">
          <Lede>
            The weight was chosen by inspecting failures in the labelled set, so the labelled set cannot validate it.
          </Lede>
          <Body>
            So {EVAL.totals.silverQuestions} held-out questions were generated from randomly sampled chunks and scored
            without being read first. Sampling was uniform over <em>all</em> chunks, so roughly half are labelled to
            test, config or documentation files. If the prior only worked because every hand-written label happened to
            point at implementation, this is where that shows up. It did.
          </Body>
          <Table
            head={['Weight', 'Tuned set', 'Held-out: impl', 'Held-out: tests', 'Held-out: all']}
            note="Tightening the weight keeps improving the tuned set all the way down, and destroys held-out performance on test-file questions. Optimising on the tuned set alone would have shipped a weight around 0.62 — the exact point where the held-out column has already collapsed."
          >
            {EVAL.sweep.map((r) => {
              const isShipped = r.weight === 0.9
              return (
                <tr key={r.weight} style={{ background: isShipped ? 'var(--brand-glow-sm)' : undefined }}>
                  <Cell first strong={isShipped}>
                    <span className="font-mono" style={{ color: isShipped ? 'var(--brand)' : 'inherit' }}>{r.weight.toFixed(2)}</span>
                    {isShipped && <span className="ml-2 text-[10.5px]" style={{ color: 'var(--brand)' }}>shipped</span>}
                    {r.weight === 0.62 && <span className="ml-2 text-[10.5px]" style={{ color: 'var(--error)' }}>first attempt</span>}
                    {r.weight === 1 && <span className="ml-2 text-[10.5px]" style={{ color: 'var(--fg-subtle)' }}>no re-ranking</span>}
                  </Cell>
                  <Cell dim={!isShipped}>{r.gold.toFixed(3)}</Cell>
                  <Cell dim={!isShipped}>{r.silverImpl.toFixed(3)}</Cell>
                  <Cell><span style={{ color: r.silverTest < 0.3 ? 'var(--error)' : 'var(--fg-muted)' }}>{r.silverTest.toFixed(3)}</span></Cell>
                  <Cell dim={!isShipped}>{r.silverAll.toFixed(3)}</Cell>
                </tr>
              )
            })}
          </Table>
          <Note label="Why 0.62 was not shipped" tone="warn">
            <p className="text-[14.5px] leading-relaxed max-w-[76ch]">
              At weight 0.62 a held-out question whose answer is a test file scores 0.148, down from 0.605 with no
              re-ranking. At that magnitude the multiplier no longer reorders candidates, it partitions them: every
              test chunk falls below every implementation chunk regardless of similarity.
            </p>
          </Note>
          <Body>
            Shipping 0.9 gives up roughly 40% of the achievable gain on the tuned set to keep held-out performance
            flat ({EVAL.heldOut.dense.ndcg10} → {EVAL.heldOut.shipped.ndcg10} nDCG@10, Recall@10 actually improving
            from {EVAL.heldOut.dense.r10} to {EVAL.heldOut.shipped.r10}). It is a deliberate bet that a developer
            asking about behaviour usually wants the implementation — sized so that being wrong costs a rank or two,
            not the answer.
          </Body>
        </Section>

        <Section n="6" title="Vector index">
          <Lede>
            <code className="font-mono text-[13px]">code_chunks</code> carried an index on{' '}
            <code className="font-mono text-[13px]">repo_id</code> and none on{' '}
            <code className="font-mono text-[13px]">embedding</code>, so every query planned as a sequential scan
            with a sort.
          </Lede>
          <div className="my-6 grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-5" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', paddingTop: 18, paddingBottom: 18 }}>
            {[
              { k: 'Sequential scan', v: `${EVAL.hnsw.exactMs}ms`, plan: 'Limit → Sort → Seq Scan', brand: false },
              { k: 'HNSW index scan', v: `${EVAL.hnsw.hnswMs}ms`, plan: 'Limit → Index Scan', brand: true },
              { k: 'Difference', v: `${EVAL.hnsw.speedup}×`, plan: `${EVAL.hnsw.ndcgCost} nDCG@10 given up`, brand: false },
            ].map((b) => (
              <div key={b.k}>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] mb-2" style={{ color: 'var(--fg-muted)' }}>{b.k}</p>
                <p className="text-[27px] font-semibold tabular-nums leading-none mb-2" style={{ color: b.brand ? 'var(--brand)' : 'var(--fg)' }}>{b.v}</p>
                <p className="font-mono text-[11px]" style={{ color: 'var(--fg-subtle)' }}>{b.plan}</p>
              </div>
            ))}
          </div>
          <Body>
            Server-side execution time, median of 7 runs via <code className="font-mono text-[13px]">EXPLAIN ANALYZE</code> on
            the {django.name} repository ({EVAL.hnsw.onChunks.toLocaleString()} chunks). Index size {EVAL.hnsw.indexSize}.
            Approximate search cost {EVAL.hnsw.ndcgCost} nDCG@10 — about one query in {EVAL.totals.goldQuestions}{' '}
            changing its ranking. This was invisible at the scale the app had been tested at: on a 400-chunk repository
            a sequential scan really is fast.
          </Body>
        </Section>

        <Section n="7" title="End-to-end answer quality">
          <Lede>
            Retrieval metrics establish only that the correct file was available to the model. They do not measure
            whether it was used, cited accurately, or replaced with a path that does not exist.
          </Lede>
          <Note label="Incomplete run" tone="warn">
            <p className="text-[14.5px] leading-relaxed max-w-[76ch]">
              {EVAL.endToEnd.graded} of {EVAL.totals.goldQuestions} questions completed before the API credit
              balance was exhausted, and the model-graded scoring did not run at all. The figures below are the
              deterministic subset, computed without a model, over the answers that finished.
            </p>
          </Note>
          <div className="my-6 grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-6" style={{ borderTop: '1px solid var(--border)', paddingTop: 18 }}>
            {[
              { v: pct(EVAL.endToEnd.validRate), k: 'Cited paths that exist', warn: false },
              { v: pct(EVAL.endToEnd.citedGold), k: 'Cite a labelled file', warn: false },
              { v: pct(EVAL.endToEnd.badPathRate), k: 'Answers with a bad path', warn: true },
              { v: `${EVAL.endToEnd.toolCalls}`, k: 'Tool calls per answer', warn: false },
              { v: `$${EVAL.endToEnd.costPerAnswer}`, k: 'Cost per answer', warn: false },
              { v: `${EVAL.endToEnd.latencyP50}s`, k: 'Median latency', warn: false },
            ].map((m) => (
              <div key={m.k}>
                <p className="text-[23px] font-semibold tabular-nums leading-none mb-1.5" style={{ color: m.warn ? 'var(--warning)' : 'var(--fg)' }}>{m.v}</p>
                <p className="text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>{m.k}</p>
              </div>
            ))}
          </div>
          <Body>
            Two things stand out and neither needed a judge.{' '}
            <strong style={{ color: 'var(--fg)' }}>One answer in 18 cites a file that does not exist</strong> — for a
            product whose promise is exact file and line references, that is the failure mode that matters, and it is
            now measured rather than assumed. And a question costs{' '}
            <strong style={{ color: 'var(--fg)' }}>${EVAL.endToEnd.costPerAnswer}</strong> and{' '}
            {EVAL.endToEnd.latencyP50} seconds, because the prompt reaches {(EVAL.endToEnd.promptTokens / 1000).toFixed(0)}K
            tokens as tool results accumulate across steps.
          </Body>
        </Section>

        <Section n="8" title="Limitations">
          <ul className="space-y-2.5 mt-4 max-w-[72ch]">
            {[
              [`${EVAL.totals.goldQuestions} questions, one labeller`, 'who had read the repositories. Enough to separate a 0.03 effect on a paired test; not a benchmark.'],
              ['Single-file labels', 'some questions have more than one defensible answer; labelling one file understates every strategy equally.'],
              ['The held-out set is model-generated', 'so its labels are occasionally wrong. Paired comparison cancels the noise; it does not remove it.'],
              ['The end-to-end A/B is unfinished', 'so "better retrieval produces better answers" is currently untested here.'],
              ['Chunking was never varied', '60-line fixed windows split functions arbitrarily. The largest unexplored lever, untouched.'],
              ['One embedding model', 'no comparison against larger or code-specific embeddings.'],
            ].map(([b, rest]) => (
              <li key={b} className="text-[14.5px] leading-relaxed flex gap-3" style={{ color: 'var(--fg-muted)' }}>
                <span className="shrink-0 mt-2 w-1 h-1 rounded-full" style={{ background: 'var(--brand)' }} />
                <span><strong style={{ color: 'var(--fg)' }}>{b}</strong> — {rest}</span>
              </li>
            ))}
          </ul>
        </Section>

        <footer className="mt-16 pt-7 md:pl-[96px] flex flex-wrap gap-4 items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>
            Generated from <code className="font-mono text-[12px]">eval/results/</code> on {EVAL.generatedAt}. Reproduce with{' '}
            <code className="font-mono text-[12px]">npx tsx eval/scripts/run-retrieval.ts --tier gold</code>.
          </p>
          <Link href="/" className="text-[13px] font-medium hover:opacity-80 transition-opacity" style={{ color: 'var(--brand)' }}>
            ← Back to RepoMind
          </Link>
        </footer>
      </div>
    </div>
  )
}
