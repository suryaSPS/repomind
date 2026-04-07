import { ScenarioPicker } from "@/components/ScenarioPicker";
import type { ScenarioTemplate } from "@/lib/types";

async function getScenarios(): Promise<ScenarioTemplate[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const res = await fetch(`${apiUrl}/api/scenarios`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load scenarios");
  return res.json();
}

export default async function HomePage() {
  const scenarios = await getScenarios();
  return <ScenarioPicker scenarios={scenarios} />;
}
