export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function appendJson<T>(key: string, item: T): T[] {
  const items = readJson<T[]>(key, []);
  const next = [...items, item];
  writeJson(key, next);
  return next;
}

export const keys = {
  wakePlan: "focus20_wakePlan",
  wakePlanDate: "focus20_wakePlanDate",
  focusBlocks: "focus20_focusBlocks",
  actionsLog: "focus20_actionsLog",
  feedback: "focus20_feedback",
  patternProfile: "focus20_patternProfile",
  userRules: "focus20_userRules",
  analytics: "focus20_analytics",
  notificationLog: "focus20_notificationLog",
};
