export type ProductivityDay = {
  date: string;
  completedFocusBlocks: number;
  scheduledFocusBlocks: number;
  totalFocusMinutes: number;
  interruptions: number;
};

const STORAGE_KEY = "focus20-productivity-history";

export function getProductivityHistory(): ProductivityDay[] {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) return [];

  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveProductivityDay(
  day: ProductivityDay
) {
  const history = getProductivityHistory();

  const filtered = history.filter(
    (item) => item.date !== day.date
  );

  filtered.push(day);

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(filtered)
  );
}

export function getTodayRecord() {
  const today = new Date().toISOString().split("T")[0];

  return getProductivityHistory().find(
    (item) => item.date === today
  );
}

export function getWeeklyStats() {
  const history = getProductivityHistory();

  const last7 = history.slice(-7);

  return {
    focusBlocks: last7.reduce(
      (sum, item) => sum + item.completedFocusBlocks,
      0
    ),
    focusMinutes: last7.reduce(
      (sum, item) => sum + item.totalFocusMinutes,
      0
    ),
    interruptions: last7.reduce(
      (sum, item) => sum + item.interruptions,
      0
    ),
  };
}