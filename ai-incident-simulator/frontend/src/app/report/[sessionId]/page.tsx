import { notFound } from "next/navigation";
import { ScoreReport } from "@/components/ScoreReport";
import type { ScoreCard } from "@/lib/types";

async function getScore(sessionId: string): Promise<ScoreCard | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const res = await fetch(`${apiUrl}/api/sessions/${sessionId}/score`, { cache: "no-store" });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error("Failed to load score");
  return res.json();
}

export default async function ReportPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const score = await getScore(sessionId);
  if (!score) notFound();
  return <ScoreReport score={score} />;
}
