import type { ScenarioStage, ResponseEvaluation } from "@/lib/types";
import { StageCard } from "./StageCard";

interface IncidentTimelineProps {
  stages: ScenarioStage[];
  evaluations: ResponseEvaluation[];
  currentStage: number;
}

export function IncidentTimeline({ stages, evaluations, currentStage }: IncidentTimelineProps) {
  return (
    <div className="h-full overflow-y-auto pr-2">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
        Incident Timeline
      </h2>
      <div className="space-y-4">
        {stages.map((stage) => {
          const evaluation = evaluations.find((e) => e.stage_number === stage.stage_number);
          const isCurrent = stage.stage_number === currentStage;
          return (
            <StageCard
              key={stage.stage_number}
              stage={stage}
              evaluation={evaluation}
              isCurrent={isCurrent}
            />
          );
        })}
      </div>
    </div>
  );
}
