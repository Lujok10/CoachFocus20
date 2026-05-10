import {
  ActionsLog,
  Alternative,
  CalendarEvent,
  Feedback,
  FocusBlock,
  Lever,
  LeverCategory,
  PatternProfile,
  Provider,
  TimeLeak,
  UserRules,
  WakePlan,
} from "../types";
import { appendJson, keys, readJson, writeJson } from "./storage";
import { trackEvent } from "./analytics";

const USER_ID = "local_user";

const levers: Record<LeverCategory, string[]> = {
  income: ["finish income-stream tweaks", "complete client proposal draft", "finalize pricing strategy"],
  health: ["plan weekly meal prep", "complete workout routine design", "review sleep analytics"],
  family: ["plan weekend family activity", "schedule family check-in", "review school calendar"],
  admin: ["clear inbox backlog", "organize digital files", "update project tracker"],
  learning: ["complete course module", "write learning summary", "practice new skill"],
  creative: ["draft creative brief", "brainstorm new ideas", "review design concepts"],
};

const whyReasons: Record<LeverCategory, string[]> = {
  income: ["This has the highest recent impact signal and moves your revenue goals forward."],
  health: ["Your strongest focus days usually follow protected health planning."],
  family: ["This reduces background stress and protects your important relationships."],
  admin: ["Clearing this removes friction before deeper work later today."],
  learning: ["This compounds into your next skill milestone."],
  creative: ["This is the highest-leverage creative task based on your recent pattern."],
};

const planTemplates: Record<LeverCategory, string[]> = {
  income: ["Review current state", "Ship the smallest valuable change", "Capture next action"],
  health: ["Pick one habit", "Schedule the exact block", "Remove one obstacle"],
  family: ["Confirm availability", "Make the plan simple", "Send one message"],
  admin: ["Sort by priority", "Finish the top item", "Archive or defer the rest"],
  learning: ["Review last note", "Complete one module", "Write a 3-line summary"],
  creative: ["Brainstorm freely", "Choose the best option", "Create the first draft"],
};

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

