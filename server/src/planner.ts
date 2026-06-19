import OpenAI from "openai";
import { prisma, ensureUser } from "./db";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const allowedCategories = [
  "income",
  "health",
  "family",
  "admin",
  "learning",
  "creative",
];

type LeverCategory =
  | "income"
  | "health"
  | "family"
  | "admin"
  | "learning"
  | "creative";

export type PlannerInput = {
  rules: any;
  patternProfile: any;
  recentFeedback: any[];
  recentBlocks: any[];
  recentTasks: any[];
  candidateTasks: PlannerCandidate[];
  availableWindows: Array<{
    startIso: string;
    endIso: string;
    score: number;
    label: string;
  }>;
  contextSignals: {
    overdueTaskCount: number;
    scheduledTaskCount: number;
    completedStreakDays: number;
    missedLast7Days: number;
    completionRateLast14Days: number;
    meetingDensityScore: number;
    bestWindowScore: number;
    energyWindowLabel: string;
  };
};

export type PlannerCandidate = {
  id: string;
  source: "task" | "focus_pattern";
  title: string;
  category: LeverCategory;
  dueDateIso?: string | null;
  overdue: boolean;
  scheduled: boolean;
  historicalScore: number;
  urgencyScore: number;
  streakScore: number;
  meetingDensityScore: number;
  energyScore: number;
  totalScore: number;
  reasonSignals: string[];
};

