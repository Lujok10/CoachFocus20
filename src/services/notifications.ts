import { WakePlan } from "../types";
import { apiCanSendNotification, apiLogNotificationSent } from "./apiClient";

const scheduledReminderIds = new Set<string>();

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  const permission = await Notification.requestPermission();

  return permission === "granted";
}

export async function scheduleFocusReminder(wakePlan: WakePlan) {
  const allowed = await apiCanSendNotification();
  console.log("NOTIFICATION BACKEND ALLOWED:", allowed);

  if (!allowed.allowed) {
    console.log("NOTIFICATION STOP: backend blocked notification", allowed.reason);
    return;
  }

  const granted = await requestNotificationPermission();
  console.log("NOTIFICATION PERMISSION:", Notification.permission);

  if (!granted) {
    console.log("NOTIFICATION STOP: permission not granted");
    return;
  }

  const startMs = new Date(wakePlan.block.startIso).getTime();
  const reminderMs = startMs - 10 * 60 * 1000;
  const delay = reminderMs - Date.now();

  console.log("NOTIFICATION TIME:", {
    blockStart: wakePlan.block.startIso,
    reminderAt: new Date(reminderMs).toISOString(),
    delay,
  });

  if (delay <= 0) {
    console.log("NOTIFICATION STOP: reminder time already passed");
    return;
  }

  scheduledReminderIds.add(wakePlan.block.id);

  window.setTimeout(async () => {
    const latestAllowed = await apiCanSendNotification();
    console.log("NOTIFICATION FIRE CHECK:", latestAllowed);

    if (!latestAllowed.allowed) return;

    new Notification("Focus 20 Reminder", {
      body: `${wakePlan.block.title} starts in 10 minutes.`,
    });

    await apiLogNotificationSent({
      focusBlockId: wakePlan.block.id,
      type: "pre_block_reminder",
    });
  }, delay);

  console.log("NOTIFICATION SCHEDULED:", wakePlan.block.id);
}