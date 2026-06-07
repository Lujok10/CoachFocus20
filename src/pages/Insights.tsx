import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Award, Clock, Share2, Target, Zap } from "lucide-react";
import {
  apiAutoRescheduleMissedWork,
  apiRecoverySuggestion,
  apiWeeklyInsights,
} from "../services/apiClient";

type WeeklyInsights = {
  weekStart: string;
  generatedAt: string;
  summary: {
    protectedMinutes: number;
    completedMinutes: number;
    completionRate: number;
    needleMoverWins: number;
    totalBlocks: number;
    completedBlocks: number;
    missedBlocks: number;
  };
  topLevers: Array<{
    category: string;
    score: number;
  }>;
  timeLeaks: Array<{
    title: string;
    category: string;
    startIso: string;
    reason: string;
  }>;
  shareText: string;
};

function formatCategory(category: string) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function Insights() {
  const [insights, setInsights] = useState<WeeklyInsights | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copyStatus, setCopyStatus] = useState("");
  const [recovery, setRecovery] = useState<any>(null);
  const [recoveryMessage, setRecoveryMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const weeklyInsights = await apiWeeklyInsights();
        setInsights(weeklyInsights);
      } catch (error) {
        console.error("Failed to load weekly insights", error);
      }

      try {
        const suggestion = await apiRecoverySuggestion();
        setRecovery(suggestion);
      } catch {
        setRecovery(null);
      }

      setIsLoading(false);
    }

    load();
  }, []);

  async function handleShare() {
    if (!insights?.shareText) return;

    try {
      await navigator.clipboard.writeText(insights.shareText);
      setCopyStatus("Copied");
      setTimeout(() => setCopyStatus(""), 2000);
    } catch {
      setCopyStatus("Copy failed");
      setTimeout(() => setCopyStatus(""), 2000);
    }
  }

  async function handleAutoReschedule() {
    setRecoveryMessage("");

    try {
      const result = (await apiAutoRescheduleMissedWork()) as {
            rescheduled?: boolean;
            reason?: string;
          };

      if (result.rescheduled) {
        setRecoveryMessage("Recovery block scheduled.");
        setRecovery(null);
      } else {
        setRecoveryMessage(result.reason ?? "No missed work found.");
      }
    } catch (error) {
      setRecoveryMessage(
        error instanceof Error ? error.message : "Recovery scheduling failed."
      );
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 pb-24">
        <p className="text-sm text-slate-500">Loading insights...</p>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 pb-24">
        <p className="text-sm text-slate-500">Unable to load insights.</p>
      </div>
    );
  }

  const effectivenessScore =
    insights.summary.totalBlocks === 0
      ? 0
      : Math.round(
          (insights.summary.completionRate / 100) *
            Math.min(100, insights.summary.needleMoverWins * 25)
        );

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="px-4 py-4">
          <h1 className="text-xl font-semibold text-slate-800">Insights</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your weekly performance
          </p>
        </div>
      </header>

      <div className="space-y-4 px-4 py-4">
        {recovery && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">
              Recovery Suggestion
            </p>

            <p className="mt-2 text-sm text-amber-800">
              You missed “{recovery.title}”. Best recovery slot:{" "}
              {new Date(recovery.suggestedStartIso).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
              .
            </p>

            <p className="mt-2 text-xs text-amber-700">
              Burnout risk: {recovery.burnoutRisk}
            </p>

            {recovery.burnoutSignals?.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-700">
                {recovery.burnoutSignals.map((signal: string) => (
                  <li key={signal}>{signal}</li>
                ))}
              </ul>
            )}

            <button
              onClick={handleAutoReschedule}
              className="mt-3 rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white"
            >
              Auto-reschedule
            </button>
          </div>
        )}

        {recoveryMessage && (
          <p className="rounded-xl bg-slate-900 px-4 py-3 text-sm text-white">
            {recoveryMessage}
          </p>
        )}

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-200 bg-white p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">
              Weekly Impact Report
            </h2>

            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-100"
            >
              <Share2 className="h-3.5 w-3.5" />
              {copyStatus || "Copy Summary"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-emerald-50 p-3">
              <p className="text-2xl font-bold text-emerald-700">
                {insights.summary.protectedMinutes}
              </p>
              <p className="mt-0.5 text-xs text-emerald-600">
                Protected minutes
              </p>
            </div>

            <div className="rounded-xl bg-blue-50 p-3">
              <p className="text-2xl font-bold text-blue-700">
                {insights.summary.completedMinutes}
              </p>
              <p className="mt-0.5 text-xs text-blue-600">
                Completed minutes
              </p>
            </div>

            <div className="rounded-xl bg-violet-50 p-3">
              <p className="text-2xl font-bold text-violet-700">
                {insights.summary.completionRate}%
              </p>
              <p className="mt-0.5 text-xs text-violet-600">
                Completion rate
              </p>
            </div>

            <div className="rounded-xl bg-amber-50 p-3">
              <p className="text-2xl font-bold text-amber-700">
                {insights.summary.needleMoverWins}
              </p>
              <p className="mt-0.5 text-xs text-amber-600">
                Needle-mover wins
              </p>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-slate-200 bg-white p-5"
        >
          <div className="mb-4 flex items-center gap-2">
            <Target className="h-4 w-4 text-violet-600" />
            <h2 className="text-sm font-semibold text-slate-800">
              Top 3 Levers
            </h2>
          </div>

          {insights.topLevers.length === 0 ? (
            <p className="text-sm text-slate-500">
              Complete a few check-ins to reveal your top levers.
            </p>
          ) : (
            <div className="space-y-3">
              {insights.topLevers.map((lever, index) => (
                <div
                  key={lever.category}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-600">
                      {index + 1}
                    </span>
                    <span className="text-sm text-slate-700">
                      {formatCategory(lever.category)}
                    </span>
                  </div>

                  <span className="text-xs font-medium text-slate-500">
                    Score {lever.score}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {insights.timeLeaks.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-amber-200 bg-amber-50 p-5"
          >
            <div className="mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-semibold text-amber-800">
                Time Leak Alerts
              </h2>
            </div>

            <div className="space-y-2">
              {insights.timeLeaks.map((leak, index) => (
                <div
                  key={`${leak.title}-${index}`}
                  className="rounded-xl bg-white/70 p-3"
                >
                  <p className="text-sm font-medium text-amber-900">
                    {leak.title}
                  </p>
                  <p className="mt-1 text-xs text-amber-700">
                    {leak.reason} • {formatCategory(leak.category)}
                  </p>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-slate-200 bg-white p-5"
        >
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-slate-800">
              Weekly Summary
            </h2>
          </div>

          <p className="text-sm leading-6 text-slate-600">
            {insights.shareText}
          </p>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
        >
          <div className="flex items-center justify-between p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500">
                <Award className="h-5 w-5 text-white" />
              </div>

              <div>
                <h2 className="text-sm font-semibold text-slate-800">
                  Effectiveness Score
                </h2>
                <p className="text-xs text-slate-500">
                  Completion rate × needle-mover wins
                </p>
              </div>
            </div>

            <span className="text-xl font-bold text-slate-800">
              {effectivenessScore}
            </span>
          </div>
        </motion.section>
      </div>
    </div>
  );
}