export type PlannerOutput = {
  leverTitle: string;
  leverCategory: LeverCategory;
  why: string;
  plan: string[];
  alternatives: Array<{
    title: string;
    category: LeverCategory;
  }>;
  confidence: number;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function normalizeCategory(category?: string | null): LeverCategory {
  if (category && allowedCategories.includes(category)) {
    return category as LeverCategory;
  }

  return "admin";
}

function daysBetween(a: Date, b: Date) {
  const day = 24 * 60 * 60 * 1000;
  return Math.floor((a.getTime() - b.getTime()) / day);
}

function isSameDay(a: Date, b: Date) {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

function calculateStreakDays(blocks: any[], tasks: any[]) {
  const completedDates = new Set<string>();

  for (const block of blocks) {
    if (block.status === "completed") {
      completedDates.add(block.startIso.toISOString().slice(0, 10));
    }
  }

  for (const task of tasks) {
    if (task.status === "completed" && task.startIso) {
      completedDates.add(task.startIso.toISOString().slice(0, 10));
    }
  }

  let streak = 0;
  const cursor = new Date();

  for (let i = 0; i < 30; i += 1) {
    const key = cursor.toISOString().slice(0, 10);

    if (!completedDates.has(key)) {
      break;
    }

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function getWindowLabel(date: Date) {
  const hour = date.getHours();

  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";

  return "evening";
}

function getDefaultWindows() {
  const today = new Date();

  const configs = [
    { start: "09:30", end: "10:30", score: 0.8, label: "strong focus" },
    { start: "11:00", end: "12:00", score: 0.72, label: "strong focus" },
    { start: "14:00", end: "15:00", score: 0.62, label: "strong focus" },
  ];

  return configs.map((item) => {
    const [startHour, startMinute] = item.start.split(":").map(Number);
    const [endHour, endMinute] = item.end.split(":").map(Number);

    const start = new Date(today);
    start.setHours(startHour, startMinute, 0, 0);

    const end = new Date(today);
    end.setHours(endHour, endMinute, 0, 0);

    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      score: item.score,
      label: item.label,
    };
  });
}

function categoryScoreFromProfile(patternProfile: any, category: LeverCategory) {
  const rankings =
    (patternProfile?.leverRankings as Array<{
      category: string;
      score: number;
    }>) ?? [];

  const found = rankings.find((item) => item.category === category);

  return found?.score ?? 0.5;
}

function buildWhy(candidate: PlannerCandidate, input: PlannerInput) {
  const reasons = [...candidate.reasonSignals];

  if (candidate.overdue) {
    reasons.push("it is overdue");
  }

  if (candidate.energyScore >= 18) {
    reasons.push("this aligns with one of your stronger focus windows");
  }

  if (input.contextSignals.meetingDensityScore >= 15) {
    reasons.push("your calendar density makes protected execution more important today");
  }

  if (input.contextSignals.completedStreakDays > 0) {
    reasons.push(`you have a ${input.contextSignals.completedStreakDays}-day completion streak to protect`);
  }

  const unique = [...new Set(reasons)].slice(0, 3);

  if (unique.length === 0) {
    return "This is the strongest current needle-mover based on your recent completion pattern.";
  }

  return `This matters now because ${unique.join(", ")}.`;
}

function buildPlan(candidate: PlannerCandidate) {
  if (candidate.overdue) {
    return [
      "Open the overdue task and identify the smallest finishable piece.",
      "Work for one protected block without switching context.",
      "Leave a clear next action or mark it complete.",
    ];
  }

  if (candidate.category === "learning") {
    return [
      "Open the exact lesson, lab, or note.",
      "Complete one focused learning rep.",
      "Write a 3-line summary before stopping.",
    ];
  }

  if (candidate.category === "income") {
    return [
      "Open the revenue-impact task or proposal.",
      "Ship the smallest valuable progress today.",
      "Capture the next money-moving action.",
    ];
  }

  if (candidate.category === "health") {
    return [
      "Choose the one health action with the highest payoff.",
      "Protect the time block from interruptions.",
      "Record whether it improved your energy.",
    ];
  }

  return [
    "Open the task or workspace.",
    "Work for the protected focus block.",
    "Capture the next action before stopping.",
  ];
}

function sanitizePlannerOutput(output: PlannerOutput): PlannerOutput {
  const category = normalizeCategory(output.leverCategory);

  return {
    leverTitle: improveRecommendationTitle({
      title:
        output.leverTitle?.slice(0, 90) ||
        "protect your highest-leverage task",
      category,
    }),
    leverCategory: category,
    why:
      output.why?.slice(0, 220) ||
      "This is the best current needle-mover based on your recent patterns.",
    plan: Array.isArray(output.plan)
      ? output.plan.slice(0, 3).map((item) => String(item).slice(0, 120))
      : [
          "Start the task.",
          "Protect the block.",
          "Capture the next action.",
        ],
    alternatives: Array.isArray(output.alternatives)
      ? output.alternatives.slice(0, 2).map((alt) => ({
          title: String(alt.title ?? "alternate focus task").slice(0, 90),
          category: normalizeCategory(alt.category),
        }))
      : [],
    confidence: clamp(Number(output.confidence) || 70, 40, 95),
  };
}

export async function buildPlannerInput(
  userId: string
): Promise<PlannerInput> {
  await ensureUser(userId);

  const now = new Date();

  const since30 = new Date(now);
  since30.setDate(now.getDate() - 30);

  const since14 = new Date(now);
  since14.setDate(now.getDate() - 14);

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);

  const [user, patternProfile, recentFeedback, recentBlocks, recentTasks] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
      }),

      prisma.patternProfile.findUnique({
        where: { userId },
      }),

      prisma.feedback.findMany({
        where: {
          userId,
          createdAt: {
            gte: since30,
          },
        },
        include: {
          focusBlock: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 30,
      }),

      prisma.focusBlock.findMany({
        where: {
          userId,
          startIso: {
            gte: since30,
          },
        },
        orderBy: {
          startIso: "desc",
        },
      }),

      prisma.task.findMany({
        where: {
          userId,
          OR: [
            {
              startIso: {
                gte: since30,
              },
            },
            {
              dueDateIso: {
                not: null,
              },
            },
            {
              status: {
                in: ["unscheduled", "scheduled", "started"],
              },
            },
          ],
        },
        orderBy: [{ dueDateIso: "asc" }, { createdAt: "desc" }],
        take: 50,
      }),
    ]);

  const bestWindowsRaw =
    (patternProfile?.bestWindows as Array<{
      start: string;
      end: string;
      score: number;
    }>) ?? [];

  const availableWindows =
    bestWindowsRaw.length > 0
      ? bestWindowsRaw.slice(0, 3).map((window) => {
          const today = new Date();
          const [startHour, startMinute] = String(window.start)
            .split(":")
            .map(Number);
          const [endHour, endMinute] = String(window.end)
            .split(":")
            .map(Number);

          const start = new Date(today);
          start.setHours(startHour || 9, startMinute || 30, 0, 0);

          const end = new Date(today);
          end.setHours(endHour || 10, endMinute || 30, 0, 0);

          return {
            startIso: start.toISOString(),
            endIso: end.toISOString(),
            score: Number(window.score) || 0.6,
            label: getWindowLabel(start),
          };
        })
      : getDefaultWindows();

  const completedStreakDays = calculateStreakDays(recentBlocks, recentTasks);

  const last14Items = [
    ...recentBlocks.filter((block) => block.startIso >= since14),
    ...recentTasks.filter((task) => task.startIso && task.startIso >= since14),
  ];

  const completedLast14 = last14Items.filter(
    (item) => item.status === "completed"
  ).length;

  const missedLast7Days =
    recentBlocks.filter(
      (block) => block.startIso >= weekStart && block.status === "missed"
    ).length +
    recentTasks.filter(
      (task) => task.startIso && task.startIso >= weekStart && task.status === "missed"
    ).length;

  const completionRateLast14Days =
    last14Items.length === 0 ? 0 : completedLast14 / last14Items.length;

  const todayScheduledItems =
    recentBlocks.filter((block) => isSameDay(block.startIso, now)).length +
    recentTasks.filter((task) => task.startIso && isSameDay(task.startIso, now))
      .length;

  const meetingDensityScore = clamp(todayScheduledItems * 8, 0, 24);

  const bestWindow = availableWindows.sort((a, b) => b.score - a.score)[0];
  const bestWindowScore = clamp((bestWindow?.score ?? 0.6) * 25, 0, 25);
  const energyWindowLabel = "strong focus";

  const overdueTaskCount = recentTasks.filter(
    (task) =>
      task.dueDateIso &&
      task.dueDateIso < now &&
      task.status !== "completed"
  ).length;

  const scheduledTaskCount = recentTasks.filter(
    (task) => task.status === "scheduled"
  ).length;

 const candidateTasks: PlannerCandidate[] = recentTasks
  .filter(
    (task) =>
      task.status !== "completed" &&
      task.title &&
      task.title.trim().length >= 8
  )
  .map((task) => {
    let category = normalizeCategory(task.category);

    const title = task.title.trim();
    const titleLower = title.toLowerCase();

    if (
      titleLower.includes("gym") ||
      titleLower.includes("run") ||
      titleLower.includes("workout") ||
      titleLower.includes("exercise")
    ) {
      category = "health";
    }

    if (
      titleLower.includes("study") ||
      titleLower.includes("reading") ||
      titleLower.includes("read") ||
      titleLower.includes("course")
    ) {
      category = "learning";
    }

    if (
      titleLower.includes("work") ||
      titleLower.includes("client") ||
      titleLower.includes("business") ||
      titleLower.includes("video")
    ) {
      category = "income";
    }

    const looksLikeGarbage =
      !/[aeiou]/i.test(title) || /^[a-z]{1,6}$/i.test(title);

    if (looksLikeGarbage) {
      return null;
    }

    const overdue = Boolean(task.dueDateIso && task.dueDateIso < now);
    const dueDate = task.dueDateIso ? new Date(task.dueDateIso) : null;
    const daysOverdue =
      overdue && dueDate ? Math.max(1, daysBetween(now, dueDate)) : 0;

    const historicalScore =
      categoryScoreFromProfile(patternProfile, category) * 30;
      console.log(
        task.title,
        category,
        categoryScoreFromProfile(patternProfile, category)
      );

    const urgencyScore = overdue
      ? clamp(16 + daysOverdue * 3, 16, 30)
      : task.dueDateIso
        ? 10
        : 4;

    const streakScore =
      completedStreakDays > 0 ? clamp(6 + completedStreakDays, 0, 15) : 0;

    const energyScore = bestWindowScore;
    const scheduledPenalty = task.status === "scheduled" ? -4 : 0;

    const baseScore =
      historicalScore +
      urgencyScore +
      streakScore +
      meetingDensityScore +
      energyScore +
      scheduledPenalty;

    const lowLeveragePenalty =
      (category === "health" || category === "admin") && baseScore < 60
        ? -25
        : 0;

    const totalScore = baseScore + lowLeveragePenalty;

    const reasonSignals: string[] = [];

    if (overdue) reasonSignals.push("it is overdue");
    if (historicalScore >= 20) {
      reasonSignals.push(`${category} has been a strong lever`);
    }
    if (streakScore > 0) {
      reasonSignals.push("it protects your current progress streak");
    }
    if (energyScore >= 15) {
      reasonSignals.push("it fits one of your stronger focus windows");
    }

    return {
        id: task.id,
        source: "task",
        title: task.title,
        category,
        dueDateIso: task.dueDateIso?.toISOString() ?? null,
        overdue,
        scheduled: task.status === "scheduled",
        historicalScore,
        urgencyScore,
        streakScore,
        meetingDensityScore,
        energyScore,
        totalScore,
        reasonSignals,
      };
    })
    .filter(Boolean) as PlannerCandidate[];

  function timeWindowLabelFromHour(hour: number) {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "late-night";
}

  function fallbackTitleForCategory(category: LeverCategory) {
  if (category === "income") {
    return "Complete one revenue-building task";
  }

  if (category === "learning") {
    return "Complete one career-building study block";
  }

  if (category === "admin") {
    return "Clear one important admin blocker";
  }

  if (category === "health") {
    return "Complete one energy-building health block";
  }

  if (category === "family") {
    return "Handle one important family commitment";
  }

  if (category === "creative") {
    return "Ship one creative output";
  }

  return "Complete one high-leverage focus block";
}  

  const profileFallbackCandidates: PlannerCandidate[] = (
    (patternProfile?.leverRankings as Array<{
      category: string;
      score: number;
    }>) ?? []
  )
    .slice(0, 3)
    .map((item) => {
      const category = normalizeCategory(item.category);
      const historicalScore = Number(item.score ?? 0.5) * 30;
      const energyScore = bestWindowScore;

      return {
        id: `pattern_${category}`,
        source: "focus_pattern",
        title: fallbackTitleForCategory(category),
        category,
        dueDateIso: null,
        overdue: false,
        scheduled: false,
        historicalScore,
        urgencyScore: 6,
        streakScore: completedStreakDays > 0 ? 8 : 0,
        meetingDensityScore,
        energyScore,
        totalScore:
          historicalScore +
          6 +
          (completedStreakDays > 0 ? 8 : 0) +
          meetingDensityScore +
          energyScore,
        reasonSignals: [
          `${category} has been one of your stronger lever categories`,
          "it fits your current learned pattern",
        ],
      };
    });

  const fallbackCandidates: PlannerCandidate[] = [
  {
    id: "fallback_admin",
    source: "focus_pattern",
    title: "clear the highest-friction admin blocker",
    category: "admin",
    dueDateIso: null,
    overdue: false,
    scheduled: false,
    historicalScore: 15,
    urgencyScore: 8,
    streakScore: 0,
    meetingDensityScore,
    energyScore: bestWindowScore,
    totalScore: 15 + 8 + meetingDensityScore + bestWindowScore,
    reasonSignals: ["it reduces friction before deeper work"],
  },
];

