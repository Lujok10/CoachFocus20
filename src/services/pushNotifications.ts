import { authFetch } from "./apiClient";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export async function registerPushNotifications() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service workers are not supported.");
  }

  if (!("PushManager" in window)) {
    throw new Error("Push notifications are not supported.");
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

  if (!publicKey) {
    throw new Error("Missing VITE_VAPID_PUBLIC_KEY.");
  }

  const registration = await navigator.serviceWorker.register("/push-sw.js", {
    scope: "/push/",
  });

  const existing = await registration.pushManager.getSubscription();

  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  await authFetch("/api/push/subscribe", {
    method: "POST",
    body: JSON.stringify(subscription),
  });

  return subscription;
}

export async function sendTestPushNotification() {
  return authFetch("/api/push/test", {
    method: "POST",
  });
}

export async function unregisterPushNotifications() {
  const registration = await navigator.serviceWorker.getRegistration("/push/");
  const subscription = await registration?.pushManager.getSubscription();

  if (subscription) {
    await authFetch("/api/push/unsubscribe", {
      method: "POST",
      body: JSON.stringify({
        endpoint: subscription.endpoint,
      }),
    });

    await subscription.unsubscribe();
  }

  return { ok: true };
}