import { WakePlan } from "../types";
import { apiCanSendNotification, apiLogNotificationSent } from "./apiClient";

const scheduledReminderIds = new Set<string>();

export async function requestNotificationPermission() {
  if (!("Notification" in window)) return false;

  if (Notification.permission === "granted") return true;

  const permission = await Notification.requestPermission();
  return permission === "granted";
}

export async function scheduleFocusReminder(wakePlan: WakePlan) {
  if (!wakePlan?.block?.id || !wakePlan.block.startIso) return;
  if (scheduledReminderIds.has(wakePlan.block.id)) return;
  if (!("Notification" in window)) return;

  const allowed = await apiCanSendNotification();

  if (!allowed.allowed) return;

  const granted = await requestNotificationPermission();

  if (!granted) return;

  const startMs = new Date(wakePlan.block.startIso).getTime();
  const reminderMs = startMs - 10 * 60 * 1000;
  const delay = reminderMs - Date.now();

  if (delay <= 0) return;

  scheduledReminderIds.add(wakePlan.block.id);

  window.setTimeout(async () => {
    const latestAllowed = await apiCanSendNotification();

    if (!latestAllowed.allowed) return;

    new Notification("Focus 20 Reminder", {
      body: `${wakePlan.block.title} starts in 10 minutes.`,
    });

    await apiLogNotificationSent({
      focusBlockId: wakePlan.block.id,
      type: "pre_block_reminder",
    });
  }, delay);
}
