import type { Severity, Difficulty } from "@/lib/types";

const SEVERITY_LABELS: Record<Severity, string> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  critical: "CRITICAL",
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  beginner: "bg-green-900 text-green-300 border border-green-700",
  intermediate: "bg-yellow-900 text-yellow-300 border border-yellow-700",
  advanced: "bg-red-900 text-red-300 border border-red-700",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold severity-${severity} border`}>
      {SEVERITY_LABELS[severity]}
    </span>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${DIFFICULTY_COLORS[difficulty]}`}>
      {DIFFICULTY_LABELS[difficulty]}
    </span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  const label = category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-900 text-blue-300 border border-blue-700">
      {label}
    </span>
  );
}
