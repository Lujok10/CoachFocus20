import { useEffect, useMemo, useState } from "react";
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
  apiCalendarEvents,
  apiCreateTask,
  apiScheduleTask,
  apiPreviewFlexShift,
  apiApplyFlexShift,
} from "../services/apiClient";

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

export function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("week");
  const [events, setEvents] = useState<AppCalendarEvent[]>([]);
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

  useEffect(() => {
    async function loadEvents() {
      const start = new Date(visibleDays[0]);
      start.setHours(0, 0, 0, 0);

      const end = new Date(visibleDays[visibleDays.length - 1]);
      end.setHours(23, 59, 59, 999);

      try {
        const result = await apiCalendarEvents(
          start.toISOString(),
          end.toISOString()
        );

        setEvents(Array.isArray(result) ? result : []);
        setMessage("");
      } catch (error) {
        console.error(error);
        setMessage("Unable to load calendar events.");
      }
    }

    loadEvents();
  }, [visibleDays]);

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
      setEvents(previous);
      setMessage("Update failed. Change was reverted.");
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
        title: taskTitle,
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        protectAsFocus,
      })) as { id: string };

      await apiScheduleTask(task.id, {
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        addToCalendar: true,
        protectAsFocus,
      });

      setEvents((current) => [
        ...current,
        {
          id: task.id,
          title: taskTitle,
          start: start.toISOString(),
          end: end.toISOString(),
          type: protectAsFocus ? "focus" : "task",
          protectAsFocus,
        },
      ]);

      setTaskTitle("");
      setTaskDate("");
      setTaskTime("");
      setTaskDuration(60);
      setProtectAsFocus(true);
      setShowAddTask(false);
    } catch (error) {
      setTaskError(
        error instanceof Error ? error.message : "Failed to add task."
      );
    } finally {
      setIsSavingTask(false);
    }
  }

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
              onClick={() => setShowAddTask(true)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-medium text-white"
            >
              <Plus className="h-4 w-4" />
              Add Task
            </button>
          </div>

          <div className="flex items-center justify-between">
            <button
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

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-semibold text-slate-800">
        AI Calendar Controls
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Preview FLEX moves before applying.
      </p>
    </div>

    <button
      onClick={handlePreviewFlexShift}
      disabled={isPreviewingFlex}
      className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50"
    >
      <RotateCcw className="h-4 w-4" />
      Preview FLEX
    </button>
  </div>

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
            <p className="text-xs text-slate-500">{candidate.reason}</p>
          </div>

          <button
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
                              onClick={() => resizeEvent(event, -15)}
                              className="rounded bg-white/70 px-2 py-0.5 text-[10px]"
                            >
                              -15
                            </button>

                            <button
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
        <div className="fixed inset-0 z-50 flex items-end bg-slate-900/40 p-4 sm:items-center sm:justify-center">
          <div className="w-full rounded-2xl bg-white p-5 shadow-xl sm:max-w-md">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">
                Add Task
              </h2>

              <button onClick={() => setShowAddTask(false)}>
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
                onChange={(event) =>
                  setTaskDuration(Number(event.target.value))
                }
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
                onClick={handleAddTask}
                disabled={isSavingTask}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
              >
                <Zap className="h-4 w-4" />
                {isSavingTask ? "Saving..." : "Add to Calendar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}