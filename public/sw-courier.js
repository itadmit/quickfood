/* QuickFood — courier service worker */
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
    url: "/courier/home",
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
      vibrate: [200, 100, 200],
      data: { url: payload.url ?? "/courier/home", ...(payload.data || {}) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/courier/home";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const c of allClients) {
        try {
          const u = new URL(c.url);
          if (u.pathname.startsWith("/courier")) {
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