const allCandidates: PlannerCandidate[] =
  candidateTasks.length > 0
    ? candidateTasks
    : profileFallbackCandidates.length > 0
      ? profileFallbackCandidates
      : fallbackCandidates;

  return {
    rules: user,
    patternProfile,
    recentFeedback,
    recentBlocks,
    recentTasks,
    candidateTasks: allCandidates.sort((a, b) => b.totalScore - a.totalScore),
    availableWindows,
    contextSignals: {
      overdueTaskCount,
      scheduledTaskCount,
      completedStreakDays,
      missedLast7Days,
      completionRateLast14Days,
      meetingDensityScore,
      bestWindowScore,
      energyWindowLabel,
    },
  };
}

function improveRecommendationTitle(candidate: {
  title: string;
  category: string;
}) {
  const rawTitle = candidate.title.trim();

  const genericTitles = [
    "move the highest-impact income lever forward",
    "protect your highest-leverage task",
    "advance your top priority",
    "work on your most important task",
  ];

  const isGeneric = genericTitles.some(
    (title) => rawTitle.toLowerCase() === title
  );

  if (!isGeneric) {
    return rawTitle;
  }

  if (candidate.category === "income") {
    return "Complete one income-generating action";
  }

  if (candidate.category === "learning") {
    return "Complete one career-building learning block";
  }

  if (candidate.category === "admin") {
    return "Clear one high-priority admin task";
  }

  if (candidate.category === "health") {
    return "Complete one energy-building health block";
  }

  if (candidate.category === "family") {
    return "Complete one important family commitment";
  }

  return "Complete one high-leverage focus block";
}

