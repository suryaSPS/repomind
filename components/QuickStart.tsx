export const EXAMPLE_REPO = 'https://github.com/suryaSPS/repomind'
export const STARTER_QUESTION = 'How does this app turn a GitHub repository into answers with file and line citations?'

interface QuickStartProps {
  step: 'search' | 'indexing' | 'question'
  onSkip: () => void
}

export default function QuickStart({ step, onSkip }: QuickStartProps) {
  const content = {
    search: ['Ask about the app you’re using.', 'Explore how RepoMind works. Paste this project’s GitHub link into the search bar below, then click Search.'],
    indexing: ['Getting your repository ready', 'RepoMind is reading the code. Your chat will open automatically when indexing finishes.'],
    question: ['Ask your first question', 'Choose the suggested question below or write your own, then click Send. That’s it — the tutorial ends and you can keep exploring.'],
  }[step]

  return (
    <section aria-label="Quick start tutorial" className="quick-start mb-5 rounded-2xl p-5 sm:p-6 text-left">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs font-bold tracking-widest uppercase">Your first walkthrough</p>
        <button type="button" onClick={onSkip} className="quick-start-skip min-h-11 px-3 -mr-2 -my-2 rounded-lg text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2">Skip tutorial</button>
      </div>
      <div role="status" aria-live="polite">
        <h3 className="text-xl sm:text-2xl font-bold tracking-tight mb-2">{content[0]}</h3>
        <p className="text-sm leading-relaxed max-w-xl">{content[1]}</p>
        {step === 'search' && <p className="mt-3 text-xs sm:text-sm font-mono select-all break-all rounded-lg px-3 py-2 quick-start-repo">{EXAMPLE_REPO}</p>}
      </div>
      <div className="flex items-center justify-between gap-3 mt-5 pt-4 quick-start-footer">
        <ol aria-label="Tutorial progress" className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold">
          {['Search a repo', 'Ask a question'].map((label, index) => {
            const current = (step === 'question' ? 1 : 0) === index
            const complete = step === 'question' && index === 0
            return (
              <li key={label} aria-current={current ? 'step' : undefined} className="flex items-center gap-2">
                <span className={`quick-start-step flex items-center justify-center w-6 h-6 rounded-full ${current || complete ? 'quick-start-step-active' : ''}`}>
                  {complete ? <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 8 3 3 7-7" /></svg> : index + 1}
                </span>
                <span>{label}{complete && <span className="sr-only"> complete</span>}</span>
              </li>
            )
          })}
        </ol>
        <svg aria-hidden="true" className="shrink-0" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v16m-6-6 6 6 6-6" /></svg>
      </div>
    </section>
  )
}
