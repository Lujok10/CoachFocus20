import type { ProductivityDay } from "./productivityMemory";

export type ReadinessResult = {
  score: number;
  summary: string;
};

export function calculateReadiness(
  history: ProductivityDay[]
): ReadinessResult {
  if (history.length === 0) {
    return {
      score: 70,
      summary:
        "Complete a few focus sessions so Focus20 can personalize your readiness score.",
    };
  }

  const last7 = history.slice(-7);

  const completedBlocks = last7.reduce(
    (sum, day) => sum + day.completedFocusBlocks,
    0
  );

  const scheduledBlocks = last7.reduce(
    (sum, day) => sum + day.scheduledFocusBlocks,
    0
  );

  const totalMinutes = last7.reduce(
    (sum, day) => sum + day.totalFocusMinutes,
    0
  );

  const streak = calculateStreak(history);

  const completion =
    scheduledBlocks === 0 ? 0 : completedBlocks / scheduledBlocks;

  let score =
    completion * 70 +
    Math.min(totalMinutes / 5, 20) +
    Math.min(streak * 2, 10);

  score = Math.round(Math.max(40, Math.min(score, 99)));

  let summary = "You have a moderate chance of completing today's goals.";

  if (score >= 85) {
    summary = "Excellent conditions for deep work today.";
  } else if (score >= 70) {
    summary = "You have solid momentum. Protect one key focus block today.";
  } else if (score <= 50) {
    summary = "Your recent pattern suggests simplifying today's schedule.";
  }

  return {
    score,
    summary,
  };
}

function calculateStreak(history: ProductivityDay[]) {
  let streak = 0;

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));

  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].completedFocusBlocks > 0) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}