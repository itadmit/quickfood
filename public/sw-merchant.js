/* QuickFood - merchant service worker */
/* eslint-disable no-restricted-globals */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "QuickFood",
    body: "התראה חדשה",
    url: "/dashboard/orders",
    tag: undefined,
    icon: "/icon.png",
    badge: "/icon.png",
    requireInteraction: true,
  };
  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    }
  } catch (e) {
    /* keep defaults */
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      tag: payload.tag,
      requireInteraction: !!payload.requireInteraction,
      vibrate: [300, 100, 300, 100, 300],
      data: { url: payload.url ?? "/dashboard/orders", ...(payload.data || {}) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/dashboard/orders";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const c of allClients) {
        try {
          const u = new URL(c.url);
          if (u.pathname.startsWith("/dashboard")) {
            await c.focus();
            if (typeof c.navigate === "function") await c.navigate(targetUrl);
            return;
          }
        } catch (e) {
          /* ignore */
        }
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});
