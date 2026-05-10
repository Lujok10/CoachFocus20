import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Shield,
  Zap,
  RotateCcw,
  Plus,
  X,
} from "lucide-react";

import {
  calendarFreeBusy,
  getUserRules,
  saveUserRules,
} from "../services/deploymentCoach";

import {
  apiCalendarEvents,
  apiCreateTask,
  apiSaveUserRules,
  apiScheduleTask,
  apiPreviewFlexShift,
  apiApplyFlexShift,
} from "../services/apiClient";

import type { CalendarEvent } from "../types";

export function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"week" | "day">("week");

  const [rules, setRules] = useState(getUserRules());

  const [refreshKey, setRefreshKey] = useState(0);
  const [remoteEvents, setRemoteEvents] = useState<CalendarEvent[] | null>(
    null
  );

  /**
   * Add task modal
   */
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDate, setTaskDate] = useState("");
  const [taskTime, setTaskTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [protectAsFocus, setProtectAsFocus] = useState(true);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [taskError, setTaskError] = useState("");

  /**
   * Flex shift
   */
  const [flexCandidates, setFlexCandidates] = useState<any[]>([]);
  const [flexMessage, setFlexMessage] = useState("");
  const [isPreviewingFlex, setIsPreviewingFlex] = useState(false);

  const localEvents = useMemo(() => {
    const start = new Date(currentDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(currentDate);
    end.setHours(23, 59, 59, 999);

    return calendarFreeBusy(start.toISOString(), end.toISOString());
  }, [currentDate, refreshKey]);

  const events = remoteEvents ?? localEvents;

  useEffect(() => {
    const start = new Date(currentDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(currentDate);
    end.setHours(23, 59, 59, 999);

    apiCalendarEvents(start.toISOString(), end.toISOString())
      .then(setRemoteEvents)
      .catch(() => {
        setRemoteEvents(null);
      });
  }, [currentDate, refreshKey]);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentDate);
    d.setDate(currentDate.getDate() - currentDate.getDay() + i);
    return d;
  });

  const updateRule = (next: Parameters<typeof saveUserRules>[0]) => {
    const saved = saveUserRules(next);

    setRules(saved);

    apiSaveUserRules(next)
      .then(setRules)
      .catch(() => undefined);

    setRefreshKey((x) => x + 1);
  };

  const goPrevious = () => {
    const next = new Date(currentDate);

    next.setDate(currentDate.getDate() - (view === "week" ? 7 : 1));

    setCurrentDate(next);
  };

  const goNext = () => {
    const next = new Date(currentDate);

    next.setDate(currentDate.getDate() + (view === "week" ? 7 : 1));

    setCurrentDate(next);
  };

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
      const startIso = new Date(
        `${taskDate}T${taskTime}:00`
      ).toISOString();

      const endIso = new Date(
        new Date(startIso).getTime() + durationMinutes * 60_000
      ).toISOString();

      const task = await apiCreateTask({
        title: taskTitle,
        startIso,
        endIso,
        protectAsFocus,
      });

      await apiScheduleTask(task.id, {
        startIso,
        endIso,
        addToCalendar: true,
        protectAsFocus,
      });

      setTaskTitle("");
      setTaskDate("");
      setTaskTime("");
      setDurationMinutes(60);
      setProtectAsFocus(true);
      setShowAddTask(false);

      setRefreshKey((x) => x + 1);
    } catch (error) {
      setTaskError(
        error instanceof Error ? error.message : "Failed to add task."
      );
    } finally {
      setIsSavingTask(false);
    }
  }

  async function handlePreviewFlexShift() {
    setFlexMessage("");
    setIsPreviewingFlex(true);

    try {
      const start = new Date(currentDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(currentDate);
      end.setHours(23, 59, 59, 999);

      const result = await apiPreviewFlexShift({
        startIso: start.toISOString(),
        endIso: end.toISOString(),
      });

      setFlexCandidates(result.candidates ?? []);
      setFlexMessage(result.reason ?? "");
    } catch (error) {
      setFlexMessage(
        error instanceof Error
          ? error.message
          : "Flex preview failed."
      );
    } finally {
      setIsPreviewingFlex(false);
    }
  }

  async function handleApplyFlexShift(candidate: any) {
    try {
      const result = await apiApplyFlexShift({
        eventId: candidate.id,
        title: candidate.title,
        oldStartIso: candidate.oldStartIso,
        oldEndIso: candidate.oldEndIso,
        newStartIso: candidate.newStartIso,
        newEndIso: candidate.newEndIso,
        reason: candidate.reason,
      });

      if (!result.ok) {
        setFlexMessage(result.reason ?? "Flex shift failed.");
        return;
      }

      setFlexMessage("Flex event shifted successfully.");
      setFlexCandidates([]);

      setRefreshKey((x) => x + 1);
    } catch (error) {
      setFlexMessage(
        error instanceof Error
          ? error.message
          : "Flex shift failed."
      );
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="px-4 py-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h1 className="text-xl font-semibold text-slate-800">
              Calendar
            </h1>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddTask(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Add Task
              </button>

              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                {(["week", "day"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setView(mode)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                      view === mode
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-500"
                    }`}
                  >
                    {mode[0].toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={goPrevious}
              className="rounded-lg p-2 hover:bg-slate-100"
            >
              <ChevronLeft className="h-5 w-5 text-slate-600" />
            </button>

            <h2 className="text-sm font-medium text-slate-600">
              {view === "week"
                ? `${weekDays[0].toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })} — ${weekDays[6].toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}`
                : currentDate.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
            </h2>

            <button
              onClick={goNext}
              className="rounded-lg p-2 hover:bg-slate-100"
            >
              <ChevronRight className="h-5 w-5 text-slate-600" />
            </button>
          </div>
        </div>
      </header>

      <div className="space-y-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={rules.protectEnabled}
              onChange={(e) =>
                updateRule({
                  protectEnabled: e.target.checked,
                })
              }
              className="h-4 w-4 rounded border-slate-300 text-emerald-600"
            />

            <Shield className="h-4 w-4 text-emerald-600" />

            <span className="text-sm text-slate-700">
              Protect my 20% time
            </span>
          </label>

          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={rules.flexShiftEnabled}
              onChange={(e) =>
                updateRule({
                  flexShiftEnabled: e.target.checked,
                })
              }
              className="h-4 w-4 rounded border-slate-300 text-violet-600"
            />

            <Zap className="h-4 w-4 text-violet-600" />

            <span className="text-sm text-slate-700">
              Flex shift opt-in
            </span>
          </label>

          <button
            onClick={handlePreviewFlexShift}
            disabled={
              !rules.flexShiftEnabled || isPreviewingFlex
            }
            className="rounded-full border border-violet-200 px-4 py-2 text-xs font-semibold text-violet-700 disabled:opacity-40"
          >
            {isPreviewingFlex
              ? "Checking..."
              : "Preview Flex Shift"}
          </button>

          <button
            onClick={() => setRefreshKey((x) => x + 1)}
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-slate-500"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Provider: {rules.provider}. Permission:{" "}
          {rules.calendarPermission}. Max flex moves/day:{" "}
          {rules.maxMovesPerDay}.
        </p>

        {flexMessage && (
          <p className="text-xs text-slate-500">
            {flexMessage}
          </p>
        )}

        {flexCandidates.length > 0 && (
          <div className="space-y-2 rounded-2xl border border-violet-100 bg-violet-50 p-3">
            <p className="text-xs font-semibold text-violet-800">
              Safe FLEX moves found
            </p>

            {flexCandidates.map((candidate) => (
              <div
                key={candidate.id}
                className="rounded-xl bg-white p-3 text-sm shadow-sm"
              >
                <p className="font-medium text-slate-800">
                  {candidate.title}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Move to{" "}
                  {new Date(
                    candidate.newStartIso
                  ).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>

                <button
                  onClick={() =>
                    handleApplyFlexShift(candidate)
                  }
                  className="mt-3 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Apply move
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {view === "week" && (
        <div className="px-4 py-4">
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((day) => {
              const isToday =
                day.toDateString() ===
                new Date().toDateString();

              return (
                <div
                  key={day.toISOString()}
                  className="text-center"
                >
                  <div className="mb-1 text-xs font-medium text-slate-400">
                    {day.toLocaleDateString("en-US", {
                      weekday: "short",
                    })}
                  </div>

                  <div
                    className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                      isToday
                        ? "bg-emerald-500 text-white"
                        : "text-slate-700"
                    }`}
                  >
                    {day.getDate()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-3 px-4">
        {events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            No events scheduled for this view.
          </div>
        ) : (
          events.map((event, index) => (
            <motion.div
              key={`${event.id}-${index}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className={`rounded-2xl border p-4 shadow-sm ${
                event.type === "focus"
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-800">
                    {event.title}
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {new Date(
                      event.start
                    ).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}{" "}
                    –{" "}
                    {new Date(
                      event.end
                    ).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                {event.type === "focus" && (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Focus 20
                  </span>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {showAddTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                Add Task
              </h2>

              <button
                onClick={() => setShowAddTask(false)}
                className="rounded-full p-2 hover:bg-slate-100"
              >
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            <input
              value={taskTitle}
              onChange={(e) =>
                setTaskTitle(e.target.value)
              }
              placeholder="Task title"
              className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3"
            />

            <input
              type="date"
              value={taskDate}
              onChange={(e) =>
                setTaskDate(e.target.value)
              }
              className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3"
            />

            <input
              type="time"
              value={taskTime}
              onChange={(e) =>
                setTaskTime(e.target.value)
              }
              className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3"
            />

            <input
              type="number"
              min={15}
              step={15}
              value={durationMinutes}
              onChange={(e) =>
                setDurationMinutes(
                  Number(e.target.value)
                )
              }
              className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3"
            />

            <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={protectAsFocus}
                onChange={(e) =>
                  setProtectAsFocus(
                    e.target.checked
                  )
                }
              />

              Protect as Focus 20 block
            </label>

            {taskError && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
                {taskError}
              </p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                onClick={() =>
                  setShowAddTask(false)
                }
                className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>

              <button
                onClick={handleAddTask}
                disabled={isSavingTask}
                className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isSavingTask
                  ? "Saving..."
                  : "Add to Calendar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}