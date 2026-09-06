'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { EVAL } from './eval-data'

/**
 * Public landing page — shown at `/` to logged-out visitors.
 * Cinematic layer: 3D-tilted hero mock with depth-layered floating cards,
 * ambient glow blobs, orchestrated load sequence, scroll-triggered reveals.
 * All motion is transform/opacity only; prefers-reduced-motion disables it.
 */
export default function LandingPage() {
  // Scroll-triggered reveals
  useEffect(() => {
    const els = document.querySelectorAll('.landing .reveal')
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) {
            en.target.classList.add('in')
            io.unobserve(en.target)
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -48px 0px' }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <div className="landing min-h-screen overflow-x-clip" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      {/* ─── Nav ─── */}
      <header className="glass sticky top-0 z-50">
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-5 h-14">
          <div className="flex items-center gap-2.5">
            <LogoMark size={30} />
            <span className="font-semibold text-[15px]">RepoMind</span>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-sm" style={{ color: 'var(--fg-muted)' }}>
            <a href="#features" className="hover:opacity-80 transition-opacity">What it does</a>
            <a href="#results" className="hover:opacity-80 transition-opacity">Results</a>
            <a href="#why" className="hover:opacity-80 transition-opacity">Why</a>
            <a href="#how" className="hover:opacity-80 transition-opacity">How it works</a>
          </div>
          <Link
            href="/login"
            className="press h-8 px-3.5 flex items-center rounded-lg text-sm font-medium btn-lift cursor-pointer"
            style={{ background: 'var(--brand)', color: 'var(--brand-fg)' }}
          >
            Sign in
          </Link>
        </nav>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative">
        {/* atmosphere: grid floor + drifting glow blobs */}
        <div aria-hidden className="grid-floor absolute inset-x-0 top-0 h-[560px] pointer-events-none" />
        <div
          aria-hidden
          className="blob w-[420px] h-[420px] -top-32 left-[12%]"
          style={{ background: 'var(--brand-glow)' }}
        />
        <div
          aria-hidden
          className="blob w-[360px] h-[360px] top-40 right-[8%]"
          style={{ background: 'var(--brand-glow-sm)', animationDelay: '-9s' }}
        />

        <div className="relative max-w-6xl mx-auto px-5 pt-20 pb-24 text-center">
          <div
            className="chip-pop inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6 border"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-card)', color: 'var(--fg-secondary)', ['--d' as string]: '0s' }}
          >
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inline-flex w-full h-full rounded-full opacity-60" style={{ background: 'var(--brand)', animation: 'pulse-dot 2s infinite' }} />
              <span className="relative inline-flex w-1.5 h-1.5 rounded-full" style={{ background: 'var(--brand)' }} />
            </span>
            AI Code Archaeologist
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-semibold tracking-tight leading-[1.05] max-w-4xl mx-auto">
            <span className="line-mask block">
              <span className="line-rise" style={{ ['--d' as string]: '0.08s' }}>Ask any codebase</span>
            </span>
            <span className="line-mask block">
              <span className="line-rise gradient-text pb-2" style={{ ['--d' as string]: '0.18s' }}>anything.</span>
            </span>
          </h1>

          <p
            className="chip-pop mt-6 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed"
            style={{ color: 'var(--fg-muted)', ['--d' as string]: '0.35s' }}
          >
            Drop in a GitHub repo URL and get an AI agent that answers questions, traces bugs,
            and explains decisions — every answer cited to exact files and line numbers.
          </p>

          <div className="chip-pop mt-9 flex items-center justify-center gap-3" style={{ ['--d' as string]: '0.45s' }}>
            <Link
              href="/login"
              className="press h-11 px-6 flex items-center gap-2 rounded-lg text-sm font-medium btn-lift cursor-pointer"
              style={{ background: 'var(--brand)', color: 'var(--brand-fg)', boxShadow: 'var(--shadow-brand)' }}
            >
              Try it now
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
            <a
              href="#how"
              className="press h-11 px-6 flex items-center rounded-lg text-sm font-medium border transition-colors cursor-pointer"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--fg-secondary)', background: 'var(--bg-card)' }}
            >
              See how it works
            </a>
          </div>

          <HeroMock />
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="max-w-6xl mx-auto px-5 py-24 scroll-mt-16">
        <div className="reveal">
          <SectionHeading
            kicker="What you get"
            title="A repo you can talk to"
            sub="RepoMind indexes the code and its history, then puts an agent on top that navigates it the way a senior developer would."
          />
        </div>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="reveal" style={{ ['--d' as string]: `${(i % 3) * 0.1}s` }}>
              <FeatureCard {...f} />
            </div>
          ))}
        </div>
      </section>

      <ResultsSection />

      {/* ─── Why ─── */}
      <section
        id="why"
        className="relative scroll-mt-16 overflow-hidden"
        style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
      >
        <div
          aria-hidden
          className="blob w-[380px] h-[380px] -bottom-40 -left-24"
          style={{ background: 'var(--brand-glow-sm)', animationDelay: '-5s' }}
        />
        <div className="relative max-w-6xl mx-auto px-5 py-24 grid lg:grid-cols-2 gap-12 items-start">
          <div className="reveal">
            <SectionHeading
              kicker="Why it exists"
              title="Code answers “what”. It never answers “why”."
              align="left"
            />
            <p className="mt-5 leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
              Onboarding onto an unfamiliar codebase takes weeks. The reasons behind the code —
              why the auth system was refactored, why that timeout is 30 seconds — live in old
              pull requests, commit messages, and the heads of people who may have left.
            </p>
            <p className="mt-4 leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
              <code>grep</code> can find a string. It can&apos;t explain a decision. RepoMind was built to
              recover that context: it reads the code <em>and</em> its history, so the answer to
              “why is this here?” comes with receipts.
            </p>
          </div>
          <div className="space-y-3">
            {WHY_ROWS.map((w, i) => (
              <div key={w.title} className="reveal" style={{ ['--d' as string]: `${i * 0.12}s` }}>
                <WhyRow {...w} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section id="how" className="max-w-6xl mx-auto px-5 py-24 scroll-mt-16">
        <div className="reveal">
          <SectionHeading
            kicker="How it works"
            title="Three steps to a conversation"
            sub="No config files, no setup scripts. Paste a URL and start asking."
          />
        </div>
        <div className="mt-12 grid md:grid-cols-3 gap-4">
          <div className="reveal" style={{ ['--d' as string]: '0s' }}>
            <StepCard n={1} title="Paste a GitHub URL" desc="Any public repository works — from a weekend project to a monorepo.">
              <div
                className="flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-mono border"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--fg-muted)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                <span className="truncate">github.com/vercel/next.js</span>
              </div>
            </StepCard>
          </div>
          <div className="reveal" style={{ ['--d' as string]: '0.12s' }}>
            <StepCard n={2} title="Watch it index" desc="The repo is cloned, chunked, embedded, and stored — with live progress as it happens.">
              <div className="space-y-2">
                <div className="flex justify-between text-xs" style={{ color: 'var(--fg-muted)' }}>
                  <span>Embedding chunks…</span>
                  <span className="font-mono">72%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                  <div className="h-full w-[72%] rounded-full progress-bar-glow" />
                </div>
              </div>
            </StepCard>
          </div>
          <div className="reveal" style={{ ['--d' as string]: '0.24s' }}>
            <StepCard n={3} title="Ask anything" desc="Architecture, history, bugs, conventions — with citations you can open inline.">
              <div className="flex flex-wrap gap-1.5">
                {['How is auth implemented?', 'Why was this refactored?', 'Where are DB connections handled?'].map((q) => (
                  <span
                    key={q}
                    className="px-2 py-1 rounded-md text-[11px] border"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--fg-secondary)' }}
                  >
                    {q}
                  </span>
                ))}
              </div>
            </StepCard>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="max-w-6xl mx-auto px-5 pb-28">
        <div
          className="reveal relative overflow-hidden rounded-2xl border px-6 py-16 text-center"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div aria-hidden className="grid-floor absolute inset-0 pointer-events-none" />
          <div
            aria-hidden
            className="blob w-[300px] h-[300px] -top-32 left-1/2 -translate-x-1/2"
            style={{ background: 'var(--brand-glow)' }}
          />
          <h2 className="relative text-2xl sm:text-4xl font-semibold tracking-tight">
            Point RepoMind at your codebase
          </h2>
          <p className="relative mt-3 text-sm sm:text-base max-w-md mx-auto" style={{ color: 'var(--fg-muted)' }}>
            Sign in with GitHub or Google and index your first repo in minutes.
          </p>
          <Link
            href="/login"
            className="press relative inline-flex items-center gap-2 mt-8 h-11 px-7 rounded-lg text-sm font-medium btn-lift cursor-pointer"
            style={{ background: 'var(--brand)', color: 'var(--brand-fg)', boxShadow: 'var(--shadow-brand)' }}
          >
            Get started
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between text-xs" style={{ color: 'var(--fg-muted)' }}>
          <div className="flex items-center gap-2">
            <LogoMark size={22} />
            <span>RepoMind — AI Code Archaeologist</span>
          </div>
          <Link href="/login" className="hover:opacity-80 transition-opacity cursor-pointer">Sign in</Link>
        </div>
      </footer>
    </div>
  )
}

