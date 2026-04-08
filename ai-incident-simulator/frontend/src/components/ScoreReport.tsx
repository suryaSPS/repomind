"use client";

import { useRouter } from "next/navigation";
import type { ScoreCard } from "@/lib/types";
import { ScoreRadar } from "./ScoreRadar";
import { FeedbackList } from "./FeedbackList";

const GRADE_COLORS: Record<string, string> = {
  A: "text-green-400",
  B: "text-blue-400",
  C: "text-yellow-400",
  D: "text-orange-400",
  F: "text-red-400",
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function ScoreReport({ score }: { score: ScoreCard }) {
  const router = useRouter();
  const gradeColor = GRADE_COLORS[score.grade[0]] ?? "text-slate-300";

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <p className="text-xs text-slate-500 uppercase tracking-widest font-mono">Simulation Complete</p>
        <h1 className="text-2xl font-bold text-white">Incident Response Report</h1>
      </div>

      {/* Overall score + grade */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1 bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-6 flex flex-col items-center justify-center gap-2">
          <span className={`text-6xl font-bold font-mono ${gradeColor}`}>{score.grade}</span>
          <span className="text-sm text-slate-400">Grade</span>
        </div>
        <div className="col-span-1 bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-6 flex flex-col items-center justify-center gap-2">
          <span className="text-5xl font-bold font-mono text-white">{Math.round(score.overall_score)}</span>
          <span className="text-sm text-slate-400">Overall Score</span>
        </div>
        <div className="col-span-1 bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-6 flex flex-col items-center justify-center gap-2">
          <span className="text-3xl font-bold font-mono text-slate-300">{formatTime(score.time_taken_seconds)}</span>
          <span className="text-sm text-slate-400">Time Taken</span>
        </div>
      </div>

      {/* Executive summary */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-3">Executive Summary</h2>
        <p className="text-sm text-slate-300 leading-relaxed">{score.executive_summary}</p>
      </div>

      {/* Radar chart + category scores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-3">Performance Radar</h2>
          <ScoreRadar categoryScores={score.category_scores} />
        </div>

        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-4">Category Breakdown</h2>
          <div className="space-y-3">
            {score.category_scores.map((cs) => (
              <div key={cs.category}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">{cs.category}</span>
                  <span className="text-slate-400 font-mono">{Math.round(cs.score)}/100</span>
                </div>
                <div className="bg-slate-800 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${cs.score >= 70 ? "bg-green-500" : cs.score >= 45 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${cs.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MITRE techniques */}
      {score.mitre_techniques_encountered.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-3">
            MITRE ATT&amp;CK Techniques Encountered
          </h2>
          <div className="flex flex-wrap gap-2">
            {score.mitre_techniques_encountered.map((t) => (
              <span key={t} className="px-2 py-1 bg-red-950 border border-red-900 rounded text-xs font-mono text-red-300">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Feedback */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-4">Detailed Feedback</h2>
        <FeedbackList items={score.feedback_items} />
      </div>

      {/* Improvement plan */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-3">Top 3 Improvement Actions</h2>
        <ol className="space-y-2">
          {score.improvement_plan.map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
              <span className="w-6 h-6 rounded-full bg-blue-900 text-blue-300 flex items-center justify-center text-xs font-bold shrink-0">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      <div className="text-center pt-2">
        <button
          onClick={() => router.push("/")}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors"
        >
          Try Another Scenario
        </button>
      </div>
    </div>
  );
}
