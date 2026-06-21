import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Play, Pause, Check } from "lucide-react";
import { WakePlan } from "../types";
import { showLocalNotification } from "../services/pwaNotifications";
import { VoiceCheckinRecorder } from "./VoiceCheckinRecorder";
import { apiTrackEvent } from "../services/apiClient";

interface FocusModeOverlayProps {
  wakePlan: WakePlan;
  onClose: () => void;
  onComplete: () => void;
}

function formatTime(totalSeconds: number) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

export function FocusModeOverlay({
  wakePlan,
  onClose,
  onComplete,
}: FocusModeOverlayProps) {
  const durationMinutes = wakePlan.block.durationMinutes ?? 60;
  const totalSeconds = durationMinutes * 60;

  const timerStorageKey = `focus20_timer_${wakePlan.block.id}`;
  const executionStorageKey = `focus20_execution_${wakePlan.block.id}`;

  const completedRef = useRef(false);

  const startedAt = useMemo(() => {
    const saved = localStorage.getItem(executionStorageKey);

    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { startedAt?: string };

        if (parsed.startedAt) {
          return parsed.startedAt;
        }
      } catch {
        // Ignore bad local storage state
      }
    }

    const nowIso = new Date().toISOString();

    localStorage.setItem(
      executionStorageKey,
      JSON.stringify({
        focusBlockId: wakePlan.block.id,
        title: wakePlan.lever?.title ?? wakePlan.block.title,
        category: wakePlan.lever?.category ?? wakePlan.block.leverCategory,
        startedAt: nowIso,
        completedAt: null,
        actualDurationMinutes: 0,
        status: "started",
      })
    );

    return nowIso;
  }, [
    executionStorageKey,
    wakePlan.block.id,
    wakePlan.block.leverCategory,
    wakePlan.block.title,
    wakePlan.lever?.category,
    wakePlan.lever?.title,
  ]);

  const initialEndAt = useMemo(() => {
    const saved = localStorage.getItem(timerStorageKey);

    if (saved) {
      const parsed = Number(saved);

      if (!Number.isNaN(parsed) && parsed > Date.now()) {
        return parsed;
      }
    }

    const nextEndAt = Date.now() + totalSeconds * 1000;
    localStorage.setItem(timerStorageKey, String(nextEndAt));

    return nextEndAt;
  }, [timerStorageKey, totalSeconds]);

  const [endAt, setEndAt] = useState(initialEndAt);
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.ceil((initialEndAt - Date.now()) / 1000))
  );
  const [isRunning, setIsRunning] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [isSavingCompletion, setIsSavingCompletion] = useState(false);

  useEffect(() => {
    apiTrackEvent("block_started", {
      focusBlockId: wakePlan.block.id,
      title: wakePlan.lever?.title ?? wakePlan.block.title,
      category: wakePlan.lever?.category ?? wakePlan.block.leverCategory,
      plannedDurationMinutes: durationMinutes,
      startedAt,
    }).catch(() => {
      // Non-blocking analytics
    });
  }, [
    durationMinutes,
    startedAt,
    wakePlan.block.id,
    wakePlan.block.leverCategory,
    wakePlan.block.title,
    wakePlan.lever?.category,
    wakePlan.lever?.title,
  ]);

  useEffect(() => {
    if (!isRunning || isComplete) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));

      setSecondsLeft(remaining);

      if (remaining <= 0 && !completedRef.current) {
        completedRef.current = true;
        localStorage.removeItem(timerStorageKey);
        setIsRunning(false);
        setIsComplete(true);

        showLocalNotification("Focus20 session complete", {
          body: "Great work. Complete your quick check-in.",
        });
      }
    };

    tick();

    const interval = window.setInterval(tick, 1000);

    const handleVisibilityChange = () => {
      tick();
    };

    const handleFocus = () => {
      tick();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [endAt, isRunning, isComplete, timerStorageKey]);

  const toggleRunning = () => {
    if (isComplete) return;

    if (isRunning) {
      setSecondsLeft(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
      setIsRunning(false);
      return;
    }

    const nextEndAt = Date.now() + secondsLeft * 1000;
    localStorage.setItem(timerStorageKey, String(nextEndAt));
    setEndAt(nextEndAt);
    setIsRunning(true);
  };

  const saveCompletion = async () => {
    if (isSavingCompletion) return;

    setIsSavingCompletion(true);

    const completedAt = new Date().toISOString();

    const actualDurationMinutes = Math.max(
      1,
      Math.round(
        (new Date(completedAt).getTime() - new Date(startedAt).getTime()) /
          60000
      )
    );

    const executionRecord = {
      focusBlockId: wakePlan.block.id,
      title: wakePlan.lever?.title ?? wakePlan.block.title,
      category: wakePlan.lever?.category ?? wakePlan.block.leverCategory,
      startedAt,
      completedAt,
      actualDurationMinutes,
      plannedDurationMinutes: durationMinutes,
      status: "completed",
      paretoScore: wakePlan.paretoScore ?? null,
      predictedImpact:
        wakePlan.impact ??
        wakePlan.lever?.predictedImpact ??
        wakePlan.block.predictedImpact,
    };

    localStorage.setItem(executionStorageKey, JSON.stringify(executionRecord));
    localStorage.removeItem(timerStorageKey);

    try {
      await apiTrackEvent("block_completed", executionRecord);
    } catch {
      // Keep local record even if analytics fails
    }

    setIsSavingCompletion(false);
  };

  const handleComplete = async () => {
    await saveCompletion();
    onComplete();
  };

  const progress =
    totalSeconds === 0
      ? 100
      : ((totalSeconds - secondsLeft) / totalSeconds) * 100;

  const plan =
    wakePlan.plan?.length > 0
      ? wakePlan.plan
      : [
          "Open the task or workspace.",
          "Work for the protected focus block.",
          "Capture the next action before stopping.",
        ];

  const sessionGoal =
  localStorage.getItem("focus20_current_goal") ??
  wakePlan.block.title;      

 return (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/95 p-6"
  >
    <button
      onClick={onClose}
      className="fixed right-6 top-6 z-10 p-2 text-slate-400 transition-colors hover:text-white"
    >
      <X className="h-6 w-6" />
    </button>

    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center py-10 text-center">
      <motion.h2
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-2 text-xl font-semibold text-white"
      >
        {isComplete ? "Session Complete!" : "Focus Mode"}
      </motion.h2>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-6 w-full rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4"
      >
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-300">
          Today&apos;s Target
        </p>

        <p className="mt-2 text-lg font-bold text-white">{sessionGoal}</p>
      </motion.div>

      <div className="relative mx-auto mb-6 h-64 w-64">
        <svg className="h-full w-full -rotate-90 transform">
          <circle
            cx="128"
            cy="128"
            r="120"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-slate-700"
          />

          <motion.circle
            cx="128"
            cy="128"
            r="120"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            className={isComplete ? "text-emerald-500" : "text-emerald-400"}
            style={{
              strokeDasharray: 2 * Math.PI * 120,
              strokeDashoffset: 2 * Math.PI * 120 * (1 - progress / 100),
            }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-5xl font-bold text-white">
            {formatTime(secondsLeft)}
          </span>

          <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">
            Time Remaining
          </p>

          {isComplete && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-2">
              <Check className="h-8 w-8 text-emerald-400" />
            </motion.div>
          )}
        </div>
      </div>

      {!isComplete && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-6 w-full rounded-2xl bg-slate-800 p-4 text-left"
        >
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">
            Success Criteria
          </p>

          <div className="space-y-3">
            {plan.map((step, index) => (
              <div key={index} className="flex items-start gap-3 text-slate-200">
                <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
                  ✓
                </div>

                <span>{step}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {!isComplete && (
        <div className="mb-6 w-full rounded-xl bg-slate-800 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Focus20 Reward
          </p>

          <p className="mt-1 font-bold text-emerald-400">
            +{Math.max(1, Math.floor(progress / 10))} score potential
          </p>
        </div>
      )}

      <div className="flex items-center justify-center gap-4">
        {!isComplete && (
          <button
            onClick={toggleRunning}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-900 transition-colors hover:bg-slate-100"
          >
            {isRunning ? (
              <Pause className="h-6 w-6" />
            ) : (
              <Play className="ml-1 h-6 w-6" fill="currentColor" />
            )}
          </button>
        )}

        {isComplete && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={handleComplete}
            disabled={isSavingCompletion}
            className="flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-60"
          >
            <Check className="h-5 w-5" />
            {isSavingCompletion ? "Saving..." : "Done"}
          </motion.button>
        )}
      </div>

      {isComplete && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 w-full"
        >
          <VoiceCheckinRecorder
            focusBlockId={wakePlan.block.id}
            onComplete={async () => {
              await saveCompletion();
              onComplete();
            }}
          />
        </motion.div>
      )}
    </div>
  </motion.div>
);
}