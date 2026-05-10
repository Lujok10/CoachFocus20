import { AnalyticsEvent, AnalyticsEventName } from "../types";
import { appendJson, keys, readJson } from "./storage";

export function trackEvent(name: AnalyticsEventName, payload?: Record<string, unknown>) {
  const event: AnalyticsEvent = {
    id: `analytics_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    name,
    payload,
    createdAtIso: new Date().toISOString(),
  };
  appendJson(keys.analytics, event);
  return event;
}

export function getAnalytics() {
  return readJson<AnalyticsEvent[]>(keys.analytics, []);
}
