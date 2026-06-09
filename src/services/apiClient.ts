import { UserRules, WakePlan } from "../types";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";

let clerkTokenProvider: (() => Promise<string | null>) | null = null;

export function setClerkTokenProvider(provider: () => Promise<string | null>) {
  clerkTokenProvider = provider;
}

export async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let token: string | null = null;

  try {
    if (clerkTokenProvider) {
      token = await clerkTokenProvider();
    }
  } catch (error) {
    console.error("TOKEN ERROR:", error);
  }

  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  if (!res.ok) {
    let message = `API request failed: ${res.status}`;

    try {
      const body = await res.json();
      message = body.error || body.message || message;
    } catch {
      // Ignore non-JSON errors
    }

    throw new Error(message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export async function authFetch<T = unknown>(
  path: string,
  options?: RequestInit
) {
  return request<T>(path, options ?? {});
}

export async function apiHealth() {
  return request<{ ok: boolean }>("/health");
}

export async function getGoogleConnectUrl() {
  const data = await request<{ url: string }>("/api/google/auth-url");
  return data.url;
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
    body: JSON.stringify({
      forceReserve: force,
    }),
  });
}

export async function apiStartFocusBlock(focusBlockId?: string) {
  return request("/api/focus/start", {
    method: "POST",
    body: JSON.stringify({ focusBlockId }),
  });
}

export async function apiUndoAction(actionId: string) {
  return request<{ success: boolean; reason?: string }>(
    `/api/actions/${actionId}/undo`,
    {
      method: "POST",
    }
  );
}

export async function apiVoiceCheckinRecord(input: {
  focusBlockId: string;
  result: "crushed" | "meh" | "missed";
  needleMover: "yes" | "somewhat" | "no" | "unconfirmed";
  noteText?: string;
}) {
  return request<{ ok: boolean; feedback: { id: string } }>(
    "/api/voice-checkin",
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export async function apiCanSendNotification() {
  return request<{
    allowed: boolean;
    reason?: string;
    sentToday?: number;
  }>("/api/notifications/can-send");
}

export async function apiLogNotificationSent(input: {
  focusBlockId?: string;
  type: "pre_block_reminder" | "end_of_day_checkin";
}) {
  return request<{ ok: boolean; reason?: string }>(
    "/api/notifications/log-sent",
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export async function apiCalendarEvents(startIso: string, endIso: string) {
  return request<
    Array<{
      id: string;
      title?: string;
      summary?: string;
      start?: string | Date;
      end?: string | Date;
      startIso?: string | Date;
      endIso?: string | Date;
      type?: "focus" | "task" | "calendar";
      isFocusBlock?: boolean;
      protectAsFocus?: boolean;
      providerEventId?: string | null;
      category?: string;
      leverCategory?: string;
    }>
  >(
    `/api/calendar/events?startIso=${encodeURIComponent(
      startIso
    )}&endIso=${encodeURIComponent(endIso)}`
  );
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
    trend?: Array<{
      day: string;
      protectedMinutes: number;
      completedMinutes: number;
    }>;
    shareText: string;
  }>("/api/insights/weekly");
}

export async function apiCreateTask(input: {
  title: string;
  category?: string;
  notes?: string;
  startIso?: string;
  endIso?: string;
  durationMinutes?: number;
  protectAsFocus?: boolean;
})

{
  return request<{ id: string }>("/api/tasks", {
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
    {
      method: "POST",
    }
  );
}

export async function apiResetPatternProfile() {
  return request<{ ok: boolean; profile: unknown }>(
    "/api/user/reset-pattern-profile",
    {
      method: "POST",
    }
  );
}

export async function apiClearUserHistory() {
  return request<{ ok: boolean; message: string }>(
    "/api/user/clear-history",
    {
      method: "POST",
    }
  );
}

export async function apiTrackEvent(
  name: string,
  payload?: Record<string, unknown>
) {
  return request("/api/analytics/track", {
    method: "POST",
    body: JSON.stringify({
      name,
      payload,
    }),
  });
}

export async function apiAdminAnalytics() {
  return request("/api/admin/analytics", {
    headers: {
      "x-admin-secret": import.meta.env.VITE_ADMIN_SECRET ?? "",
    },
  });
}

export async function apiRecoverySuggestion() {
  return request("/api/recovery/suggestion");
}

export async function apiAutoRescheduleMissedWork() {
  return request("/api/recovery/reschedule", {
    method: "POST",
  });
}
export async function apiGoogleStatus() {
  return request<{
    connected: boolean;
    hasRefreshToken: boolean;
    permission: "write" | "limited" | "none";
    missingScopes: string[];
    reconnectRequired: boolean;
    authUrl: string;
    updatedAt: string | null;
  }>("/api/google/status");
}