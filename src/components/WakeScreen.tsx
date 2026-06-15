import { motion } from "framer-motion";
import {
  ChevronUp,
  Play,
  Mic,
  Undo2,
  CalendarPlus,
  WifiOff,
} from "lucide-react";
import { WakePlan } from "../types";

interface WakeScreenProps {
  wakePlan: WakePlan | null;
  isLoading: boolean;
  onSwipeUp: () => void;
  onUndo: () => void;
  onStartFocus: () => void;
  onVoiceCheckIn: () => void;
}

export function WakeScreen({
  wakePlan,
  isLoading,
  onSwipeUp,
  onUndo,
  onStartFocus,
  onVoiceCheckIn,
}: WakeScreenProps) {
  const statusLabel = wakePlan?.calendarReconnectRequired
    ? "Reconnect calendar"
    : wakePlan?.readOnlyCalendar
      ? "Read-only calendar"
      : wakePlan?.isReserved
        ? "Block reserved"
        : "Suggested time";

  const confidenceDisplay =
    wakePlan?.confidence && wakePlan.confidence > 1
      ? Math.round(wakePlan.confidence)
      : Math.round((wakePlan?.confidence ?? 0.82) * 100);

      const impactValue =
      wakePlan?.impact ??
      wakePlan?.lever?.predictedImpact ??
      wakePlan?.block?.predictedImpact ??
      5;

  const impactLabel =
    impactValue >= 8
      ? "High"
      : impactValue >= 5
        ? "Medium"
        : "Low";

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-50 px-6">
      <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500" />

      <div className="flex max-w-lg flex-1 flex-col items-center justify-center text-center">
        {wakePlan && (
          <>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6"
            >
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                  wakePlan.isReserved
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                {wakePlan.calendarReconnectRequired ? (
                  <WifiOff className="h-3.5 w-3.5" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-current" />
                )}
                {statusLabel}
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="mb-6 w-full rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                Best 20% Move Today
              </p>

              <h1 className="mt-2 text-2xl font-bold text-slate-900">
                {wakePlan.leverName ?? wakePlan.lever?.title ?? wakePlan.block.title}
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                Recommended block:{" "}
                <span className="font-medium text-slate-700">
                  {wakePlan.recommendedStart ?? wakePlan.block.startTime}
                  {" - "}
                  {wakePlan.recommendedEnd ?? wakePlan.block.endTime}
                </span>
              </p>

              <div className="mt-4 rounded-2xl bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-800">
                  Why this was selected
                </p>

                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {wakePlan.recommendationReason ??
                    wakePlan.why ??
                    "This is your highest-leverage move right now because it fits your available focus window and supports your most important lever."}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                Impact: {impactLabel} ({impactValue})
              </span>

                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                  Effort:{" "}
                  {wakePlan.effortMinutes ?? wakePlan.block.durationMinutes} min
                </span>

                <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">
                  Confidence: {confidenceDisplay}%
                </span>

                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                  Pareto Score: {(wakePlan.paretoScore ?? 0).toFixed(2)}
                  
                </span>
              </div>
                  {wakePlan.nextAction && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Next Best Action
                      </p>

                      <p className="mt-1 font-medium text-slate-900">
                        {wakePlan.nextAction.title}
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
                        {wakePlan.nextAction.durationMinutes} min
                      </p>

                      <p className="mt-2 text-sm text-slate-500">
                        {wakePlan.nextAction.reason}
                      </p>
                    </div>
                  )}
              
            </motion.div>
          </>
        )}

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="text-base leading-relaxed text-slate-600"
        >
          {isLoading
            ? "Loading your focus plan..."
            : wakePlan
              ? wakePlan.sentence
              : "Connect your calendar to get started."}
        </motion.p>

        {wakePlan?.readOnlyCalendar && (
          <p className="mt-4 text-sm text-amber-700">
            Calendar is read-only, so Focus20 suggests instead of silently
            reserving.
          </p>
        )}

        {wakePlan?.calendarReconnectRequired && (
          <button className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
            <CalendarPlus className="h-4 w-4" />
            Reconnect calendar
          </button>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex items-center gap-4"
      >
        <button
          onClick={onStartFocus}
          disabled={!wakePlan || wakePlan.status === "cancelled"}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600 disabled:opacity-40"
          aria-label="Start focus session"
          title="Start Focus Block"
        >
          <Play className="ml-0.5 h-5 w-5" />
        </button>

        <button
          onClick={onVoiceCheckIn}
          disabled={!wakePlan}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          aria-label="Voice check-in"
        >
          <Mic className="h-5 w-5" />
        </button>

        <button
          onClick={onUndo}
          disabled={!wakePlan?.isReserved}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          aria-label="Undo reservation"
        >
          <Undo2 className="h-5 w-5" />
        </button>
      </motion.div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onSwipeUp}
        className="group flex cursor-pointer flex-col items-center gap-2 text-slate-400 transition-colors hover:text-slate-600"
      >
        <span className="text-xs font-medium uppercase tracking-wide">
          Details
        </span>

        <motion.div
          animate={{ y: [0, 4, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <ChevronUp className="h-5 w-5 group-hover:text-emerald-500" />
        </motion.div>
      </motion.button>
    </div>
  );
}