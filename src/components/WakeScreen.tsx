import { motion } from "framer-motion";
import {
  CalendarPlus,
  ChevronUp,
  Mic,
  Play,
  Undo2,
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

function MetricPill({
  variant,
  children,
}: {
  variant: "impact" | "effort" | "confidence" | "pareto";
  children: React.ReactNode;
}) {
  const classes = {
    impact: "bg-emerald-100 text-emerald-700",
    effort: "bg-blue-100 text-blue-700",
    confidence: "bg-purple-100 text-purple-700",
    pareto: "bg-amber-100 text-amber-700",
  };

  return (
    <div
      className={`rounded-full px-6 py-4 text-center text-base font-bold ${classes[variant]}`}
    >
      {children}
    </div>
  );
}

function WeeklyParetoCard() {
  return (
   <div className="mt-3 w-full rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">
        This Week&apos;s Best Pareto 20%
      </h2>

      <div className="mt-5 flex flex-col items-center justify-center gap-6 md:flex-row">
        <div className="relative h-52 w-52 rounded-full">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "conic-gradient(rgb(16 185 129) 0deg 72deg, rgb(226 232 240) 72deg 360deg)",
            }}
          />
          <div className="absolute inset-12 rounded-full bg-white" />
          <div className="absolute inset-0 flex items-center justify-center text-xl font-black text-slate-700">
            20%
          </div>
        </div>

        <div className="space-y-4 text-sm font-semibold">
          <div className="flex items-center gap-3 text-emerald-600">
            <span className="h-3 w-3 rounded-full bg-emerald-500" />
            Best Pareto 20%
          </div>

          <div className="h-px w-36 bg-slate-200" />

          <div className="flex items-center gap-3 text-slate-600">
            <span className="h-3 w-3 rounded-full bg-slate-300" />
            Other 80%
          </div>
        </div>
      </div>
    </div>
  );
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
    impactValue >= 8 ? "High" : impactValue >= 5 ? "Medium" : "Low";

  const effortMinutes =
    wakePlan?.effortMinutes ?? wakePlan?.block?.durationMinutes ?? 60;

  const paretoScore = (wakePlan?.paretoScore ?? 0).toFixed(2);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-50 px-5">
      <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500" />

      <div className="flex w-full max-w-2xl flex-1 flex-col items-center justify-center text-center">
        {wakePlan && (
          <>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6"
            >
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                  wakePlan.isReserved
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                {wakePlan.calendarReconnectRequired ? (
                  <WifiOff className="h-4 w-4" />
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
              className="w-full rounded-[32px] border border-slate-200 bg-white p-5 text-left shadow-sm"
            >
              <p className="bg-gradient-to-r from-emerald-500 to-green-400 bg-clip-text text-3xl font-black leading-none tracking-tight text-transparent">
                Pareto 20%
              </p>

              <h1 className="mt-5 text-3xl font-black leading-tight text-slate-900">
                {wakePlan.leverName ??
                  wakePlan.lever?.title ??
                  wakePlan.block.title}
              </h1>

              <p className="mt-4 text-base font-semibold text-slate-500">
                Recommended block:{" "}
                <span className="text-slate-700">
                  {wakePlan.recommendedStart ?? wakePlan.block.startTime}
                  {" - "}
                  {wakePlan.recommendedEnd ?? wakePlan.block.endTime}
                </span>
              </p>

              <div className="mt-6 rounded-[26px] bg-slate-50 p-7">
                <p className="text-lg font-black text-slate-900">
                  Why this was selected
                </p>

                <p className="mt-3 text-lg leading-9 text-slate-600 break-words">
                  {wakePlan.recommendationReason ??
                    wakePlan.why ??
                    "This is your highest-leverage move right now because it fits your available focus window and supports your most important lever."}
                </p>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <MetricPill variant="impact">
                  Impact: {impactLabel} ({impactValue})
                </MetricPill>

                <MetricPill variant="effort">
                  Effort: {effortMinutes} min
                </MetricPill>

                <MetricPill variant="confidence">
                  Confidence: {confidenceDisplay}%
                </MetricPill>

                <MetricPill variant="pareto">
                  Pareto Score: {paretoScore}
                </MetricPill>
              </div>

            </motion.div>

            <WeeklyParetoCard />
          </>
        )}

        {/* <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mt-8 text-base leading-relaxed text-slate-600"
        >
          {isLoading
            ? "Loading your focus plan..."
            : wakePlan
              ? wakePlan.sentence
              : "Connect your calendar to get started."}
        </motion.p> */}

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
        className="mb-8 mt-8 flex items-center gap-4"
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
        className="group mb-6 flex cursor-pointer flex-col items-center gap-2 text-slate-400 transition-colors hover:text-slate-600"
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