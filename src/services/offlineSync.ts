import {
  apiCreateTask,
  apiScheduleTask,
  apiVoiceCheckinRecord,
  apiCalendarEvents,
  apiWeeklyInsights,
} from "./apiClient";

import {
  clearOfflineJob,
  getOfflineQueue,
} from "./offlineQueue";

export async function syncOfflineQueue() {
  if (!navigator.onLine) return;

  const queue = getOfflineQueue();

  for (const job of queue) {
    try {
      if (job.type === "create_task") {
        await apiCreateTask(job.payload);
      }

      if (job.type === "schedule_task") {
        await apiScheduleTask(job.payload.taskId, job.payload.input);
      }

      if (job.type === "voice_checkin") {
        await apiVoiceCheckinRecord(job.payload);
      }

      clearOfflineJob(job.id);
    } catch (error) {
      console.error("Offline sync failed for job:", job, error);
      break;
    }
  }
}

export async function reconcileAfterReconnect() {
  if (!navigator.onLine) return;

  await syncOfflineQueue();

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  await Promise.allSettled([
    apiCalendarEvents(start.toISOString(), end.toISOString()),
    apiWeeklyInsights(),
  ]);
}