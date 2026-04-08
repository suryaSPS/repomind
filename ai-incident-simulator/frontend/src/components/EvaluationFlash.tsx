import type { ResponseEvaluation } from "@/lib/types";
import { CheckCircle, XCircle } from "lucide-react";

export function EvaluationFlash({ evaluation }: { evaluation: ResponseEvaluation }) {
  const pct = Math.round(evaluation.effectiveness_score * 100);
  const color = pct >= 70 ? "text-green-400" : pct >= 40 ? "text-yellow-400" : "text-red-400";
  const borderColor = pct >= 70 ? "border-green-700" : pct >= 40 ? "border-yellow-700" : "border-red-700";
  const bgColor = pct >= 70 ? "bg-green-950/40" : pct >= 40 ? "bg-yellow-950/40" : "bg-red-950/40";

  return (
    <div className={`border ${borderColor} ${bgColor} rounded-xl p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Response Evaluated</h3>
        <span className={`text-2xl font-mono font-bold ${color}`}>{pct}%</span>
      </div>

      <p className="text-xs text-slate-300 leading-relaxed">{evaluation.reasoning}</p>

      {evaluation.good_calls.length > 0 && (
        <div className="space-y-1">
          {evaluation.good_calls.map((call, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-green-300">
              <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{call}</span>
            </div>
          ))}
        </div>
      )}

      {evaluation.missed_actions.length > 0 && (
        <div className="space-y-1">
          {evaluation.missed_actions.map((miss, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-red-300">
              <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{miss}</span>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400 italic border-t border-slate-800 pt-2">{evaluation.consequences}</p>
    </div>
  );
}