/* ═══ Data ═══ */

const FEATURES = [
  {
    icon: <path d="M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM21 21l-4.35-4.35" />,
    title: 'Semantic code search',
    desc: 'Finds relevant code by meaning, not keywords. Ask “where do we validate sessions?” without knowing a single function name.',
  },
  {
    icon: <><circle cx="12" cy="12" r="3" /><path d="M12 3v6M12 15v6M5.6 5.6l4.3 4.3M14.1 14.1l4.3 4.3" /></>,
    title: 'Git history tracing',
    desc: '“Why was this changed?” answered with actual commit context — authors, messages, and the diffs behind a decision.',
  },
  {
    icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="15" x2="15" y2="15" /></>,
    title: 'Cited answers',
    desc: 'Every claim links to the exact file path and line numbers it came from. Click a citation to read the source in place.',
  },
  {
    icon: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    title: 'Agentic navigation',
    desc: 'The agent calls search_code, open_file, grep_repo, and get_commit — exploring the repo like a developer, not a chatbot.',
  },
  {
    icon: <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
    title: 'Live streaming',
    desc: 'Tokens appear as the agent reasons through the codebase, with its tool calls shown in real time. No spinners, no waiting blind.',
  },
  {
    icon: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
    title: 'Private workspaces',
    desc: 'Sign in with GitHub, Google, or a username. Your indexed repos and chat history stay private to your account.',
  },
]

