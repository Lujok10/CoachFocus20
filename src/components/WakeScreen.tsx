import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  CalendarPlus,
  ChevronUp,
  HelpCircle,
  Mic,
  Play,
  Sparkles,
  Trophy,
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

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function calculateDailyScore(input: {
  impact: number;
  confidence: number;
  paretoScore: number;
  category?: string;
  protectedMinutes: number;
  wins?: number;
  streakDays?: number;
}) {
  const confidence =
    input.confidence > 1 ? input.confidence : input.confidence * 100;

  const wins = input.wins ?? 0;
  const streakDays = input.streakDays ?? 0;

  let score = 25;

  // Actual execution should matter most.
  score += Math.min(25, wins * 12);

  // Streak should help, but not dominate.
  score += Math.min(15, streakDays * 5);

  // Protected time should help gradually.
  score += Math.min(15, input.protectedMinutes / 20);

  // Recommendation quality should help, but should not create a fake high score.
  score += Math.min(15, input.paretoScore * 10);

  // Confidence should add a small amount only.
  score += Math.min(10, confidence * 0.1);

  // Impact should add a small amount only.
  score += Math.min(10, input.impact);

  // Category bonus should be tiny.
  if (input.category === "income") {
    score += 3;
  } else if (input.category === "learning") {
    score += 2;
  } else if (input.category === "health") {
    score += 2;
  } else {
    score += 1;
  }

  return clampNumber(Math.round(score), 0, 100);
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

function categoryIcon(category?: string) {
  if (category === "income") return "💰";
  if (category === "learning") return "📚";
  if (category === "health") return "💪";
  if (category === "family") return "🏡";
  if (category === "admin") return "🧩";
  return "⚡";
}

function DailyScoreCard({ score }: { score: number }) {
  return (
    <div className="mt-3 w-full rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Focus20 Daily Score
          </p>
          <p className="mt-1 text-3xl font-black text-slate-900">
            {score}/100
          </p>
        </div>

        <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">
          {score >= 80 ? "Excellent" : score >= 65 ? "Strong" : "Building"}
        </div>
      </div>

      <div className="mt-4 h-3 rounded-full bg-slate-100">
        <div
          className="h-3 rounded-full bg-emerald-500"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function CoachInsightCard({
  message,
}: {
  message?: string;
}) {
  if (!message) return null;

  return (
    <div className="mt-3 w-full rounded-[28px] border border-emerald-100 bg-emerald-50 p-5 text-left shadow-sm">
      <p className="text-sm font-black uppercase tracking-wide text-emerald-700">
        Coach Insight
      </p>

      <p className="mt-3 text-base leading-7 text-slate-700">
        {message}
      </p>
    </div>
  );
}
function NeedleMoverCard({ wins }: { wins: number }) {
  return (
    <div className="mt-3 w-full rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Needle Movers
          </p>

          <p className="mt-1 text-3xl font-black text-slate-900">
            {wins} this week
          </p>
        </div>

        <div className="rounded-full bg-amber-50 px-4 py-2 text-sm font-black text-amber-700">
          🎯 High value
        </div>
      </div>
    </div>
  );
}

function PredictedOutcomeCard({
  success,
  gain,
}: {
  success: number;
  gain: number;
}) {
  return (
    <div className="mt-3 w-full rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
        Predicted Outcome
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-emerald-50 p-4">
          <p className="text-xs uppercase text-emerald-700">
            Success Chance
          </p>

          <p className="mt-2 text-3xl font-black text-emerald-700">
            {success}%
          </p>
        </div>

        <div className="rounded-2xl bg-blue-50 p-4">
          <p className="text-xs uppercase text-blue-700">
            Expected Gain
          </p>

          <p className="mt-2 text-3xl font-black text-blue-700">
            +{gain}
          </p>
        </div>
      </div>
    </div>
  );
}
function XpCard({
  xp,
  level,
  nextLevel,
}: {
  xp: number;
  level: number;
  nextLevel: number;
}) {
  const progress = clampNumber(Math.round((xp / Math.max(nextLevel, 1)) * 100), 0, 100);

  return (
    <div className="mt-3 w-full rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Focus20 XP
          </p>
          <p className="mt-1 text-3xl font-black text-slate-900">
            Level {level}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {xp} / {nextLevel} XP
          </p>
        </div>

        <div className="rounded-full bg-purple-50 px-4 py-2 text-sm font-black text-purple-700">
          ⚡ Growing
        </div>
      </div>

      <div className="mt-4 h-3 rounded-full bg-slate-100">
        <div
          className="h-3 rounded-full bg-purple-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function PerformanceSummaryCard({
  streakDays,
  weeklyGoalCompleted,
  weeklyGoalTarget,
  weeklyGoalPercent,
  momentum,
  focusRoi,
}: {
  streakDays: number;
  weeklyGoalCompleted: number;
  weeklyGoalTarget: number;
  weeklyGoalPercent: number;
  momentum: "rising" | "stable" | "falling";
  focusRoi: "high" | "medium" | "low";
}) {
  const momentumLabel =
    momentum === "rising" ? "Rising ↑" : momentum === "falling" ? "Falling ↓" : "Stable →";

  return (
    <div className="mt-3 w-full rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-orange-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-orange-600">
            Current streak
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900">
            🔥 {streakDays} days
          </p>
        </div>

        <div className="rounded-2xl bg-emerald-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">
            Momentum
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900">
            {momentumLabel}
          </p>
        </div>

        <div className="rounded-2xl bg-blue-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">
           High-Leverage Goal
          </p>
          <p className="mt-1 text-xl font-black text-slate-900">
            {weeklyGoalCompleted}/{weeklyGoalTarget} blocks
          </p>

          <div className="mt-3 h-2 rounded-full bg-white">
            <div
              className="h-2 rounded-full bg-blue-500"
              style={{ width: `${weeklyGoalPercent}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl bg-purple-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-purple-600">
            Focus ROI
          </p>
          <p className="mt-1 text-2xl font-black capitalize text-slate-900">
            {focusRoi}
          </p>
        </div>
      </div>
    </div>
  );
}

function WeeklyParetoCard({
  category,
  paretoShare,
  protectedMinutes,
  wins,
}: {
  category?: string;
  paretoShare: number;
  protectedMinutes: number;
  wins: number;
}) {
  const safeShare = clampNumber(Math.round(paretoShare), 5, 45);
  const degrees = safeShare * 3.6;

  return (
    <div className="mt-3 w-full rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">
          Weekly High-Leverage Focus
        </h2>

        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
          <Trophy className="h-3.5 w-3.5" />
          {wins} wins
        </div>
      </div>

      <div className="mt-5 flex flex-col items-center justify-center gap-6 md:flex-row">
        <div className="relative h-52 w-52 rounded-full">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(rgb(16 185 129) 0deg ${degrees}deg, rgb(226 232 240) ${degrees}deg 360deg)`,
            }}
          />

          <div className="absolute inset-12 rounded-full bg-white" />

          <div className="absolute inset-0 flex items-center justify-center text-xl font-black text-slate-700">
            {safeShare}%
          </div>
        </div>

        <div className="space-y-4 text-sm font-semibold">
          <div className="flex items-center gap-3 text-emerald-600">
            <span className="h-3 w-3 rounded-full bg-emerald-500" />
            High-Leverage Work {safeShare}%
          </div>

          <div className="h-px w-36 bg-slate-200" />

          <div className="flex items-center gap-3 text-slate-600">
            <span className="h-3 w-3 rounded-full bg-slate-300" />
            Everything Else {100 - safeShare}%
          </div>

          <div className="rounded-2xl bg-slate-50 p-3 text-slate-700">
            Top lever:{" "}
            <span className="font-black">
              {categoryIcon(category)} {category ?? "focus"}
            </span>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3 text-slate-700">
            Protected:{" "}
            <span className="font-black">{protectedMinutes} min</span>
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
  const [whyNotIndex, setWhyNotIndex] = useState<number | null>(null);

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

const paretoScoreNumber = wakePlan?.paretoScore ?? 0;
const paretoScore = paretoScoreNumber.toFixed(2);

const selectedTitle =
  wakePlan?.leverName ?? wakePlan?.lever?.title ?? wakePlan?.block?.title;

const selectedCategory =
  wakePlan?.lever?.category ?? wakePlan?.block?.leverCategory;

const weeklyProtectedMinutes =
  wakePlan?.weeklyProtectedMinutes ?? effortMinutes;

const weeklyWins =
  wakePlan?.paretoWins ?? Math.max(0, Math.round(paretoScoreNumber));

const needleMoverWins = wakePlan?.weeklyNeedleMoverWins ?? 0; 

const xp = wakePlan?.xp ?? 0;
const xpLevel = wakePlan?.xpLevel ?? 1;
const xpNextLevel = wakePlan?.xpNextLevel ?? 500;

const dailyScore = wakePlan
  ? calculateDailyScore({
      impact: impactValue,
      confidence: confidenceDisplay,
      paretoScore: paretoScoreNumber,
      category: selectedCategory,
      protectedMinutes: weeklyProtectedMinutes,
      wins: weeklyWins,
      streakDays: wakePlan.streakDays ?? 0,
    })
  : 0;

const weeklyParetoShare = clampNumber(
  wakePlan?.weeklyParetoShare ??
    Math.round((paretoScoreNumber / 2) * 100),
  0,
  100
);const predictedSuccess =
  wakePlan?.predictedSuccess ?? 70;

const predictedGain =
  wakePlan?.predictedProductivityGain ?? 10;


const streakDays = wakePlan?.streakDays ?? 0;

const weeklyGoalTarget = wakePlan?.weeklyGoalTarget ?? 5;

const weeklyGoalCompleted =
  wakePlan?.weeklyGoalCompleted ?? weeklyWins;

const weeklyGoalPercent =
  wakePlan?.weeklyGoalPercent ??
  clampNumber(
    Math.round((weeklyGoalCompleted / Math.max(weeklyGoalTarget, 1)) * 100),
    0,
    100
  );

const momentum =
  wakePlan?.momentum ??
  (weeklyWins >= 3 ? "rising" : weeklyWins >= 1 ? "stable" : "falling");

const focusRoi =
  wakePlan?.focusRoi ??
  (selectedCategory === "income" && weeklyWins >= 1
    ? "high"
    : weeklyProtectedMinutes >= 120
      ? "medium"
      : "low");
 

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
                {categoryIcon(selectedCategory)} {selectedTitle}
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

                <p className="mt-3 break-words text-lg leading-9 text-slate-600">
                  {wakePlan.recommendationReason ??
                    wakePlan.why ??
                    "This is your highest-leverage move right now because it fits your available focus window and supports your most important lever."}
                </p>
              </div>
            <CoachInsightCard message={wakePlan.coachInsight?.message} />
            <PredictedOutcomeCard
                success={predictedSuccess}
                gain={predictedGain}
              />
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

            <DailyScoreCard score={dailyScore} />
            <NeedleMoverCard wins={needleMoverWins} />
            <XpCard xp={xp} level={xpLevel} nextLevel={xpNextLevel} />

            <PerformanceSummaryCard
              streakDays={streakDays}
              weeklyGoalCompleted={weeklyGoalCompleted}
              weeklyGoalTarget={weeklyGoalTarget}
              weeklyGoalPercent={weeklyGoalPercent}
              momentum={momentum}
              focusRoi={focusRoi}
            />
               {wakePlan.alternatives?.length > 0 && (
                <div className="mt-3 w-full rounded-[24px] border border-slate-200 bg-white p-4 text-left shadow-sm">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-500" />

                    <p className="text-sm font-black uppercase tracking-wide text-slate-500">
                      Other strong options today
                    </p>
                  </div>

                  <div className="mt-3 space-y-3">
                    {wakePlan.alternatives.slice(0, 2).map((alt, index) => (
                      <div
                        key={`${alt.title}-${index}`}
                        className="rounded-2xl bg-slate-50 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-slate-900">
                              {categoryIcon(alt.category)} {alt.title}
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                              {categoryIcon(alt.category)} {alt.category} •{" "}
                              {alt.time}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setWhyNotIndex(
                                whyNotIndex === index ? null : index
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600"
                          >
                            <HelpCircle className="h-3.5 w-3.5" />
                            Why not?
                          </button>
                        </div>

                        {whyNotIndex === index && (
                          <p className="mt-3 rounded-xl bg-white p-3 text-sm leading-6 text-slate-600">
                            {alt.whyNotReason ??
                              `${selectedTitle} was selected first because it had the strongest combined Pareto score right now: category priority, impact, confidence, timing, and effort. ${alt.title} is still a strong backup option for later today.`}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            <WeeklyParetoCard
              category={wakePlan.weeklyTopLever ?? selectedCategory}
              paretoShare={weeklyParetoShare}
              protectedMinutes={weeklyProtectedMinutes}
              wins={weeklyWins}
            />
          </>
        )}

        {isLoading && !wakePlan && (
          <p className="mt-8 text-base leading-relaxed text-slate-600">
            Loading your focus plan...
          </p>
        )}

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