export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    return "unsupported";
  }

  if (Notification.permission === "granted") {
    return "granted";
  }

  if (Notification.permission === "denied") {
    return "denied";
  }

  return Notification.requestPermission();
}

export async function showLocalNotification(
  title: string,
  options?: NotificationOptions
) {
  const permission = await requestNotificationPermission();

  if (permission !== "granted") {
    return false;
  }

  navigator.serviceWorker?.ready.then((registration) => {
    registration.showNotification(title, {
      badge: "/pwa-192x192.png",
      icon: "/pwa-192x192.png",
      ...options,
    });
  });

  return true;
}