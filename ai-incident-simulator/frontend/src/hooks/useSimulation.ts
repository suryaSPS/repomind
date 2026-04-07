"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { SimulationSession, ResponseEvaluation, ScenarioStage } from "@/lib/types";
import { api } from "@/lib/api";

interface SimulationState {
  session: SimulationSession | null;
  latestEvaluation: ResponseEvaluation | null;
  isLoading: boolean;
  error: string | null;
}

export function useSimulation(initialSession: SimulationSession) {
  const router = useRouter();
  const [state, setState] = useState<SimulationState>({
    session: initialSession,
    latestEvaluation: null,
    isLoading: false,
    error: null,
  });

  const submitResponse = useCallback(
    async (selectedActions: string[], freeText: string) => {
      if (!state.session) return;

      setState((s) => ({ ...s, isLoading: true, error: null, latestEvaluation: null }));

      try {
        const result = await api.submitResponse(state.session.id, selectedActions, freeText);

        setState((s) => ({
          ...s,
          session: result.session,
          latestEvaluation: result.evaluation,
          isLoading: false,
        }));

        if (result.is_complete) {
          setTimeout(() => {
            router.push(`/report/${result.session.id}`);
          }, 4000); // Show final evaluation for 4 seconds before redirecting
        }
      } catch (e) {
        setState((s) => ({
          ...s,
          isLoading: false,
          error: e instanceof Error ? e.message : "Failed to process response",
        }));
      }
    },
    [state.session, router]
  );

  return {
    session: state.session,
    latestEvaluation: state.latestEvaluation,
    isLoading: state.isLoading,
    error: state.error,
    submitResponse,
  };
}
