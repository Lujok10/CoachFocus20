import OpenAI from "openai";
import { prisma, DEMO_USER_ID, ensureDemoUser } from "./db";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export type PlannerInput = {
  rules: any;
  patternProfile: any;
  recentFeedback: any[];
  availableWindows: Array<{
    startIso: string;
    endIso: string;
    score: number;
  }>;
};

export type PlannerOutput = {
  leverTitle: string;
  leverCategory: string;
  why: string;
  plan: string[];
  alternatives: Array<{
    title: string;
    category: string;
  }>;
  confidence: number;
};

export async function buildPlannerInput(): Promise<PlannerInput> {
  await ensureDemoUser();

  const user = await prisma.user.findUnique({
    where: { id: DEMO_USER_ID },
  });

  const patternProfile = await prisma.patternProfile.findUnique({
    where: { userId: DEMO_USER_ID },
  });

  const recentFeedback = await prisma.feedback.findMany({
    where: { userId: DEMO_USER_ID },
    include: { focusBlock: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const bestWindows =
    (patternProfile?.bestWindows as any[]) ?? [
      { start: "09:30", end: "10:30", score: 0.8 },
    ];

  const today = new Date();

  const availableWindows = bestWindows.map((window) => {
    const [startHour, startMinute] = window.start.split(":").map(Number);
    const [endHour, endMinute] = window.end.split(":").map(Number);

    const start = new Date(today);
    start.setHours(startHour, startMinute, 0, 0);

    const end = new Date(today);
    end.setHours(endHour, endMinute, 0, 0);

    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      score: window.score,
    };
  });

  return {
    rules: user,
    patternProfile,
    recentFeedback,
    availableWindows,
  };
}

export async function runLocalPlanner(): Promise<PlannerOutput> {
  const input = await buildPlannerInput();

  const rankings =
    (input.patternProfile?.leverRankings as Array<{
      category: string;
      score: number;
    }>) ?? [];

  const topCategory =
    [...rankings].sort((a, b) => b.score - a.score)[0]?.category ?? "income";

  const positiveSignals = input.recentFeedback.filter(
    (f) => f.result === "crushed" && f.needleMover === "yes"
  );

  const confidence = Math.min(95, 70 + positiveSignals.length * 3);

  const leverMap: Record<string, string> = {
    income: "move the highest-impact income task forward",
    health: "protect the habit that improves your energy",
    family: "handle the family item creating background stress",
    admin: "clear the admin task blocking deeper work",
    learning: "complete the learning block that compounds your skill",
    creative: "ship the creative draft with the most momentum",
  };

  return {
    leverTitle: leverMap[topCategory] ?? leverMap.income,
    leverCategory: topCategory,
    why:
      "This matches your strongest recent pattern based on completed blocks, needle-mover feedback, and time-window fit.",
    plan: [
      "Open the exact task or workspace.",
      "Work for one protected block with no context switching.",
      "Capture the next action before stopping.",
    ],
    alternatives: [
      { title: "clear one small admin blocker", category: "admin" },
      { title: "complete one learning rep", category: "learning" },
    ],
    confidence,
  };
}

function sanitizePlannerOutput(output: PlannerOutput): PlannerOutput {
  const allowedCategories = [
    "income",
    "health",
    "family",
    "admin",
    "learning",
    "creative",
  ];

  const category = allowedCategories.includes(output.leverCategory)
    ? output.leverCategory
    : "admin";

  return {
    leverTitle: output.leverTitle?.slice(0, 90) || "protect your highest-leverage task",
    leverCategory: category,
    why:
      output.why?.slice(0, 180) ||
      "This is the best current needle-mover based on your recent patterns.",
    plan: Array.isArray(output.plan)
      ? output.plan.slice(0, 3).map((item) => String(item).slice(0, 100))
      : ["Start the task.", "Protect the block.", "Capture the next action."],
    alternatives: Array.isArray(output.alternatives)
      ? output.alternatives.slice(0, 2).map((alt) => ({
          title: String(alt.title ?? "alternate focus task").slice(0, 90),
          category: allowedCategories.includes(alt.category)
            ? alt.category
            : "admin",
        }))
      : [],
    confidence: Math.max(40, Math.min(95, Number(output.confidence) || 70)),
  };
}

export async function runAiPlanner(): Promise<PlannerOutput> {
  if (!openai) {
    return runLocalPlanner();
  }

  const input = await buildPlannerInput();

  try {
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "You are the Focus20 planner. Pick exactly one highest-leverage outcome for today. Keep output calm, concise, and action-oriented. Never schedule directly. Never mention formulas. Use only allowed categories.",
        },
        {
          role: "user",
          content: JSON.stringify({
            rules: input.rules,
            patternProfile: input.patternProfile,
            recentFeedback: input.recentFeedback.map((f) => ({
              result: f.result,
              needleMover: f.needleMover,
              category: f.focusBlock?.leverCategory,
              startIso: f.focusBlock?.startIso,
              status: f.focusBlock?.status,
            })),
            availableWindows: input.availableWindows,
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
                enum: ["income", "health", "family", "admin", "learning", "creative"],
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
                      enum: [
                        "income",
                        "health",
                        "family",
                        "admin",
                        "learning",
                        "creative",
                      ],
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

    const raw = response.output_text;
    const parsed = JSON.parse(raw) as PlannerOutput;

    return sanitizePlannerOutput(parsed);
  } catch (error) {
    console.error("AI planner failed. Falling back to local planner.", error);
    return runLocalPlanner();
  }
}