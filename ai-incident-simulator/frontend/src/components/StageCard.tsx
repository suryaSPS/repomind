import type { ScenarioStage, ResponseEvaluation } from "@/lib/types";
import { SeverityBadge } from "./StatusBadge";

interface StageCardProps {
  stage: ScenarioStage;
  evaluation?: ResponseEvaluation;
  isCurrent?: boolean;
}

const SEVERITY_BORDER = {
  low: "border-l-green-500",
  medium: "border-l-yellow-500",
  high: "border-l-orange-500",
  critical: "border-l-red-500",
};

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 bg-slate-800 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
    </div>
  );
}

export function StageCard({ stage, evaluation, isCurrent }: StageCardProps) {
  return (
    <div
      className={`border-l-2 ${SEVERITY_BORDER[stage.severity]} pl-3 py-2 ${isCurrent ? "opacity-100" : "opacity-60"}`}
    >
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <span className="text-xs font-mono text-slate-500">Stage {stage.stage_number}</span>
        <SeverityBadge severity={stage.severity} />
      </div>
      <p className="text-xs font-semibold text-slate-200 leading-snug">{stage.title}</p>
      {evaluation && (
        <div className="mt-1">
          <ScoreBar score={evaluation.effectiveness_score} />
        </div>
      )}
    </div>
  );
}
