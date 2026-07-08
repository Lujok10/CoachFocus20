import type { ProductivityDay } from "./productivityMemory";

export type PredictiveInsight = {
  id: string;
  title: string;
  description: string;
  severity: "positive" | "warning" | "neutral";
};

export function getPredictiveInsights(
  history: ProductivityDay[]
): PredictiveInsight[] {
  if (history.length === 0) {
    return [
      {
        id: "not-enough-data",
        title: "Learning your pattern",
        description:
          "Complete a few focus blocks so Focus20 can start predicting your productivity.",
        severity: "neutral",
      },
    ];
  }

  const last7 = history.slice(-7);

  const totalScheduled = last7.reduce(
    (sum, day) => sum + day.scheduledFocusBlocks,
    0
  );

  const totalCompleted = last7.reduce(
    (sum, day) => sum + day.completedFocusBlocks,
    0
  );

  const totalMinutes = last7.reduce(
    (sum, day) => sum + day.totalFocusMinutes,
    0
  );

  const totalInterruptions = last7.reduce(
    (sum, day) => sum + day.interruptions,
    0
  );

  const completionRate =
    totalScheduled === 0
      ? 0
      : Math.round((totalCompleted / totalScheduled) * 100);

  const insights: PredictiveInsight[] = [];

  insights.push({
    id: "completion-forecast",
    title: `${completionRate}% focus completion trend`,
    description:
      completionRate >= 80
        ? "You are trending toward a strong focus week if you maintain this pace."
        : completionRate >= 50
          ? "Your focus trend is steady, but one protected block today could lift your weekly momentum."
          : "Your current trend suggests a higher risk of missed focus blocks. Simplify today's plan.",
    severity:
      completionRate >= 80
        ? "positive"
        : completionRate >= 50
          ? "neutral"
          : "warning",
  });

  insights.push({
    id: "deep-work-forecast",
    title: `${totalMinutes} minutes of deep work tracked`,
    description:
      totalMinutes >= 300
        ? "You are building strong deep-work volume this week."
        : "Focus20 recommends protecting at least one 60-minute block today.",
    severity: totalMinutes >= 300 ? "positive" : "neutral",
  });

  if (totalInterruptions >= 10) {
    insights.push({
      id: "interruption-risk",
      title: "High interruption risk",
      description:
        "Your recent pattern shows frequent interruptions. Add buffer time before your next focus block.",
      severity: "warning",
    });
  } else {
    insights.push({
      id: "interruption-risk",
      title: "Low interruption pressure",
      description:
        "Your recent interruption load looks manageable. This is a good time to protect deeper work.",
      severity: "positive",
    });
  }

  return insights;
}