const WHY_ROWS = [
  {
    title: 'For new team members',
    desc: 'Skip the two-week archaeology phase. Ask the repo directly how auth works, where requests enter, and what the folder structure means.',
  },
  {
    title: 'For debugging',
    desc: 'Trace a bug back through the commits that touched the code, with the agent connecting the change to the behavior.',
  },
  {
    title: 'For open-source exploration',
    desc: 'Point it at any public repo — Next.js, your favorite library — and interrogate how it really works under the hood.',
  },
]

/* ═══ Pieces ═══ */

function LogoMark({ size }: { size: number }) {
  return (
    <div
      className="rounded-lg flex items-center justify-center shrink-0"
      style={{ width: size, height: size, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <svg
        width={size * 0.55}
        height={size * 0.55}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: 'var(--brand)' }}
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    </div>
  )
}

function SectionHeading({
  kicker,
  title,
  sub,
  align = 'center',
}: {
  kicker: string
  title: string
  sub?: string
  align?: 'center' | 'left'
}) {
  const centered = align === 'center'
  return (
    <div className={centered ? 'text-center' : ''}>
      <p className="text-xs font-semibold uppercase tracking-widest font-mono" style={{ color: 'var(--brand)' }}>
        {kicker}
      </p>
      <h2 className="mt-2 text-2xl sm:text-4xl font-semibold tracking-tight">{title}</h2>
      {sub && (
        <p className={`mt-3 text-sm sm:text-base leading-relaxed ${centered ? 'max-w-xl mx-auto' : ''}`} style={{ color: 'var(--fg-muted)' }}>
          {sub}
        </p>
      )}
    </div>
  )
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
  }
  return (
    <div
      onMouseMove={onMove}
      className="spot-card h-full rounded-xl border p-5 transition-transform duration-300 hover:-translate-y-1"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center mb-3.5"
        style={{ background: 'var(--brand-glow-sm)', border: '1px solid var(--border)' }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand)' }}>
          {icon}
        </svg>
      </div>
      <h3 className="text-sm font-semibold mb-1.5">{title}</h3>
      <p className="text-[13px] leading-relaxed" style={{ color: 'var(--fg-muted)' }}>{desc}</p>
    </div>
  )
}

