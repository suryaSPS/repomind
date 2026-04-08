import { notFound } from "next/navigation";
import { SimulationPanel } from "@/components/SimulationPanel";
import type { SimulationSession } from "@/lib/types";

async function getSession(id: string): Promise<SimulationSession | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const res = await fetch(`${apiUrl}/api/sessions/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load session");
  return res.json();
}

export default async function SimPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);
  if (!session) notFound();
  return <SimulationPanel initialSession={session} />;
}