function randomId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function hhmm(date: Date) {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function atTime(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function defaultPattern(): PatternProfile {
  return {
    userId: USER_ID,
    bestWindows: [
      { start: "09:30", end: "10:30", score: 0.92 },
      { start: "11:00", end: "12:00", score: 0.84 },
      { start: "14:00", end: "15:00", score: 0.68 },
    ],
    leverRankings: [
      { category: "income", score: 0.93 },
      { category: "learning", score: 0.78 },
      { category: "admin", score: 0.62 },
      { category: "health", score: 0.58 },
      { category: "family", score: 0.55 },
      { category: "creative", score: 0.51 },
    ],
    frictionSignals: { meetingsPeakConflict: 0.42, contextSwitching: 0.34 },
    lastUpdatedIso: new Date().toISOString(),
  };
}

export function getUserRules(): UserRules {
  return readJson<UserRules>(keys.userRules, {
    userId: USER_ID,
    provider: "local",
    calendarConnected: true,
    calendarPermission: "write",
    protectEnabled: true,
    flexShiftEnabled: false,
    maxMovesPerDay: 1,
    notificationsEnabled: false,
    completedFirstLever: false,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    buffersMinutes: 10,
  });
}

export function saveUserRules(next: Partial<UserRules>) {
  const merged = { ...getUserRules(), ...next };
  writeJson(keys.userRules, merged);
  return merged;
}

export function getPatternProfile() {
  const profile = readJson<PatternProfile | null>(keys.patternProfile, null) ?? defaultPattern();
  writeJson(keys.patternProfile, profile);
  return profile;
}

export function calendarFreeBusy(startIso: string, endIso: string): CalendarEvent[] {
  const blocks = readJson<FocusBlock[]>(keys.focusBlocks, []);
  const start = new Date(startIso);
  const end = new Date(endIso);
  const focusEvents = blocks
    .filter((b) => b.status !== "cancelled")
    .map((b) => ({
      id: b.id,
      title: b.title,
      start: new Date(b.startIso),
      end: new Date(b.endIso),
      type: "focus" as const,
      providerEventId: b.providerEventId,
      isFocusBlock: true,
      busy: true,
    }));
  const mockMeetings: CalendarEvent[] = [
    { id: "m1", title: "Team sync", start: atTime(start, "10:30"), end: atTime(start, "11:00"), type: "meeting", busy: true, attendees: 4 },
    { id: "m2", title: "FLEX: Inbox cleanup", start: atTime(start, "13:00"), end: atTime(start, "13:30"), type: "flex", busy: false, isFlex: true },
  ];
  return [...mockMeetings, ...focusEvents].filter((event) => event.start >= start && event.end <= end);
}

function pickLever(): Lever {
  const profile = getPatternProfile();
  const feedback = readJson<Feedback[]>(keys.feedback, []);
  const boost = new Map<LeverCategory, number>();
  feedback.forEach((f) => {
    if (f.needleMover === "yes" && f.result === "crushed") boost.set("income", (boost.get("income") ?? 0) + 0.03);
  });
  const ranked = [...profile.leverRankings].sort((a, b) => (b.score + (boost.get(b.category) ?? 0)) - (a.score + (boost.get(a.category) ?? 0)));
  const category = ranked[0]?.category ?? "income";
  const title = levers[category][new Date().getDate() % levers[category].length];
  return { title, category, predictedImpact: 5 };
}

function selectSlot(durationMinutes = 60) {
  const profile = getPatternProfile();
  const now = new Date();
  const today = new Date();
  const events = calendarFreeBusy(new Date(today.setHours(0, 0, 0, 0)).toISOString(), new Date(today.setHours(23, 59, 0, 0)).toISOString());
  for (const window of profile.bestWindows) {
    const start = atTime(now, window.start);
    if (start < now) continue;
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    const conflict = events.some((event) => event.busy && start < event.end && end > event.start);
    if (!conflict) return { start, end };
  }
  const fallback = new Date(now.getTime() + 60 * 60_000);
  fallback.setMinutes(0, 0, 0);
  return { start: fallback, end: new Date(fallback.getTime() + 30 * 60_000) };
}

function logAction(actionType: ActionsLog["actionType"], payload: Record<string, unknown>, undoPayload: Record<string, unknown>) {
  const action: ActionsLog = {
    id: randomId("action"),
    userId: USER_ID,
    actionType,
    payload,
    undoPayload,
    createdAtIso: new Date().toISOString(),
    status: "applied",
  };
  appendJson(keys.actionsLog, action);
  return action;
}

export function calendarCreateFocusBlock(title: string, startIso: string, endIso: string, provider: Provider, lever: Lever, confidence: number) {
  const existing = readJson<FocusBlock[]>(keys.focusBlocks, []);
  const today = todayKey();
  const existingToday = existing.find((b) => b.date === today && b.status !== "cancelled");
  const block: FocusBlock = {
    id: existingToday?.id ?? randomId("block"),
    userId: USER_ID,
    provider,
    providerEventId: existingToday?.providerEventId ?? randomId(`${provider}_event`),
    title,
    startIso,
    endIso,
    createdBy: "ai",
    status: "scheduled",
    leverCategory: lever.category,
    predictedImpact: lever.predictedImpact,
    confidence,
    startTime: hhmm(new Date(startIso)),
    endTime: hhmm(new Date(endIso)),
    durationMinutes: Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000),
    date: today,
  };
  const next = existingToday ? existing.map((b) => (b.id === existingToday.id ? block : b)) : [...existing, block];
  writeJson(keys.focusBlocks, next);
  return block;
}

export async function refreshWakePlan(force = false): Promise<WakePlan> {
  const cached = readJson<WakePlan | null>(keys.wakePlan, null);
  if (!force && cached && localStorage.getItem(keys.wakePlanDate) === todayKey() && cached.status !== "cancelled") {
    trackEvent("wake_sentence_shown", { wakePlanId: cached.id, source: "cache" });
    return cached;
  }

  const rules = getUserRules();
  const lever = pickLever();
  const confidence = 91;
  const slot = selectSlot(60);
  const title = `Focus 20: ${lever.title}`;
  let block: FocusBlock;
  let action: ActionsLog;
  let isReserved = false;
  let reservationStatus: WakePlan["reservationStatus"] = "suggested";

  if (rules.calendarConnected && rules.calendarPermission === "write" && rules.protectEnabled) {
    block = calendarCreateFocusBlock(title, slot.start.toISOString(), slot.end.toISOString(), rules.provider, lever, confidence);
    action = logAction("reserve_block", { blockId: block.id, providerEventId: block.providerEventId, title }, { removeFocusBlockId: block.id });
    isReserved = true;
    reservationStatus = "reserved";
    trackEvent("block_reserved_silent", { blockId: block.id, provider: rules.provider });
  } else {
    block = calendarCreateFocusBlock(title, slot.start.toISOString(), slot.end.toISOString(), "local", lever, confidence);
    block.status = "cancelled";
    action = logAction("create_suggested_block", { title, startIso: block.startIso }, { dismissSuggestion: true });
  }

  const categories = Object.keys(levers).filter((c) => c !== lever.category) as LeverCategory[];
  const altCategory = categories[0];
  const alternative: Alternative = { title: levers[altCategory][0], time: "14:00–15:00", category: altCategory };
  const timeLeak: TimeLeak = { title: "FLEX admin block is close to deep-work time", minutes: 25, fixAction: "Keep flex shifting off unless you approve it" };
  const plan: WakePlan = {
    id: randomId("wake"),
    sentence: `Your biggest lever today: ${lever.title} — block ${hhmm(slot.start)}–${hhmm(slot.end)}.`,
    lever,
    block,
    why: whyReasons[lever.category][0],
    plan: planTemplates[lever.category],
    alternatives: [alternative],
    timeLeak,
    isReserved,
    status: block.status,
    actionId: action.id,
    undoToken: action.id,
    confidence,
    reservationStatus,
    calendarReconnectRequired: !rules.calendarConnected,
    readOnlyCalendar: rules.calendarPermission === "read-only",
  };
  writeJson(keys.wakePlan, plan);
  localStorage.setItem(keys.wakePlanDate, todayKey());
  trackEvent("wake_plan_refreshed", { wakePlanId: plan.id, reservationStatus });
  trackEvent("wake_sentence_shown", { wakePlanId: plan.id, source: "fresh" });
  return plan;
}

export async function actionsUndo(actionId: string) {
  const actions = readJson<ActionsLog[]>(keys.actionsLog, []);
  const action = actions.find((a) => a.id === actionId);
  if (!action) return false;
  const blocks = readJson<FocusBlock[]>(keys.focusBlocks, []);
  const blockId = action.undoPayload.removeFocusBlockId as string | undefined;
  if (blockId) {
    writeJson(keys.focusBlocks, blocks.map((b) => (b.id === blockId ? { ...b, status: "cancelled" } : b)));
  }
  writeJson(keys.actionsLog, actions.map((a) => (a.id === actionId ? { ...a, status: "undone" } : a)));
  const current = readJson<WakePlan | null>(keys.wakePlan, null);
  if (current?.actionId === actionId) {
    writeJson(keys.wakePlan, { ...current, isReserved: false, reservationStatus: "cancelled", status: "cancelled" });
  }
  trackEvent("undo_used", { actionId });
  return true;
}

export async function voiceCheckinRecord(focusBlockId: string, result: Feedback["result"], needleMover: Feedback["needleMover"], noteText?: string) {
  const feedback: Feedback = { id: randomId("feedback"), userId: USER_ID, focusBlockId, result, needleMover, noteText, createdAtIso: new Date().toISOString() };
  appendJson(keys.feedback, feedback);
  const blocks = readJson<FocusBlock[]>(keys.focusBlocks, []);
  const status = result === "missed" ? "missed" : "completed";
  writeJson(keys.focusBlocks, blocks.map((b) => (b.id === focusBlockId ? { ...b, status } : b)));
  const rules = getUserRules();
  if (status === "completed") saveUserRules({ completedFirstLever: true });
  writeJson(keys.patternProfile, { ...getPatternProfile(), lastUpdatedIso: new Date().toISOString() });
  trackEvent("voice_checkin_used", { focusBlockId, result });
  trackEvent("needle_mover_feedback_recorded", { focusBlockId, needleMover });
  trackEvent("block_completed", { focusBlockId, status });
  void rules;
  return true;
}

export function getFocusBlocks() {
  return readJson<FocusBlock[]>(keys.focusBlocks, []);
}

export function getActionsLog() {
  return readJson<ActionsLog[]>(keys.actionsLog, []);
}

export function resetLocalData() {
  Object.values(keys).forEach((key) => localStorage.removeItem(key));
}
