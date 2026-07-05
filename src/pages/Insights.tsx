import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Award, Clock, Share2, Target, Zap } from "lucide-react";
import { ErrorState } from "../components/ErrorState";
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
    focusHealthScore?: number;
    effectivenessBreakdown?: Array<{
      label: string;
      value: string;
      points: number;
    }>;
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

  trend?: Array<{
  day: string;
  protectedMinutes: number;
  completedMinutes: number;
}>;
  shareText: string;
};

function formatCategory(category: string) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function TrendChart({
  trend,
}: {
  trend?: Array<{
    day: string;
    protectedMinutes: number;
    completedMinutes: number;
  }>;
}) {
  if (!trend || trend.length === 0) return null;

  const maxMinutes = Math.max(
    1,
    ...trend.map((item) =>
      Math.max(item.protectedMinutes, item.completedMinutes)
    )
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-200 bg-white p-5"
    >
      <div className="mb-4 flex items-center gap-2">
        <Zap className="h-4 w-4 text-emerald-600" />
        <h2 className="text-sm font-semibold text-slate-800">
          7-Day Focus Trend
        </h2>
      </div>

      <div className="space-y-3">
        {trend.map((item) => {
          const protectedWidth = Math.round(
            (item.protectedMinutes / maxMinutes) * 100
          );

          const completedWidth = Math.round(
            (item.completedMinutes / maxMinutes) * 100
          );

          return (
            <div key={item.day}>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500">
                  {item.day}
                </p>

                <p className="text-xs text-slate-500">
                  {item.completedMinutes}/{item.protectedMinutes} min
                </p>
              </div>

              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-emerald-500"
                  style={{ width: `${protectedWidth}%` }}
                />
              </div>

              <div className="mt-1 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-blue-500"
                  style={{ width: `${completedWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex gap-4 text-xs text-slate-500">
        <span>🟢 Protected</span>
        <span>🔵 Completed</span>
      </div>
    </motion.section>
  );
}

export function Insights({ authReady }: { authReady: boolean }) {
  const [insights, setInsights] = useState<WeeklyInsights | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copyStatus, setCopyStatus] = useState("");
  const [recovery, setRecovery] = useState<any>(null);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function loadInsights() {
    setIsLoading(true);

    try {
      setError(null);

      const weeklyInsights = await apiWeeklyInsights();
      setInsights(weeklyInsights as WeeklyInsights);
    } catch {
      setError("Insights are temporarily unavailable.");
      setInsights(null);
    }

    try {
      const suggestion = await apiRecoverySuggestion();
      setRecovery(suggestion);
    } catch {
      setRecovery(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!authReady) return;

    loadInsights();
  }, [authReady]);

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

  if (error) {
    return (
      <ErrorState
        title="Unable to load insights"
        message={error}
        onRetry={loadInsights}
      />
    );
  }

  if (!insights) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 pb-24">
        <p className="text-sm text-slate-500">Unable to load insights.</p>
      </div>
    );
  }

  const fallbackFocusHealthScore = Math.min(
    100,
    Math.round(
      insights.summary.completionRate * 0.6 +
        insights.summary.needleMoverWins * 10 +
        (insights.summary.completedMinutes /
          Math.max(insights.summary.protectedMinutes, 1)) *
          20
    )
  );

  const focusHealthScore =
    insights.summary.focusHealthScore ?? fallbackFocusHealthScore;

  const effectivenessScore = focusHealthScore;

  const effectivenessBreakdown =
    insights.summary.effectivenessBreakdown ?? [
      {
        label: "Completion rate",
        value: `${insights.summary.completionRate}%`,
        points: Math.round(insights.summary.completionRate * 0.4),
      },
      {
        label: "Protected focus time",
        value: `${insights.summary.protectedMinutes} min`,
        points: Math.min(20, Math.round(insights.summary.protectedMinutes / 15)),
      },
      {
        label: "Completed focus time",
        value: `${insights.summary.completedMinutes} min`,
        points: Math.min(20, Math.round(insights.summary.completedMinutes / 12)),
      },
      {
        label: "Needle movers",
        value: `${insights.summary.needleMoverWins} wins`,
        points: Math.min(20, insights.summary.needleMoverWins * 4),
      },
    ];

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
          <div className="mb-4 flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-800">
              Focus Health Score
            </h2>
          </div>

          <div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-4xl font-black text-slate-900">
                {focusHealthScore}/100
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Overall focus performance
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm font-semibold text-slate-600">
                Completion: {insights.summary.completionRate}%
              </p>

              <p className="text-sm font-semibold text-slate-600">
                Wins: {insights.summary.needleMoverWins}
              </p>
            </div>
          </div>

          <div className="mt-4 h-3 rounded-full bg-slate-100">
            <div
              className="h-3 rounded-full bg-emerald-500"
              style={{
                width: `${Math.min(100, Math.max(0, focusHealthScore))}%`,
              }}
            />
          </div>

          <p className="mt-3 text-sm font-medium text-slate-600">
            {focusHealthScore >= 85
              ? "Excellent focus health. You are converting most protected time into meaningful progress."
              : focusHealthScore >= 65
                ? "Good momentum. Your next opportunity is improving completion consistency."
                : "Focus health needs attention. Protect fewer, higher-impact blocks this week."}
          </p>
        </div>
        </motion.section>
        <TrendChart trend={insights.trend} />
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
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">
                🛡 Protected
              </p>

              <p className="mt-2 text-3xl font-black text-emerald-700">
                {insights.summary.protectedMinutes}
              </p>

              <p className="mt-1 text-xs font-semibold text-emerald-600">
                minutes planned
              </p>
            </div>

            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-600">
                ✅ Completed
              </p>

              <p className="mt-2 text-3xl font-black text-blue-700">
                {insights.summary.completedMinutes}
              </p>

              <p className="mt-1 text-xs font-semibold text-blue-600">
                minutes finished
              </p>
            </div>

            <div className="rounded-xl bg-violet-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-violet-600">
                📈 Completion
              </p>

              <p className="mt-2 text-3xl font-black text-violet-700">
                {insights.summary.completionRate}%
              </p>

              <p className="mt-1 text-xs font-semibold text-violet-600">
                protected work completed
              </p>
            </div>

            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-600">
                🚀 Needle Movers
              </p>

              <p className="mt-2 text-3xl font-black text-amber-700">
                {insights.summary.needleMoverWins}
              </p>

              <p className="mt-1 text-xs font-semibold text-amber-600">
                high-value wins
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
              {insights.topLevers.map((lever, index) => {
                const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉";
                const label = index === 0 ? "Strongest lever" : "Supporting lever";
                const progress = Math.min(100, Math.max(8, lever.score * 2));

                return (
                  <div
                    key={lever.category}
                    className="rounded-xl bg-slate-50 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{medal}</span>

                        <div>
                          <p className="text-base font-black text-slate-900">
                            {formatCategory(lever.category)}
                          </p>

                          <p className="text-xs font-semibold text-slate-500">
                            {label}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">
                        {lever.score} pts
                      </div>
                    </div>

                    <div className="mt-4 h-3 rounded-full bg-white">
                      <div
                        className="h-3 rounded-full bg-violet-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                );
              })}
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
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                🤖 AI Coach
              </p>

              <p className="mt-2 text-sm leading-6 text-emerald-900">
                {insights.shareText}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Biggest Win
                </p>

                <p className="mt-2 text-sm font-semibold text-slate-800">
                  {insights.summary.needleMoverWins} high-value win
                  {insights.summary.needleMoverWins === 1 ? "" : "s"}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Opportunity
                </p>

                <p className="mt-2 text-sm font-semibold text-slate-800">
                  Improve completion from {insights.summary.completionRate}% to 85%.
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Next Goal
                </p>

                <p className="mt-2 text-sm font-semibold text-slate-800">
                  Complete another{" "}
                  {Math.max(
                    1,
                    Math.round(
                      (insights.summary.protectedMinutes -
                        insights.summary.completedMinutes) / 60
                    )
                  )}{" "}
                  hour of protected work.
                </p>
              </div>
            </div>
          </div>

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
                  Based on completion, protected time, completed time and needle
                  movers
                </p>
              </div>
            </div>

            <span className="text-xl font-bold text-slate-800">
              {effectivenessScore}
            </span>
          </div>

          <div className="border-t border-slate-100 px-5 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {effectivenessBreakdown.map((item) => (
              <div
                key={item.label}
                className="rounded-xl bg-slate-50 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {item.label}
                    </p>

                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {item.value}
                    </p>
                  </div>

                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-700">
                    +{item.points}
                  </span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white">
                <div
                  className="h-2 rounded-full bg-emerald-500"
                  style={{
                    width: `${Math.min(100, Math.max(0, item.points * 5))}%`,
                  }}
                />
              </div>
              </div>
            ))}
          </div>
        </div>
        </motion.section>
      </div>
    </div>
  );
}