export async function runLocalPlanner(
  userId: string
): Promise<PlannerOutput> {
  const input = await buildPlannerInput(userId);
  const candidates = input.candidateTasks;

  const best = candidates[0];

  const alternatives = candidates.slice(1, 3).map((candidate) => ({
    title: candidate.title,
    category: candidate.category,
  }));

  const confidence = clamp(
    50 +
      best.totalScore / 2 +
      input.contextSignals.completionRateLast14Days * 10 -
      input.contextSignals.missedLast7Days * 2,
    45,
    95
  );

  return {
    leverTitle: improveRecommendationTitle(best),
    leverCategory: best.category,
    why: buildWhy(best, input),
    plan: buildPlan(best),
    alternatives,
    confidence: Math.round(confidence),
  };
}

export async function runAiPlanner(
  userId: string
): Promise<PlannerOutput> {
  if (!openai) {
    return runLocalPlanner(userId);
  }

  const input = await buildPlannerInput(userId);

  try {
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "You are Focus20's AI-first Deployment Coach. Pick exactly one highest-leverage outcome for today. Be calm, specific, and decisive. Use the candidate scores, overdue pressure, completion streak, meeting density, and focus-window strength. Never mention morning, afternoon, evening, or any specific time of day in the why field. Describe timing only as an available focus window. Do not mention formulas. Do not create long lists. Return JSON only."
        },
        {
          role: "user",
          content: JSON.stringify({
            candidates: input.candidateTasks.slice(0, 8),
            availableWindows: input.availableWindows,
            contextSignals: input.contextSignals,
            recentFeedback: input.recentFeedback.slice(0, 10).map((feedback) => ({
              result: feedback.result,
              needleMover: feedback.needleMover,
              category: feedback.focusBlock?.leverCategory,
              status: feedback.focusBlock?.status,
            })),
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "focus20_planner_output",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "leverTitle",
              "leverCategory",
              "why",
              "plan",
              "alternatives",
              "confidence",
            ],
            properties: {
              leverTitle: { type: "string" },
              leverCategory: {
                type: "string",
                enum: allowedCategories,
              },
              why: { type: "string" },
              plan: {
                type: "array",
                minItems: 1,
                maxItems: 3,
                items: { type: "string" },
              },
              alternatives: {
                type: "array",
                minItems: 0,
                maxItems: 2,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["title", "category"],
                  properties: {
                    title: { type: "string" },
                    category: {
                      type: "string",
                      enum: allowedCategories,
                    },
                  },
                },
              },
              confidence: {
                type: "number",
                minimum: 0,
                maximum: 100,
              },
            },
          },
        },
      },
    });

    const parsed = JSON.parse(response.output_text) as PlannerOutput;

    return sanitizePlannerOutput(parsed);
  } catch (error) {
    console.error("AI planner failed. Falling back to local planner.", error);

    return runLocalPlanner(userId);
  }
}

