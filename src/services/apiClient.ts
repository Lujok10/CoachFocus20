import { CalendarEvent, UserRules, WakePlan } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export async function apiStartFocusBlock(focusBlockId?: string) {
  return request("/api/focus/start", {
    method: "POST",
    body: JSON.stringify({ focusBlockId }),
  });
}

export async function getGoogleConnectUrl() {
  const data = await request<{ url: string }>("/api/google/auth-url");
  return data.url;
}

export async function apiHealth() {
  return request<{ ok: boolean }>("/health");
}

export async function apiGetUserRules() {
  return request<UserRules>("/api/rules");
}

export async function apiSaveUserRules(next: Partial<UserRules>) {
  return request<UserRules>("/api/rules", {
    method: "PATCH",
    body: JSON.stringify(next),
  });
}

export async function apiRefreshWakePlan(force = false) {
  return request<WakePlan>("/api/wake-plan/refresh", {
    method: "POST",
    body: JSON.stringify({ forceReserve: force }),
  });
}

export async function apiUndoAction(actionId: string) {
  return request<{ success: boolean; reason?: string }>(
    `/api/actions/${actionId}/undo`,
    { method: "POST" }
  );
}

export async function apiVoiceCheckinRecord(input: {
  focusBlockId: string;
  result: "crushed" | "meh" | "missed";
  needleMover: "yes" | "somewhat" | "no" | "unconfirmed";
  noteText?: string;
}) {
  return request<{ ok: boolean; feedback: { id: string } }>("/api/voice-checkin", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiCanSendNotification() {
  return request<{ allowed: boolean; reason?: string; sentToday?: number }>(
    "/api/notifications/can-send"
  );
}

export async function apiLogNotificationSent(input: {
  focusBlockId?: string;
  type: "pre_block_reminder" | "end_of_day_checkin";
}) {
  return request<{ ok: boolean; reason?: string }>("/api/notifications/log-sent", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiCreateTask(input: {
  title: string;
  category?: string;
  notes?: string;
  startIso?: string;
  endIso?: string;
  protectAsFocus?: boolean;
}) {
  return request<any>("/api/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiScheduleTask(
  taskId: string,
  input: {
    startIso: string;
    endIso?: string;
    durationMinutes?: number;
    addToCalendar?: boolean;
    protectAsFocus?: boolean;
  }
) {
  return request<any>(`/api/tasks/${taskId}/schedule`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiCalendarEvents(startIso: string, endIso: string) {
  const params = new URLSearchParams({ startIso, endIso });

  const events = await request<
    Array<Omit<CalendarEvent, "start" | "end"> & { start: string; end: string }>
  >(`/api/calendar/events?${params}`);

  return events.map((event) => ({
    ...event,
    start: new Date(event.start),
    end: new Date(event.end),
  })) as CalendarEvent[];
}

export async function apiWeeklyInsights() {
  return request<{
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
    topLevers: Array<{ category: string; score: number }>;
    timeLeaks: Array<{
      title: string;
      category: string;
      startIso: string;
      reason: string;
    }>;
    shareText: string;
  }>("/api/insights/weekly");
}

export async function apiPreviewFlexShift(input: {
  startIso: string;
  endIso: string;
}) {
  return request<{
    ok: boolean;
    reason?: string;
    candidates: Array<{
      id: string;
      title: string;
      oldStartIso: string;
      oldEndIso: string;
      newStartIso: string;
      newEndIso: string;
      reason: string;
    }>;
  }>("/api/flex-shift/preview", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiApplyFlexShift(input: {
  eventId: string;
  title: string;
  oldStartIso: string;
  oldEndIso: string;
  newStartIso: string;
  newEndIso: string;
  reason?: string;
}) {
  return request<{
    ok: boolean;
    reason?: string;
    movedEventId?: string;
    actionId?: string;
  }>("/api/flex-shift/apply", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiDisconnectGoogle() {
  return request<{ ok: boolean; calendarConnected: boolean }>(
    "/api/google/disconnect",
    { method: "POST" }
  );
}

export async function apiResetPatternProfile() {
  return request<{ ok: boolean; profile: unknown }>(
    "/api/user/reset-pattern-profile",
    { method: "POST" }
  );
}

export async function apiClearUserHistory() {
  return request<{ ok: boolean; message: string }>(
    "/api/user/clear-history",
    { method: "POST" }
  );
}