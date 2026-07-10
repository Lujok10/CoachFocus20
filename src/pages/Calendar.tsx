import { useCallback, useEffect, useMemo, useState } from "react";
import { enqueueOfflineJob } from "../services/offlineQueue";
import { AskFocus20 } from "../components/AskFocus20";
import confetti from "canvas-confetti";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCcw,
  Shield,
  X,
  Zap,
} from "lucide-react";

import {
  apiApplyFlexShift,
  apiCalendarEvents,
  apiCreateTask,
  apiPreviewFlexShift,
  apiScheduleTask,
} from "../services/apiClient";
import { ErrorState } from "../components/ErrorState";
import {
  type CalendarRecommendation,
  type DayOptimization,
  getBestFocusWindow,
  optimizeDay,
} from "../services/aiScheduler";

import {
  saveProductivityDay,
} from "../services/productivityMemory";

type CalendarView = "day" | "week" | "agenda";

type AppCalendarEvent = {
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
};




const HOURS = Array.from({ length: 13 }, (_, index) => index + 8);

function eventStart(event: AppCalendarEvent) {
  return new Date(event.start ?? event.startIso ?? Date.now());
}

function eventEnd(event: AppCalendarEvent) {
  return new Date(event.end ?? event.endIso ?? Date.now());
}

function eventTitle(event: AppCalendarEvent) {
  return event.title ?? event.summary ?? "Untitled";
}

function eventType(event: AppCalendarEvent) {
  if (event.type) return event.type;
  if (event.isFocusBlock || event.protectAsFocus) return "focus";
  return "task";
}

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function durationMinutes(event: AppCalendarEvent) {
  return Math.max(
    15,
    Math.round(
      (eventEnd(event).getTime() - eventStart(event).getTime()) / 60000
    )
  );
}

function eventColor(event: AppCalendarEvent) {
  const type = eventType(event);

  if (type === "focus") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (type === "task") {
    return "border-blue-200 bg-blue-50 text-blue-800";
  }

  return "border-slate-200 bg-slate-100 text-slate-700";
}

