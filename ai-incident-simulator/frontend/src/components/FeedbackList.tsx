import type { FeedbackItem } from "@/lib/types";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";

const TYPE_CONFIG = {
  strength: {
    icon: <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />,
    border: "border-green-800",
    bg: "bg-green-950/30",
    label: "bg-green-900 text-green-300",
    labelText: "Strength",
  },
  improvement: {
    icon: <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />,
    border: "border-yellow-800",
    bg: "bg-yellow-950/30",
    label: "bg-yellow-900 text-yellow-300",
    labelText: "Improvement",
  },
  critical_miss: {
    icon: <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />,
    border: "border-red-800",
    bg: "bg-red-950/30",
    label: "bg-red-900 text-red-300",
    labelText: "Critical Miss",
  },
};

export function FeedbackList({ items }: { items: FeedbackItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const config = TYPE_CONFIG[item.type];
        return (
          <div key={i} className={`border ${config.border} ${config.bg} rounded-lg p-4`}>
            <div className="flex items-start gap-3">
              {config.icon}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded font-semibold ${config.label}`}>
                    {config.labelText}
                  </span>
                  <span className="text-xs text-slate-500">Stage {item.stage_number}</span>
                </div>
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="text-xs text-slate-300 leading-relaxed">{item.detail}</p>
                {item.reference && (
                  <p className="text-xs text-blue-400 font-mono">{item.reference}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
