import type { ScenarioStage } from "@/lib/types";
import { SeverityBadge } from "./StatusBadge";

const TIME_PRESSURE_COLORS = {
  low: "text-green-400",
  moderate: "text-yellow-400",
  urgent: "text-orange-400 animate-pulse",
  critical: "text-red-400 animate-pulse font-bold",
};

export function ThreatIndicators({ stage }: { stage: ScenarioStage }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Severity</span>
          <SeverityBadge severity={stage.severity} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Time Pressure</span>
          <span className={`font-mono uppercase ${TIME_PRESSURE_COLORS[stage.time_pressure]}`}>
            {stage.time_pressure}
          </span>
        </div>
      </div>

      {stage.affected_systems.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-slate-500 mr-1">Affected:</span>
          {stage.affected_systems.map((sys) => (
            <span
              key={sys}
              className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs font-mono text-slate-300"
            >
              {sys}
            </span>
          ))}
        </div>
      )}

      {stage.mitre_techniques.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-slate-500 mr-1">MITRE ATT&amp;CK:</span>
          {stage.mitre_techniques.map((t) => (
            <span
              key={t}
              className="px-1.5 py-0.5 bg-red-950 border border-red-900 rounded text-xs font-mono text-red-300"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
