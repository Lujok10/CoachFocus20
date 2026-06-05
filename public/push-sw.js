self.addEventListener("push", (event) => {
  let data = {
    title: "Focus20",
    body: "You have a Focus20 notification.",
    url: "/",
    tag: "focus20",
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Focus20", {
      body: data.body || "",
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      tag: data.tag || "focus20",
      data: {
        url: data.url || "/",
      },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            client.navigate(url);
            return;
          }
        }

        return clients.openWindow(url);
      })
  );
});