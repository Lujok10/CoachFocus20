import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Play, Pause, Check } from "lucide-react";
import { WakePlan } from "../types";
import { showLocalNotification } from "../services/pwaNotifications";
import { VoiceCheckinRecorder } from "./VoiceCheckinRecorder";

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
  const storageKey = `focus20_timer_${wakePlan.block.id}`;
  const completedRef = useRef(false);

  const initialEndAt = useMemo(() => {
    const saved = localStorage.getItem(storageKey);

    if (saved) {
      const parsed = Number(saved);

      if (!Number.isNaN(parsed) && parsed > Date.now()) {
        return parsed;
      }
    }

    const nextEndAt = Date.now() + totalSeconds * 1000;
    localStorage.setItem(storageKey, String(nextEndAt));

    return nextEndAt;
  }, [storageKey, totalSeconds]);

  const [endAt, setEndAt] = useState(initialEndAt);
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.ceil((initialEndAt - Date.now()) / 1000))
  );
  const [isRunning, setIsRunning] = useState(true);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!isRunning || isComplete) return;

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((endAt - Date.now()) / 1000)
      );

      setSecondsLeft(remaining);

      if (remaining <= 0 && !completedRef.current) {
        completedRef.current = true;
        localStorage.removeItem(storageKey);
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
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      window.removeEventListener("focus", handleFocus);
    };
  }, [endAt, isRunning, isComplete, storageKey]);

  const toggleRunning = () => {
    if (isComplete) return;

    if (isRunning) {
      setSecondsLeft(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
      setIsRunning(false);
      return;
    }

    const nextEndAt = Date.now() + secondsLeft * 1000;
    localStorage.setItem(storageKey, String(nextEndAt));
    setEndAt(nextEndAt);
    setIsRunning(true);
  };

  const handleComplete = () => {
    localStorage.removeItem(storageKey);
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

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-8 text-slate-400"
        >
          {wakePlan.lever?.title ?? wakePlan.block.title}
        </motion.p>

        <div className="relative mx-auto mb-8 h-64 w-64">
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
                strokeDashoffset:
                  2 * Math.PI * 120 * (1 - progress / 100),
              }}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-5xl font-bold text-white">
              {formatTime(secondsLeft)}
            </span>

            {isComplete && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="mt-2"
              >
                <Check className="h-8 w-8 text-emerald-400" />
              </motion.div>
            )}
          </div>
        </div>

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
              className="flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 font-medium text-white transition-colors hover:bg-emerald-600"
            >
              <Check className="h-5 w-5" />
              Done
            </motion.button>
          )}
        </div>

        {isComplete ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 w-full"
          >
            <VoiceCheckinRecorder
              focusBlockId={wakePlan.block.id}
              onComplete={() => {
                onComplete();
              }}
            />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 w-full text-left"
          >
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
              Your plan
            </p>

            <ul className="space-y-2">
              {plan.map((step, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-slate-300"
                >
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-medium text-slate-400">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}