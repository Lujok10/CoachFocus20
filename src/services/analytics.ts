import { AnalyticsEvent, AnalyticsEventName } from "../types";
import { appendJson, keys, readJson } from "./storage";
import { apiTrackEvent } from "./apiClient";

export function trackEvent(
  name: AnalyticsEventName | string,
  payload?: Record<string, unknown>
) {
  const event: AnalyticsEvent = {
    id: `analytics_${Date.now()}_${Math.random()
      .toString(16)
      .slice(2)}`,
    name: name as AnalyticsEventName,
    payload,
    createdAtIso: new Date().toISOString(),
  };

  // local analytics storage
  appendJson(keys.analytics, event);

  // remote analytics (non-blocking)
  try {
    apiTrackEvent(name, payload).catch((error) => {
      console.warn("Remote analytics failed:", error);
    });
  } catch (error) {
    console.warn("Remote analytics failed:", error);
  }

  return event;
}

export function getAnalytics() {
  return readJson<AnalyticsEvent[]>(keys.analytics, []);
}
