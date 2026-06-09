import { useState, useEffect, useCallback } from "react";
import { WakePlan } from "../types";
import { actionsUndo, refreshWakePlan } from "../services/deploymentCoach";
import { apiRefreshWakePlan, apiUndoAction } from "../services/apiClient";
import { trackEvent } from "../services/analytics";
import { useAuth } from "@clerk/clerk-react";
async function refreshPlanWithBackendFallback(force: boolean) {
  try {
    return await apiRefreshWakePlan(force);
  } catch (error) {
    console.warn("Focus20 API unavailable. Falling back to local orchestration.", error);
    return refreshWakePlan(force);
  }
}

async function undoWithBackendFallback(actionId: string) {
  try {
    return await apiUndoAction(actionId);
  } catch (error) {
    console.warn("Focus20 API undo unavailable. Falling back to local undo.", error);
    await actionsUndo(actionId);
    return { success: true };
  }
}

export function useWakePlan(enabled = true)  {
  const { isLoaded, isSignedIn } = useAuth();

  const [wakePlan, setWakePlan] = useState<WakePlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadPlan = useCallback(async (force = false) => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    setIsLoading(true);

    try {
      const plan = await refreshPlanWithBackendFallback(force);
      setWakePlan(plan);
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!enabled) return;
    loadPlan(false);
  }, [loadPlan]);

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
      localStorage.setItem(
        "focus20_wakePlan",
        JSON.stringify(updatedPlan)
      );

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
    undoAction,
    selectAlternative,
    updateStatus,
    refreshPlan: () => loadPlan(true),
  };
}