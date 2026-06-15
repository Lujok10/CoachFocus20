export type Provider = "google" | "microsoft" | "local";
export type LeverCategory = "income" | "health" | "family" | "admin" | "learning" | "creative";
export type FocusBlockStatus = "scheduled" | "started" | "completed" | "missed" | "cancelled";
export type ActionStatus = "applied" | "undone" | "failed";
export type ActionType = "reserve_block" | "move_flex_event" | "voice_checkin" | "create_suggested_block";
export type AnalyticsEventName =
  | "wake_sentence_shown"
  | "wake_plan_refreshed"
  | "block_reserved_silent"
  | "block_started"
  | "block_completed"
  | "voice_checkin_used"
  | "needle_mover_feedback_recorded"
  | "flex_event_shifted"
  | "undo_used"
  | "insights_opened"
  | "weekly_report_shared";

export interface UserRules {
  userId: string;
  provider: Provider;
  calendarConnected: boolean;
  calendarPermission: "write" | "read-only" | "none";
  protectEnabled: boolean;
  flexShiftEnabled: boolean;
  maxMovesPerDay: number;
  notificationsEnabled: boolean;
  completedFirstLever: boolean;
  timezone: string;
  buffersMinutes: number;
}

export interface WakePlan {
  id: string;
  sentence: string;
  lever: Lever;
  block: FocusBlock;
  why: string;
  plan: string[];
  alternatives: Alternative[];
  timeLeak?: TimeLeak;
  isReserved: boolean;
  status: FocusBlockStatus;
  actionId: string;
  undoToken: string;
  confidence: number;
  reservationStatus: "reserved" | "suggested" | "queued" | "cancelled";
  calendarReconnectRequired: boolean;
  readOnlyCalendar: boolean;

  impact?: number;
  effortMinutes?: number;
  paretoScore?: number;
  recommendationReason?: string;
  recommendedStart?: string;
  recommendedEnd?: string;
  leverName?: string;

  nextAction?: {
    title: string;
    durationMinutes: number;
    reason: string;
  };
}

export interface Lever {
  title: string;
  category: LeverCategory;
  predictedImpact: number;
}

export interface FocusBlock {
  id: string;
  userId: string;
  provider: Provider;
  providerEventId?: string;
  title: string;
  startIso: string;
  endIso: string;
  createdBy: "ai" | "user";
  status: FocusBlockStatus;
  leverCategory: LeverCategory;
  predictedImpact: number;
  confidence: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  date: string;
}

export interface Alternative {
  title: string;
  time: string;
  category: LeverCategory;
}

export interface TimeLeak {
  title: string;
  minutes: number;
  fixAction: string;
}

export interface PatternProfile {
  userId: string;
  bestWindows: TimeWindow[];
  leverRankings: LeverRanking[];
  frictionSignals: FrictionSignals;
  lastUpdatedIso: string;
}

export interface TimeWindow {
  start: string;
  end: string;
  score: number;
}

export interface LeverRanking {
  category: LeverCategory;
  score: number;
}

export interface FrictionSignals {
  meetingsPeakConflict: number;
  contextSwitching: number;
}

export interface Feedback {
  id: string;
  userId: string;
  focusBlockId: string;
  result: "crushed" | "meh" | "missed";
  needleMover: "yes" | "somewhat" | "no" | "unconfirmed";
  noteText?: string;
  createdAtIso: string;
}

export interface ActionsLog {
  id: string;
  userId: string;
  actionType: ActionType;
  payload: Record<string, unknown>;
  undoPayload: Record<string, unknown>;
  createdAtIso: string;
  status: ActionStatus;
}

export interface AnalyticsEvent {
  id: string;
  name: AnalyticsEventName;
  payload?: Record<string, unknown>;
  createdAtIso: string;
}

export interface WeeklyInsight {
  title: string;
  value: string | number;
  change?: number;
  trend?: "up" | "down" | "stable";
  description?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: "focus" | "meeting" | "personal" | "other" | "flex";
  providerEventId?: string;
  isFocusBlock?: boolean;
  isFlex?: boolean;
  busy?: boolean;
  attendees?: number;
}
