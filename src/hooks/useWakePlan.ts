import { useState, useEffect, useCallback } from "react";
import { WakePlan } from "../types";
import { actionsUndo, refreshWakePlan } from "../services/deploymentCoach";
import { apiRefreshWakePlan, apiUndoAction } from "../services/apiClient";
import { trackEvent } from "../services/analytics";

function enrichParetoPlan(plan: WakePlan): WakePlan {
  const impact =
    plan.impact ?? plan.lever?.predictedImpact ?? plan.block?.predictedImpact ?? 5;

  const effortMinutes =
    plan.effortMinutes ?? plan.block?.durationMinutes ?? 60;

  let confidence =
    plan.confidence ?? plan.block?.confidence ?? 0.82;

  if (confidence > 1) {
    confidence = confidence / 100;
  }

  return {
    ...plan,
    impact,
    effortMinutes,
    confidence,
    paretoScore:
      plan.paretoScore ?? (impact * confidence) / Math.sqrt(effortMinutes + 1),
    recommendationReason:
      plan.recommendationReason ??
      plan.why ??
      "This task has the highest Pareto Score today, fits your available focus window, and supports your most important lever.",
    recommendedStart: plan.recommendedStart ?? plan.block?.startTime,
    recommendedEnd: plan.recommendedEnd ?? plan.block?.endTime,
    leverName: plan.leverName ?? plan.lever?.title ?? plan.block?.title,
    nextAction: plan.nextAction ?? {
      title: "Review and prepare for tomorrow's highest-impact task",
      durationMinutes: 25,
      reason:
        "Maintains momentum while protecting energy for the next focus block.",
    },
  };
}

async function undoWithBackendFallback(actionId: string) {
  try {
    return await apiUndoAction(actionId);
  } catch {
    await actionsUndo(actionId);
    return { success: true };
  }
}

export function useWakePlan(enabled = true) {
  const [wakePlan, setWakePlan] = useState<WakePlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlan = useCallback(async (force = false) => {
    setIsLoading(true);

    try {
      setError(null);

      const plan = await apiRefreshWakePlan(force);
      setWakePlan(enrichParetoPlan(plan));
    } catch {
      try {
        const fallbackPlan = await refreshWakePlan(force);
        setWakePlan(enrichParetoPlan(fallbackPlan));
        setError(null);
      } catch {
        setWakePlan(null);
        setError("Unable to load your focus plan.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    loadPlan(false);
  }, [enabled, loadPlan]);

  const undoAction = useCallback(async () => {
    if (!wakePlan) return;

    await undoWithBackendFallback(wakePlan.actionId);
    await loadPlan(false);
  }, [wakePlan, loadPlan]);

  const selectAlternative = useCallback(
    async (index: number) => {
      if (!wakePlan?.alternatives[index]) return;

      await loadPlan(true);
    },
    [wakePlan, loadPlan]
  );

  const updateStatus = useCallback(
    (status: WakePlan["status"]) => {
      if (!wakePlan) return;

      const updatedPlan = { ...wakePlan, status };

      setWakePlan(updatedPlan);
      localStorage.setItem("focus20_wakePlan", JSON.stringify(updatedPlan));

      if (status === "started") {
        trackEvent("block_started", {
          focusBlockId: wakePlan.block.id,
        });
      }
    },
    [wakePlan]
  );

  return {
    wakePlan,
    isLoading,
    error,
    undoAction,
    selectAlternative,
    updateStatus,
    refreshPlan: () => loadPlan(true),
  };
}