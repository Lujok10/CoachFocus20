import { useCallback, useEffect, useState } from "react";
import type { WakePlan } from "../types";
import { actionsUndo, refreshWakePlan } from "../services/deploymentCoach";
import { apiRefreshWakePlan, apiUndoAction } from "../services/apiClient";
import { trackEvent } from "../services/analytics";

const WAKE_PLAN_CACHE_KEY = "focus20_wakePlan_cache";

type CachedWakePlan = {
  date: string;
  plan: WakePlan;
};

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function readCachedWakePlan(): WakePlan | null {
  try {
    const raw = localStorage.getItem(WAKE_PLAN_CACHE_KEY);

    if (!raw) return null;

    const cached = JSON.parse(raw) as CachedWakePlan;

    if (cached.date !== getTodayKey()) {
      localStorage.removeItem(WAKE_PLAN_CACHE_KEY);
      return null;
    }

    return cached.plan;
  } catch {
    localStorage.removeItem(WAKE_PLAN_CACHE_KEY);
    return null;
  }
}

function saveCachedWakePlan(plan: WakePlan) {
  const cached: CachedWakePlan = {
    date: getTodayKey(),
    plan,
  };

  localStorage.setItem(WAKE_PLAN_CACHE_KEY, JSON.stringify(cached));
}

export function invalidateWakePlanCache() {
  localStorage.removeItem(WAKE_PLAN_CACHE_KEY);
}

function enrichParetoPlan(plan: WakePlan): WakePlan {
  const impact =
    plan.impact ??
    plan.lever?.predictedImpact ??
    plan.block?.predictedImpact ??
    5;

  const effortMinutes =
    plan.effortMinutes ?? plan.block?.durationMinutes ?? 60;

  let confidence = plan.confidence ?? plan.block?.confidence ?? 0.82;

  if (confidence > 1) {
    confidence = confidence / 100;
  }

  return {
    ...plan,
    impact,
    effortMinutes,
    confidence,
    paretoScore:
      plan.paretoScore ??
      (impact * confidence) / Math.sqrt(effortMinutes + 1),
    recommendationReason:
      plan.recommendationReason ??
      plan.why ??
      "This task has the highest Pareto Score today, fits your available focus window, and supports your most important lever.",
    recommendedStart: plan.recommendedStart ?? plan.block?.startTime,
    recommendedEnd: plan.recommendedEnd ?? plan.block?.endTime,
    leverName:
      plan.leverName ?? plan.lever?.title ?? plan.block?.title,
    nextAction:
      plan.nextAction ?? {
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

      if (!force) {
        const cachedPlan = readCachedWakePlan();

        if (cachedPlan) {
          setWakePlan(enrichParetoPlan(cachedPlan));
          return;
        }
      }

      try {
        const plan = await apiRefreshWakePlan(force);
        const enrichedPlan = enrichParetoPlan(plan);

        setWakePlan(enrichedPlan);
        saveCachedWakePlan(enrichedPlan);
      } catch {
        const fallbackPlan = await refreshWakePlan(force);
        const enrichedPlan = enrichParetoPlan(fallbackPlan);

        setWakePlan(enrichedPlan);
        saveCachedWakePlan(enrichedPlan);
        setError(null);
      }
    } catch {
      setWakePlan(null);
      setError("Unable to load your focus plan.");
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

    invalidateWakePlanCache();
    await loadPlan(false);
  }, [wakePlan, loadPlan]);

  const selectAlternative = useCallback(
    async (index: number) => {
      if (!wakePlan?.alternatives[index]) return;

      invalidateWakePlanCache();
      await loadPlan(true);
    },
    [wakePlan, loadPlan]
  );

  const updateStatus = useCallback(
    (status: WakePlan["status"]) => {
      if (!wakePlan) return;

      const updatedPlan = {
        ...wakePlan,
        status,
      };

      setWakePlan(updatedPlan);
      saveCachedWakePlan(updatedPlan);

      if (status === "started") {
        trackEvent("block_started", {
          focusBlockId: wakePlan.block.id,
        });
      }
    },
    [wakePlan]
  );

  const refreshPlan = useCallback(async () => {
    invalidateWakePlanCache();
    await loadPlan(true);
  }, [loadPlan]);

  return {
    wakePlan,
    isLoading,
    error,
    undoAction,
    selectAlternative,
    updateStatus,
    refreshPlan,
  };
}