function WhyRow({ title, desc }: { title: string; desc: string }) {
  return (
    <div
      className="rounded-xl border p-4 flex gap-3 transition-transform duration-300 hover:-translate-y-0.5"
      style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" style={{ color: 'var(--brand)' }}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed" style={{ color: 'var(--fg-muted)' }}>{desc}</p>
      </div>
    </div>
  )
}

function StepCard({ n, title, desc, children }: { n: number; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="h-full rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2.5 mb-3">
        <span
          className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold"
          style={{ background: 'var(--brand)', color: 'var(--brand-fg)' }}
        >
          {n}
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-[13px] leading-relaxed mb-4" style={{ color: 'var(--fg-muted)' }}>{desc}</p>
      {children}
    </div>
  )
}

/**
 * Signature element: a 3D perspective-tilted mock of the chat UI that follows
 * the cursor, with citation/commit cards floating at different depths around it.
 * Load choreography: window rises → question pops → tool chips stagger in →
 * answer streams line by line → floating cards drift up last.
 */
function HeroMock() {
  const stageRef = useRef<HTMLDivElement>(null)
  const reduced = useRef(false)

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduced.current) return
    const el = stageRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--ry', `${(x * 7).toFixed(2)}deg`)
    el.style.setProperty('--rx', `${(9 - y * 7).toFixed(2)}deg`)
  }

  function onLeave() {
    const el = stageRef.current
    if (!el) return
    el.style.setProperty('--ry', '0deg')
    el.style.setProperty('--rx', '9deg')
  }

  return (
    <div
      ref={stageRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="tilt-stage chip-pop relative mt-16 max-w-3xl mx-auto text-left"
      style={{ ['--d' as string]: '0.6s' }}
    >
      <div className="tilt-body relative">
        {/* glow under the window */}
        <div
          aria-hidden
          className="absolute -inset-x-8 -bottom-10 h-32 pointer-events-none"
          style={{ background: 'radial-gradient(50% 100% at 50% 100%, var(--brand-glow), transparent 70%)', filter: 'blur(20px)' }}
        />

        <div
          className="relative rounded-xl border overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-strong)', boxShadow: 'var(--shadow-lg)' }}
        >
          {/* window chrome */}
          <div
            className="flex items-center gap-2 px-4 h-9 border-b"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#f87171' }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#fbbf24' }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#34d399' }} />
            <span className="ml-3 text-[11px] font-mono truncate" style={{ color: 'var(--fg-muted)' }}>
              repomind — vercel/next.js
            </span>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            {/* user question */}
            <div className="flex justify-end">
              <div
                className="chip-pop max-w-[85%] px-3.5 py-2.5 rounded-xl rounded-br-sm text-[13px]"
                style={{ background: 'var(--brand-glow)', color: 'var(--fg-secondary)', border: '1px solid var(--border)', ['--d' as string]: '1s' }}
              >
                Why was the auth system refactored in March?
              </div>
            </div>

            {/* tool calls, staggered */}
            <div className="flex flex-wrap items-center gap-1.5">
              {['search_code("auth refactor")', 'get_commit(a1b2c3f)', 'open_file(lib/auth.ts)'].map((t, i) => (
                <span
                  key={t}
                  className="chip-pop px-2 py-1 rounded-md text-[10.5px] font-mono border"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--fg-muted)', ['--d' as string]: `${1.25 + i * 0.18}s` }}
                >
                  {t}
                </span>
              ))}
              <span className="chip-pop flex items-end gap-[3px] h-3.5 ml-1" style={{ ['--d' as string]: '1.8s' }} aria-hidden>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className="wave-bar h-full" style={{ background: 'var(--brand)' }} />
                ))}
              </span>
            </div>

            {/* assistant answer, streaming in line by line */}
            <div
              className="chip-pop max-w-[92%] px-3.5 py-3 rounded-xl rounded-bl-sm text-[13px] leading-relaxed"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--fg-secondary)', ['--d' as string]: '2s' }}
            >
              <span className="stream-line block" style={{ ['--d' as string]: '2.2s' }}>
                The refactor in commit <code>a1b2c3f</code> replaced session tokens stored in
                localStorage with httpOnly cookies after a security review.
              </span>
              <span className="stream-line block mt-1.5" style={{ ['--d' as string]: '2.7s' }}>
                The commit message and linked PR cite CSRF hardening as the driver — the new flow lives in{' '}
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[11px] align-middle"
                  style={{ background: 'var(--brand-glow-sm)', color: 'var(--brand)', border: '1px solid var(--border)' }}
                >
                  lib/auth.ts:42–88
                </span>
                <span
                  aria-hidden
                  className="inline-block w-[7px] h-[14px] ml-1 align-middle rounded-[1px]"
                  style={{ background: 'var(--brand)', animation: 'pulse-dot 1.1s infinite' }}
                />
              </span>
            </div>
          </div>
        </div>

        {/* depth-layered floating cards (desktop only) —
            entrance (chip-pop) on wrapper, float loop on inner card so the
            two `animation` shorthands never collide */}
        <div className="chip-pop hidden md:block absolute -left-24 top-16" style={{ ['--d' as string]: '2.9s' }}>
          <div
            className="float-card glass rounded-lg px-3 py-2.5 border"
            style={{ borderColor: 'var(--border-strong)', boxShadow: 'var(--shadow-md)', ['--z' as string]: '60px', ['--fd' as string]: '0s' }}
          >
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--brand)' }}>
                <circle cx="12" cy="12" r="3" /><path d="M12 3v6M12 15v6" />
              </svg>
              <span style={{ color: 'var(--fg-secondary)' }}>a1b2c3f</span>
            </div>
            <p className="mt-1 text-[10.5px] max-w-[160px]" style={{ color: 'var(--fg-muted)' }}>
              refactor: move sessions to httpOnly cookies
            </p>
          </div>
        </div>

        <div className="chip-pop hidden md:block absolute -right-20 top-32" style={{ ['--d' as string]: '3.1s' }}>
          <div
            className="float-card glass rounded-lg px-3 py-2 border flex items-center gap-1.5"
            style={{ borderColor: 'var(--border-strong)', boxShadow: 'var(--shadow-md)', ['--z' as string]: '80px', ['--fd' as string]: '-2s' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--brand)' }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="text-[11px] font-mono" style={{ color: 'var(--brand)' }}>lib/auth.ts:42</span>
          </div>
        </div>

        <div className="chip-pop hidden md:block absolute -right-14 -top-6" style={{ ['--d' as string]: '3.3s' }}>
          <div
            className="float-card glass rounded-lg px-3 py-2 border flex items-center gap-1.5"
            style={{ borderColor: 'var(--border-strong)', boxShadow: 'var(--shadow-md)', ['--z' as string]: '40px', ['--fd' as string]: '-4s' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)' }} />
            <span className="text-[11px] font-mono" style={{ color: 'var(--fg-secondary)' }}>1,284 chunks indexed</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Evaluation teaser ──────────────────────────────────────────────────────
   A short proof panel; the full report lives at /results. Figures come from
   components/eval-data.ts, generated out of eval/results/*.json.
   ─────────────────────────────────────────────────────────────────────────── */

function ResultsSection() {
  const shipped = EVAL.retrievers.find((r) => r.state === 'shipped')!
  const base = EVAL.retrievers.find((r) => r.state === 'baseline')!
  const gain = ((shipped.ndcg10 - base.ndcg10) / base.ndcg10) * 100

  const tiles = [
    { v: `+${gain.toFixed(1)}%`, k: 'Ranking quality', d: `nDCG@10 ${base.ndcg10} → ${shipped.ndcg10}, p = 0.0008` },
    { v: `${EVAL.hnsw.speedup}×`, k: 'Faster vector search', d: `${EVAL.hnsw.exactMs}ms → ${EVAL.hnsw.hnswMs}ms server-side` },
    { v: `${EVAL.totals.retrieversTested}`, k: 'Strategies compared', d: 'same questions, same index' },
    { v: `${EVAL.totals.goldQuestions}`, k: 'Hand-labelled questions', d: `${EVAL.corpus.length} repos, 3 languages` },
  ]

  return (
    <section
      id="results"
      className="relative scroll-mt-16 overflow-hidden"
      style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
    >
      <div aria-hidden className="blob w-[380px] h-[380px] -top-28 -right-20" style={{ background: 'var(--brand-glow-sm)', animationDelay: '-3s' }} />

      <div className="relative max-w-6xl mx-auto px-5 py-24">
        <div className="reveal">
          <SectionHeading
            kicker="How well it works"
            title="Every retrieval change here was measured"
            sub={`${EVAL.totals.goldQuestions} hand-labelled questions across ${EVAL.corpus.length} repositories, ${EVAL.totals.retrieversTested} retrieval strategies scored on the same index, with significance testing. The full report is one click away.`}
          />
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {tiles.map((t, i) => (
            <div
              key={t.k}
              className="reveal rounded-xl border p-5 transition-transform duration-300 hover:-translate-y-1"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)', ['--d' as string]: `${(i % 4) * 0.08}s` }}
            >
              <p className="text-[28px] leading-none font-semibold tracking-tight tabular-nums" style={{ color: 'var(--brand)' }}>{t.v}</p>
              <h3 className="mt-2.5 text-[13.5px] font-semibold">{t.k}</h3>
              <p className="mt-1 text-[12px] leading-relaxed" style={{ color: 'var(--fg-muted)' }}>{t.d}</p>
            </div>
          ))}
        </div>

        <div
          className="reveal mt-3 rounded-xl border p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center gap-6 justify-between"
          style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
        >
          <div className="max-w-[62ch]">
            <h3 className="text-[15px] font-semibold">Hybrid keyword search was measured and rejected</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
              The standard recommendation for RAG scored below plain vector search on every variant. What helped
              instead was narrower: test files and documentation were outranking implementation code, so results are
              re-ranked by what kind of file they are. A held-out set caught the first version of that fix overfitting
              before it shipped.
            </p>
          </div>
          <Link
            href="/results"
            className="press shrink-0 h-11 px-5 inline-flex items-center gap-2 rounded-lg text-sm font-semibold btn-lift cursor-pointer"
            style={{ background: 'var(--brand)', color: 'var(--brand-fg)' }}
          >
            Show complete evals
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  )
}
