"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ScenarioTemplate } from "@/lib/types";
import { api } from "@/lib/api";
import { SeverityBadge, DifficultyBadge, CategoryBadge } from "./StatusBadge";
import { Shield, Zap, AlertTriangle } from "lucide-react";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  ransomware: <AlertTriangle className="w-5 h-5 text-red-400" />,
  phishing: <Zap className="w-5 h-5 text-yellow-400" />,
  supply_chain: <Shield className="w-5 h-5 text-purple-400" />,
  insider_threat: <Shield className="w-5 h-5 text-orange-400" />,
  advanced_persistent_threat: <AlertTriangle className="w-5 h-5 text-red-500" />,
  ddos: <Zap className="w-5 h-5 text-blue-400" />,
  zero_day: <AlertTriangle className="w-5 h-5 text-pink-400" />,
};

export function ScenarioPicker({ scenarios }: { scenarios: ScenarioTemplate[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startScenario(scenarioId: string) {
    setLoading(scenarioId);
    setError(null);
    try {
      const session = await api.createSession(scenarioId);
      router.push(`/sim/${session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start simulation");
      setLoading(null);
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Select an Incident Scenario</h1>
        <p className="text-slate-400">Choose a scenario to begin your incident response training simulation</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scenarios.map((scenario) => (
          <div
            key={scenario.id}
            className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5 flex flex-col gap-3 hover:border-blue-700 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {CATEGORY_ICONS[scenario.category] ?? <Shield className="w-5 h-5 text-slate-400" />}
                <CategoryBadge category={scenario.category} />
              </div>
              <DifficultyBadge difficulty={scenario.difficulty} />
            </div>

            <h2 className="text-sm font-bold text-white leading-snug">{scenario.title}</h2>
            <p className="text-xs text-slate-400 leading-relaxed flex-1">{scenario.description}</p>

            <div className="mt-1">
              <p className="text-xs text-slate-500 mb-1">Initial indicators:</p>
              <ul className="space-y-0.5">
                {scenario.initial_indicators.slice(0, 2).map((ind, i) => (
                  <li key={i} className="text-xs text-slate-400 truncate">
                    <span className="text-blue-500 mr-1">›</span>{ind}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-slate-500">{scenario.estimated_stages} stages</span>
              <button
                onClick={() => startScenario(scenario.id)}
                disabled={loading !== null}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
              >
                {loading === scenario.id ? "Starting..." : "Start Simulation"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
