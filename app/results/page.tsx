import type { Metadata } from 'next'
import EvalReport from '@/components/EvalReport'

export const metadata: Metadata = {
  title: 'RepoMind — Retrieval Evaluation',
  description:
    'How RepoMind’s code retrieval was measured: 8 strategies compared over 111 hand-labelled questions across 4 repositories, why hybrid search was rejected, and the re-ranking prior that shipped instead.',
}

export default function ResultsPage() {
  return <EvalReport />
}
