"use client";

import ReactMarkdown from "react-markdown";
import type { SimulationSession } from "@/lib/types";
import { useSimulation } from "@/hooks/useSimulation";
import { IncidentTimeline } from "./IncidentTimeline";
import { ThreatIndicators } from "./ThreatIndicators";
import { ResponseInput } from "./ResponseInput";
import { EvaluationFlash } from "./EvaluationFlash";

export function SimulationPanel({ initialSession }: { initialSession: SimulationSession }) {
  const { session, latestEvaluation, isLoading, error, submitResponse } = useSimulation(initialSession);

  if (!session) return null;

  const currentStageIndex = session.current_stage - 1;
  const currentStage = session.stages[currentStageIndex];
  const isComplete = session.status === "completed";

  return (
    <div className="flex h-[calc(100vh-49px)] overflow-hidden">
      {/* Left: Timeline */}
      <aside className="w-64 shrink-0 border-r border-[var(--card-border)] p-4 overflow-y-auto">
        <IncidentTimeline
          stages={session.stages}
          evaluations={session.evaluations}
          currentStage={session.current_stage}
        />
      </aside>

      {/* Right: Main panel */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-mono uppercase tracking-widest mb-1">
                {session.scenario_title}
              </p>
              <h1 className="text-lg font-bold text-white">
                Stage {currentStage?.stage_number}: {currentStage?.title}
              </h1>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500">
                {session.current_stage} / {session.total_stages} stages
              </span>
              <div className="w-32 bg-slate-800 rounded-full h-1.5 mt-1">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${(session.current_stage / session.total_stages) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {currentStage && <ThreatIndicators stage={currentStage} />}

          {/* Narrative */}
          {currentStage && (
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5 space-y-4">
              <div className="prose prose-invert prose-sm max-w-none text-slate-300 text-sm leading-relaxed">
                <ReactMarkdown>{currentStage.narrative}</ReactMarkdown>
              </div>

              {currentStage.technical_details && (
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-widest mb-2 font-mono">
                    Technical Details / Artifacts
                  </p>
                  <pre className="text-xs text-green-300 whitespace-pre-wrap overflow-x-auto font-mono leading-relaxed">
                    {currentStage.technical_details}
                  </pre>
                </div>
              )}

              {currentStage.hints.length > 0 && (
                <details className="group">
                  <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 transition-colors">
                    Need a hint? ({currentStage.hints.length} available)
                  </summary>
                  <ul className="mt-2 space-y-1 pl-2">
                    {currentStage.hints.map((hint, i) => (
                      <li key={i} className="text-xs text-blue-300 border-l border-blue-800 pl-2">
                        {hint}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {/* Latest evaluation flash */}
          {latestEvaluation && <EvaluationFlash evaluation={latestEvaluation} />}

          {/* Loading state */}
          {isLoading && (
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-6 text-center space-y-3">
              <div className="flex justify-center gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <p className="text-sm text-slate-400">Analyzing your response and generating next stage...</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-950/50 border border-red-800 rounded-xl p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Complete banner */}
          {isComplete && !isLoading && (
            <div className="bg-green-950/50 border border-green-700 rounded-xl p-6 text-center">
              <h2 className="text-lg font-bold text-green-300 mb-1">Simulation Complete</h2>
              <p className="text-sm text-slate-400">Generating your score report...</p>
            </div>
          )}

          {/* Response input */}
          {!isComplete && !isLoading && currentStage && (
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
              <ResponseInput
                availableActions={currentStage.available_actions}
                onSubmit={submitResponse}
                isLoading={isLoading}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