function overlaps(
  eventId: string,
  start: Date,
  end: Date,
  events: AppCalendarEvent[]
) {
  return events.some((event) => {
    if (String(event.id) === eventId) return false;

    const otherStart = eventStart(event);
    const otherEnd = eventEnd(event);

    return start < otherEnd && end > otherStart;
  });
}



 
function RecommendationCard({
  recommendation,
  onReserve,
}: {
  recommendation: CalendarRecommendation;
  onReserve: () => void;
}) {
  return (
    <div className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
            Calendar AI Recommendation
          </p>

          <h3 className="mt-2 text-xl font-black text-slate-900">
            {recommendation.title}
          </h3>

          <p className="mt-2 text-sm font-semibold text-emerald-800">
            {formatTime(recommendation.start)} – {formatTime(recommendation.end)}
          </p>
        </div>

        <div className="rounded-2xl bg-white px-4 py-3 text-center shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Confidence
          </p>

          <p className="mt-1 text-2xl font-black text-emerald-700">
            {recommendation.confidence}%
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {recommendation.reasons.map((reason) => (
          <p key={reason} className="text-sm font-medium text-emerald-800">
            ✓ {reason}
          </p>
        ))}
      </div>

      {recommendation.alternatives.length > 0 && (
        <div className="mt-4 rounded-2xl bg-white p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">
            Backup options
          </p>

          <div className="mt-3 space-y-2">
            {recommendation.alternatives.map((alt) => (
              <div
                key={`${alt.start.toISOString()}-${alt.end.toISOString()}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"
              >
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    {formatTime(alt.start)} – {formatTime(alt.end)}
                  </p>

                  <p className="text-xs text-slate-500">{alt.reason}</p>
                </div>

                <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-700">
                  {alt.confidence}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onReserve}
        className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700"
      >
        Reserve This Window
      </button>
    </div>
  );
}

function OptimizationCard({ optimization }: { optimization: DayOptimization }) {
  return (
    <div className="mt-4 rounded-3xl border border-indigo-200 bg-indigo-50 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-indigo-700">
            AI Optimization Summary
          </p>

          <h3 className="mt-2 text-xl font-black text-slate-900">
            Your day has been analyzed
          </h3>
        </div>

        <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-500">
            Expected Gain
          </p>

          <p className="text-2xl font-black text-indigo-700">
            +{optimization.predictedGain}%
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {optimization.reservedBlock && (
          <div className="rounded-xl bg-white p-4">
            <p className="font-bold text-slate-800">
              ✅ Recommended Focus Block
            </p>

            <p className="mt-1 text-sm text-slate-600">
              {formatTime(optimization.reservedBlock.start)} –{" "}
              {formatTime(optimization.reservedBlock.end)}
            </p>
          </div>
        )}

        {optimization.movedEvents.map((event) => (
          <div key={event.title} className="rounded-xl bg-white p-4">
            <p className="font-semibold text-slate-800">🔄 {event.title}</p>

            <p className="mt-1 text-sm text-slate-500">
              {formatTime(event.from)} → {formatTime(event.to)}
            </p>
          </div>
        ))}

        {optimization.warnings.map((warning) => (
          <div
            key={warning}
            className="rounded-xl bg-amber-100 p-3 text-sm text-amber-800"
          >
            ⚠ {warning}
          </div>
        ))}
      </div>
    </div>
  );
}

function AddTaskModal({
  taskTitle,
  setTaskTitle,
  taskDate,
  setTaskDate,
  taskTime,
  setTaskTime,
  taskDuration,
  setTaskDuration,
  protectAsFocus,
  setProtectAsFocus,
  taskError,
  isSavingTask,
  onClose,
  onSave,
}: {
  taskTitle: string;
  setTaskTitle: (value: string) => void;
  taskDate: string;
  setTaskDate: (value: string) => void;
  taskTime: string;
  setTaskTime: (value: string) => void;
  taskDuration: number;
  setTaskDuration: (value: number) => void;
  protectAsFocus: boolean;
  setProtectAsFocus: (value: boolean) => void;
  taskError: string;
  isSavingTask: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-900/40 p-4 sm:items-center sm:justify-center">
      <div className="w-full rounded-2xl bg-white p-5 shadow-xl sm:max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Add Task</h2>

          <button type="button" onClick={onClose}>
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="space-y-3">
          <input
            value={taskTitle}
            onChange={(event) => setTaskTitle(event.target.value)}
            placeholder="Task title"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />

          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              value={taskDate}
              onChange={(event) => setTaskDate(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />

            <input
              type="time"
              value={taskTime}
              onChange={(event) => setTaskTime(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <input
            type="number"
            min={15}
            step={15}
            value={taskDuration}
            onChange={(event) => setTaskDuration(Number(event.target.value))}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={protectAsFocus}
              onChange={(event) => setProtectAsFocus(event.target.checked)}
            />
            Protect as Focus20 block
          </label>

          {taskError && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {taskError}
            </p>
          )}

          <button
            type="button"
            onClick={onSave}
            disabled={isSavingTask}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            <Zap className="h-4 w-4" />
            {isSavingTask ? "Saving..." : "Add to Calendar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Calendar({ authReady }: { authReady: boolean }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("week");
  const [events, setEvents] = useState<AppCalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [flexCandidates, setFlexCandidates] = useState<any[]>([]);
  const [flexMessage, setFlexMessage] = useState("");
  const [isPreviewingFlex, setIsPreviewingFlex] = useState(false);

  const [showAddTask, setShowAddTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDate, setTaskDate] = useState("");
  const [taskTime, setTaskTime] = useState("");
  const [taskDuration, setTaskDuration] = useState(60);
  const [protectAsFocus, setProtectAsFocus] = useState(true);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [taskError, setTaskError] = useState("");

  const [bestFocusMessage, setBestFocusMessage] = useState("");
  const [calendarRecommendation, setCalendarRecommendation] =
    useState<CalendarRecommendation | null>(null);
  const [optimization, setOptimization] = useState<DayOptimization | null>(null);
  const [isOptimizingDay, setIsOptimizingDay] = useState(false);
  const [isFindingBestFocus, setIsFindingBestFocus] = useState(false);

  const [assistantTip, setAssistantTip] = useState<{
    title: string;
    description: string;
    action: string;
  } | null>(null);

  const visibleDays = useMemo(() => {
    if (view === "day" || view === "agenda") {
      return [currentDate];
    }

    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(currentDate);
      day.setDate(currentDate.getDate() - currentDate.getDay() + index);
      return day;
    });
  }, [currentDate, view]);

  const loadEvents = useCallback(async () => {
    const start = new Date(visibleDays[0]);
    start.setHours(0, 0, 0, 0);

    const end = new Date(visibleDays[visibleDays.length - 1]);
    end.setHours(23, 59, 59, 999);

    setIsLoadingEvents(true);
    setCalendarError(null);

    try {
      const result = await Promise.race([
        apiCalendarEvents(start.toISOString(), end.toISOString()),
        new Promise<never>((_, reject) =>
          window.setTimeout(
            () => reject(new Error("Calendar is taking longer than expected.")),
            15_000
          )
        ),
      ]);

      const loadedEvents = Array.isArray(result) ? result : [];

      setEvents(loadedEvents);
      const focusBlocks = loadedEvents.filter(
          (event: any) =>
            event.type === "focus" ||
            event.protectAsFocus
        );

        saveProductivityDay({
          date: new Date()
            .toISOString()
            .split("T")[0],
          completedFocusBlocks: Math.floor(
            focusBlocks.length * 0.7
          ),
          scheduledFocusBlocks:
            focusBlocks.length,
          totalFocusMinutes:
            focusBlocks.length * 60,
          interruptions: Math.floor(
            Math.random() * 8
          ),
        });

      const focusEvents = loadedEvents.filter(
        (event: AppCalendarEvent) =>
          eventType(event) === "focus" ||
          eventTitle(event).toLowerCase().includes("focus")
      );

      const busyEvents = loadedEvents.filter(
        (event: AppCalendarEvent) => eventType(event) !== "focus"
      );

      if (focusEvents.length === 0 && busyEvents.length > 5) {
        setAssistantTip({
          title: "No Focus Time Scheduled",
          description:
            "Your calendar is busy today, but you don't have any protected focus blocks.",
          action: "Reserve 60 minutes this afternoon.",
        });
      } else if (focusEvents.length > 0) {
        setAssistantTip({
          title: "Focus Time Protected",
          description: `You already have ${focusEvents.length} protected focus block${
            focusEvents.length === 1 ? "" : "s"
          } scheduled.`,
          action: "Stay consistent and complete today's session.",
        });
      } else {
        setAssistantTip(null);
      }

      setMessage("");
    } catch (error) {
      setCalendarError(
        error instanceof Error
          ? error.message
          : "Unable to load calendar events. Please try again."
      );
    } finally {
      setIsLoadingEvents(false);
    }
  }, [visibleDays]);

  useEffect(() => {
    if (!authReady) return;

    loadEvents();
  }, [authReady, loadEvents, reloadIndex]);

  function goPrevious() {
    const next = new Date(currentDate);
    next.setDate(currentDate.getDate() - (view === "week" ? 7 : 1));
    setCurrentDate(next);
  }

  function goNext() {
    const next = new Date(currentDate);
    next.setDate(currentDate.getDate() + (view === "week" ? 7 : 1));
    setCurrentDate(next);
  }

  async function handleFindBestFocus() {
    setIsFindingBestFocus(true);
    setBestFocusMessage("");
    setCalendarRecommendation(null);

    try {
      const recommendation = getBestFocusWindow(events, currentDate);

      if (!recommendation) {
        setBestFocusMessage(
          "No strong 60-minute focus window found today. Try switching to another day or moving a FLEX event."
        );
        return;
      }

      setCalendarRecommendation(recommendation);

      setBestFocusMessage(
        `Best window: ${formatTime(recommendation.start)} - ${formatTime(
          recommendation.end
        )} with ${recommendation.confidence}% confidence.`
      );
    } finally {
      setIsFindingBestFocus(false);
    }
  }

  async function handleReserveRecommendation() {
    if (!calendarRecommendation) return;

    try {
      const task = (await apiCreateTask({
        title: "Focus20 Deep Work",
        startIso: calendarRecommendation.start.toISOString(),
        endIso: calendarRecommendation.end.toISOString(),
        durationMinutes: Math.round(
          (calendarRecommendation.end.getTime() -
            calendarRecommendation.start.getTime()) /
            60000
        ),
        protectAsFocus: true,
      })) as { id: string };

      await apiScheduleTask(task.id, {
        startIso: calendarRecommendation.start.toISOString(),
        endIso: calendarRecommendation.end.toISOString(),
        addToCalendar: true,
        protectAsFocus: true,
      });

      setMessage("Deep Work block reserved successfully.");
      setCalendarRecommendation(null);
      setReloadIndex((current) => current + 1);
    } catch (error) {
      console.error(error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to reserve the suggested focus block."
      );
    }
  }

async function handleOptimizeDay() {
  setIsOptimizingDay(true);
  setOptimization(null);

  try {
    const result = optimizeDay(
      events,
      currentDate,
      calendarRecommendation
    );

    if (result.reservedBlock && !calendarRecommendation) {
      setCalendarRecommendation(result.reservedBlock);
    }

    setOptimization(result);

    setMessage("✨ Focus20 optimized your day.");

    if (
      result.reservedBlock ||
      result.movedEvents.length > 0
    ) {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.7 },
      });
    }
  } catch (error) {
    setMessage(
      error instanceof Error
        ? error.message
        : "Unable to optimize your day."
    );
  } finally {
    setIsOptimizingDay(false);
  }
}

  function handleDragStart(event: AppCalendarEvent, dragEvent: React.DragEvent) {
    dragEvent.dataTransfer.setData("text/plain", String(event.id));
  }

  async function updateEventTime(
    event: AppCalendarEvent,
    start: Date,
    end: Date
  ) {
    const id = String(event.id);

    if (overlaps(id, start, end, events)) {
      setMessage("That time overlaps another event. Choose another slot.");
      return;
    }

    const previous = events;

    setEvents((current) =>
      current.map((item) =>
        String(item.id) === id
          ? {
              ...item,
              start: start.toISOString(),
              end: end.toISOString(),
              startIso: start.toISOString(),
              endIso: end.toISOString(),
            }
          : item
      )
    );

    try {
      await apiScheduleTask(id, {
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        addToCalendar: Boolean(event.providerEventId),
        protectAsFocus: eventType(event) === "focus",
      });

      setMessage("Calendar updated.");
    } catch (error) {
      console.error(error);

      enqueueOfflineJob("schedule_task", {
        taskId: id,
        input: {
          startIso: start.toISOString(),
          endIso: end.toISOString(),
          addToCalendar: Boolean(event.providerEventId),
          protectAsFocus: eventType(event) === "focus",
        },
      });

      setEvents(previous);

      setMessage(
        navigator.onLine
          ? "Update failed. Change was reverted."
          : "Offline. Change queued for sync."
      );
    }
  }

  async function handleDrop(
    day: Date,
    hour: number,
    dragEvent: React.DragEvent
  ) {
    dragEvent.preventDefault();

    const id = dragEvent.dataTransfer.getData("text/plain");
    const event = events.find((item) => String(item.id) === id);

    if (!event) return;

    const start = new Date(day);
    start.setHours(hour, 0, 0, 0);

    const end = addMinutes(start, durationMinutes(event));

    await updateEventTime(event, start, end);
  }

  async function resizeEvent(event: AppCalendarEvent, minutes: number) {
    const start = eventStart(event);
    const nextEnd = addMinutes(eventEnd(event), minutes);

    if (nextEnd <= addMinutes(start, 15)) {
      setMessage("Minimum block size is 15 minutes.");
      return;
    }

    await updateEventTime(event, start, nextEnd);
  }

  async function handleAddTask() {
    setTaskError("");

    if (!taskTitle.trim()) {
      setTaskError("Task title is required.");
      return;
    }

    if (!taskDate || !taskTime) {
      setTaskError("Choose a date and time.");
      return;
    }

    setIsSavingTask(true);

    try {
      const start = new Date(`${taskDate}T${taskTime}:00`);
      const end = addMinutes(start, taskDuration);

      const task = (await apiCreateTask({
        title: taskTitle.trim(),
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        durationMinutes: taskDuration,
        protectAsFocus,
      })) as { id: string };

      await apiScheduleTask(task.id, {
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        addToCalendar: true,
        protectAsFocus,
      });

   setEvents((current) => [
        ...current.filter((event) => String(event.id) !== String(task.id)),
        {
          id: task.id,
          title: taskTitle.trim(),
          start: start.toISOString(),
          end: end.toISOString(),
          startIso: start.toISOString(),
          endIso: end.toISOString(),
          type: protectAsFocus ? "focus" : "task",
          isFocusBlock: protectAsFocus,
          protectAsFocus,
        },
      ]);

      setTaskTitle("");
      setTaskDate("");
      setTaskTime("");
      setTaskDuration(60);
      setProtectAsFocus(true);
      setCurrentDate(start);
      setMessage("Task added to your calendar.");
      setShowAddTask(false);
    
    } catch (error) {
      setTaskError(
        error instanceof Error ? error.message : "Failed to add task."
      );
    } finally {
      setIsSavingTask(false);
    }
  }

  const focusBlockCount = events.filter(
  (event) => eventType(event) === "focus" || event.protectAsFocus
).length;

const busyEventCount = events.filter(
  (event) => eventType(event) !== "focus" && !event.protectAsFocus
).length;

const protectedMinutes = events
  .filter((event) => eventType(event) === "focus" || event.protectAsFocus)
  .reduce((sum, event) => sum + durationMinutes(event), 0);

  const agendaEvents = [...events].sort(
    (a, b) => eventStart(a).getTime() - eventStart(b).getTime()
  );

  async function handlePreviewFlexShift() {
    setFlexMessage("");
    setIsPreviewingFlex(true);

    try {
      const start = new Date(currentDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(currentDate);
      end.setHours(23, 59, 59, 999);

      const result = (await apiPreviewFlexShift({
        startIso: start.toISOString(),
        endIso: end.toISOString(),
      })) as any;

      setFlexCandidates(result.candidates ?? []);
      setFlexMessage(result.reason ?? "");
    } catch (error) {
      setFlexMessage(
        error instanceof Error ? error.message : "Flex preview failed."
      );
    } finally {
      setIsPreviewingFlex(false);
    }
  }

  async function handleApplyFlexShift(candidate: any) {
    try {
      const result = (await apiApplyFlexShift(candidate)) as any;

      if (!result.ok) {
        setFlexMessage(result.reason ?? "Flex shift failed.");
        return;
      }

      setFlexMessage("Flex event shifted successfully.");
      setFlexCandidates([]);
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setFlexMessage(
        error instanceof Error ? error.message : "Flex shift failed."
      );
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="px-4 py-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h1 className="text-xl font-semibold text-slate-800">Calendar</h1>

            <button
              type="button"
              onClick={() => setShowAddTask(true)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-medium text-white"
            >
              <Plus className="h-4 w-4" />
              Add Task
            </button>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={goPrevious}
              className="rounded-xl border border-slate-200 bg-white p-2"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="text-center">
              <p className="text-sm font-semibold text-slate-800">
                {currentDate.toLocaleDateString([], {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>

              <div className="mt-2 flex rounded-xl bg-slate-100 p-1">
                {(["day", "week", "agenda"] as CalendarView[]).map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => setView(item)}
                    className={`rounded-lg px-3 py-1 text-xs font-medium capitalize ${
                      view === item
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={goNext}
              className="rounded-xl border border-slate-200 bg-white p-2"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="space-y-4 px-4 py-4">
        {message && (
          <div className="rounded-xl bg-slate-900 px-4 py-3 text-sm text-white">
            {message}
          </div>
        )}

        {calendarError && (
          <ErrorState
            title="Calendar could not load"
            message={calendarError}
            onRetry={loadEvents}
          />
        )}

        {isLoadingEvents && !calendarError && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
            Loading calendar events...
          </div>
        )}

        {assistantTip && (
            <div className="rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-indigo-50 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-blue-600">
                    AI Calendar Assistant
                  </p>

                  <h2 className="mt-1 text-xl font-black text-slate-900">
                    {assistantTip.title}
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    {assistantTip.description}
                  </p>

                  <div className="mt-4 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white">
                    💡 {assistantTip.action}
                  </div>
                </div>

                <div className="hidden text-5xl sm:block">🗓️</div>
              </div>
            </div>
          )}

      <AskFocus20
        events={events}
        currentDate={currentDate}
      />
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
            Focus block
          </span>

          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700">
            Task
          </span>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
            Calendar busy
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-emerald-600">
                  Focus Blocks
                </p>
                <p className="mt-2 text-3xl font-black text-emerald-700">
                  {focusBlockCount}
                </p>
                <p className="mt-1 text-xs font-semibold text-emerald-600">
                  protected sessions
                </p>
              </div>

              <div className="rounded-2xl bg-blue-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-blue-600">
                  Protected Time
                </p>
                <p className="mt-2 text-3xl font-black text-blue-700">
                  {protectedMinutes}
                </p>
                <p className="mt-1 text-xs font-semibold text-blue-600">
                  minutes reserved
                </p>
              </div>

              <div className="rounded-2xl bg-slate-100 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Busy Events
                </p>
                <p className="mt-2 text-3xl font-black text-slate-800">
                  {busyEventCount}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  non-focus calendar items
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Today
                </p>

                <h2 className="mt-2 text-xl font-black text-slate-900">
                  Productivity Summary
                </h2>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-emerald-50 p-4">
                    <p className="text-xs font-black text-emerald-600">✓ Focus blocks</p>
                    <p className="mt-1 text-lg font-black text-emerald-700">
                      {focusBlockCount}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-blue-50 p-4">
                    <p className="text-xs font-black text-blue-600">⏱ Protected time</p>
                    <p className="mt-1 text-lg font-black text-blue-700">
                      {protectedMinutes} min
                    </p>
                  </div>

                  <div className="rounded-2xl bg-violet-50 p-4">
                    <p className="text-xs font-black text-violet-600">🎯 Best window</p>
                    <p className="mt-1 text-sm font-black text-violet-700">
                      {calendarRecommendation
                        ? `${formatTime(calendarRecommendation.start)} – ${formatTime(
                            calendarRecommendation.end
                          )}`
                        : "Run Find My Best 20%"}
                    </p>
                  </div>
                </div>
              </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">
                AI Calendar Controls
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Find and protect your highest-leverage focus windows.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handlePreviewFlexShift}
                disabled={isPreviewingFlex || isLoadingEvents}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                Preview FLEX
              </button>

              <button
                type="button"
                onClick={handleFindBestFocus}
                disabled={isFindingBestFocus || isLoadingEvents}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {isFindingBestFocus ? "Finding..." : "Find My Best 20%"}
              </button>

              <button
                type="button"
                onClick={handleOptimizeDay}
                disabled={isOptimizingDay || isLoadingEvents}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {isOptimizingDay ? "Optimizing..." : "Optimize My Day"}
              </button>
            </div>
          </div>

          {calendarRecommendation && (
            <RecommendationCard
              recommendation={calendarRecommendation}
              onReserve={handleReserveRecommendation}
            />
          )}

          {optimization && <OptimizationCard optimization={optimization} />}

          {bestFocusMessage && !calendarRecommendation && (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {bestFocusMessage}
            </p>
          )}

          {flexMessage && (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {flexMessage}
            </p>
          )}

          {flexCandidates.length > 0 && (
            <div className="mt-3 space-y-2">
              {flexCandidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {candidate.title}
                    </p>

                    <p className="text-xs text-slate-500">
                      {candidate.reason}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleApplyFlexShift(candidate)}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white"
                  >
                    Apply
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {view === "agenda" ? (
          <div className="space-y-2">
            {agendaEvents.length === 0 ? (
              <p className="rounded-2xl bg-white p-4 text-sm text-slate-500">
                No events found.
              </p>
            ) : (
              agendaEvents.map((event) => (
                <div
                  key={event.id}
                  className={`rounded-xl border p-3 ${eventColor(event)}`}
                >
                  <p className="text-sm font-semibold">{eventTitle(event)}</p>

                  <p className="mt-1 text-xs">
                    {eventStart(event).toLocaleDateString()} •{" "}
                    {formatTime(eventStart(event))} -{" "}
                    {formatTime(eventEnd(event))}
                  </p>
                </div>
              ))
            )}
          </div>
        ) : (
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `64px repeat(${visibleDays.length}, minmax(0, 1fr))`,
            }}
          >
            <div />

            {visibleDays.map((day) => (
              <div key={day.toISOString()} className="text-center">
                <p className="text-xs font-medium text-slate-500">
                  {day.toLocaleDateString([], { weekday: "short" })}
                </p>

                <p className="text-sm font-semibold text-slate-800">
                  {day.getDate()}
                </p>
              </div>
            ))}

            {HOURS.map((hour) => (
              <div key={hour} className="contents">
                <div className="pt-2 text-xs text-slate-400">{hour}:00</div>

                {visibleDays.map((day) => {
                  const slotEvents = events.filter((event) => {
                    const start = eventStart(event);
                    return sameDay(start, day) && start.getHours() === hour;
                  });

                  return (
                    <div
                      key={`${day.toISOString()}-${hour}`}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleDrop(day, hour, event)}
                      className="min-h-[88px] rounded-xl border border-dashed border-slate-200 bg-slate-50 p-1"
                    >
                      {slotEvents.map((event) => (
                        <div
                          key={event.id}
                          draggable
                          onDragStart={(dragEvent) =>
                            handleDragStart(event, dragEvent)
                          }
                          className={`mb-1 cursor-grab rounded-lg border px-2 py-1 text-xs ${eventColor(
                            event
                          )}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold">
                                {eventTitle(event)}
                              </p>

                              <p>
                                {formatTime(eventStart(event))} -{" "}
                                {formatTime(eventEnd(event))}
                              </p>
                            </div>

                            {eventType(event) === "focus" && (
                              <Shield className="h-3.5 w-3.5" />
                            )}
                          </div>

                          <div className="mt-2 flex gap-1">
                            <button
                              type="button"
                              onClick={() => resizeEvent(event, -15)}
                              className="rounded bg-white/70 px-2 py-0.5 text-[10px]"
                            >
                              -15
                            </button>

                            <button
                              type="button"
                              onClick={() => resizeEvent(event, 15)}
                              className="rounded bg-white/70 px-2 py-0.5 text-[10px]"
                            >
                              +15
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddTask && (
        <AddTaskModal
          taskTitle={taskTitle}
          setTaskTitle={setTaskTitle}
          taskDate={taskDate}
          setTaskDate={setTaskDate}
          taskTime={taskTime}
          setTaskTime={setTaskTime}
          taskDuration={taskDuration}
          setTaskDuration={setTaskDuration}
          protectAsFocus={protectAsFocus}
          setProtectAsFocus={setProtectAsFocus}
          taskError={taskError}
          isSavingTask={isSavingTask}
          onClose={() => setShowAddTask(false)}
          onSave={handleAddTask}
        />
      )}
    </div>
  );
}