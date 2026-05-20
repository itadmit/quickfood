"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ALL_WEBHOOK_EVENTS, type WebhookEventType } from "@/lib/webhooks/events";
import { IcoWarning } from "@/components/shared/Icons";

interface Endpoint {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

interface Delivery {
  id: string;
  endpointId: string;
  eventType: string;
  status: string;
  attempts: number;
  responseCode: number | null;
  createdAt: string;
}

export function WebhooksManager({
  initial,
  deliveries,
}: {
  initial: Endpoint[];
  deliveries: Delivery[];
}) {
  const router = useRouter();
  const [endpoints, setEndpoints] = useState(initial);
  const [creating, setCreating] = useState(false);

  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<Set<WebhookEventType>>(new Set(ALL_WEBHOOK_EVENTS));
  const [revealedSecret, setRevealedSecret] = useState<{ id: string; secret: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function createEndpoint() {
    if (!url) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/merchant/webhooks/endpoints", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, events: Array.from(events), active: true }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const ep = data.endpoint as { id: string; url: string; events: string[]; active: boolean; secret: string; created_at: string };
      setEndpoints((prev) => [
        { id: ep.id, url: ep.url, events: ep.events, active: ep.active, createdAt: ep.created_at },
        ...prev,
      ]);
      setRevealedSecret({ id: ep.id, secret: ep.secret });
      setUrl("");
      setCreating(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-qf-blue-soft border border-qf-blue/30 text-sm rounded-2xl p-4 text-qf-ink2">
        <div className="font-medium text-qf-ink mb-1">לחיבור קופה / מדפסת תרמית / Slack / Telegram</div>
        כל הזמנה חדשה ושינוי סטטוס נשלחים אוטומטית ל-URL שתגדיר כאן. החתימה היא
        HMAC-SHA256 ב-header <code className="bg-white px-1 rounded">X-QuickFood-Signature</code>.
      </div>

      <section className="bg-white rounded-2xl border border-qf-line-dash">
        <header className="flex items-center justify-between px-5 py-4 border-b border-qf-line-soft">
          <div>
            <div className="font-semibold">Endpoints</div>
            <div className="text-xs text-qf-mute">{endpoints.length} מוגדרים</div>
          </div>
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="px-3 py-1.5 rounded-lg bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm"
          >
            {creating ? "ביטול" : "+ הוסף endpoint"}
          </button>
        </header>

        {creating && (
          <div className="px-5 py-4 border-b border-qf-line-soft space-y-3 bg-qf-line-soft/40">
            <div>
              <label className="text-sm font-medium block mb-1">URL</label>
              <input
                dir="ltr"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-pos.example.com/quickfood/webhook"
                className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
              />
            </div>
            <div>
              <div className="text-sm font-medium mb-1.5">אירועים</div>
              <div className="flex flex-wrap gap-1.5">
                {ALL_WEBHOOK_EVENTS.map((ev) => {
                  const checked = events.has(ev);
                  return (
                    <button
                      key={ev}
                      type="button"
                      onClick={() => {
                        setEvents((prev) => {
                          const next = new Set(prev);
                          if (checked) next.delete(ev);
                          else next.add(ev);
                          return next;
                        });
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-xs border",
                        checked
                          ? "bg-(--qf-primary) text-white border-transparent"
                          : "bg-white border-qf-line-dash text-qf-ink2",
                      )}
                    >
                      {ev}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={createEndpoint}
                disabled={!url || busy}
                className="px-4 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm disabled:opacity-60"
              >
                {busy ? "יוצר..." : "צור endpoint"}
              </button>
            </div>
          </div>
        )}

        <div>
          {endpoints.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-qf-mute">
              אין endpoints מוגדרים. הוסף את הראשון כדי לחבר קופה או מדפסת.
            </div>
          ) : (
            endpoints.map((ep) => (
              <div key={ep.id} className="px-5 py-4 border-t border-qf-line-soft first:border-t-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-sm truncate" dir="ltr">{ep.url}</div>
                    <div className="text-xs text-qf-mute">
                      {ep.events.join(", ")} · נוצר ב-{formatDateTime(ep.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-md",
                        ep.active ? "bg-qf-green-soft text-qf-green-deep" : "bg-qf-line-soft text-qf-mute",
                      )}
                    >
                      {ep.active ? "פעיל" : "מושבת"}
                    </span>
                    <TestEndpointButton id={ep.id} />
                  </div>
                </div>
                {revealedSecret?.id === ep.id && (
                  <div className="mt-3 p-3 rounded-lg bg-qf-yolk-soft border border-qf-yolk/40 text-xs space-y-1">
                    <div className="font-medium text-qf-ink inline-flex items-center gap-1.5">
                      <IcoWarning c="#c2421f" s={14} />
                      Secret מוצג פעם אחת בלבד — שמור אותו עכשיו
                    </div>
                    <code className="block font-mono text-[11px] break-all" dir="ltr">
                      {revealedSecret.secret}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(revealedSecret.secret);
                      }}
                      className="text-(--qf-deep) underline"
                    >
                      העתק ללוח
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-qf-line-dash">
        <header className="px-5 py-4 border-b border-qf-line-soft">
          <div className="font-semibold">היסטוריית delivery אחרונה</div>
          <div className="text-xs text-qf-mute">25 deliveries אחרונים</div>
        </header>
        {deliveries.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-qf-mute">אין deliveries עדיין</div>
        ) : (
          <div className="divide-y divide-qf-line-soft">
            {deliveries.map((d) => (
              <div key={d.id} className="px-5 py-3 grid grid-cols-[1fr_120px_80px_120px_80px] gap-2 text-sm items-center">
                <div className="font-mono text-xs">{d.eventType}</div>
                <div>
                  <span
                    className={cn(
                      "inline-block text-[10px] px-2 py-0.5 rounded-md",
                      d.status === "success"
                        ? "bg-qf-green-soft text-qf-green-deep"
                        : d.status === "failed"
                          ? "bg-qf-yolk-soft text-qf-ink2"
                          : d.status === "abandoned"
                            ? "bg-qf-tomato-soft text-qf-tomato"
                            : "bg-qf-line-soft text-qf-mute",
                    )}
                  >
                    {d.status}
                  </span>
                </div>
                <div className="text-xs text-qf-mute tnum">
                  {d.attempts} ניסיונות{d.responseCode ? ` · ${d.responseCode}` : ""}
                </div>
                <div className="text-xs text-qf-mute">{formatDateTime(d.createdAt)}</div>
                <RetryDeliveryButton id={d.id} disabled={d.status === "success"} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function TestEndpointButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  async function test() {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/merchant/webhooks/endpoints/${id}/test`, { method: "POST" });
      setToast(res.ok ? "נשלח" : "שגיאה");
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 2000);
    }
  }
  return (
    <button
      type="button"
      onClick={test}
      disabled={busy}
      className="px-2.5 py-0.5 rounded-md border border-qf-line-dash hover:bg-qf-line-soft text-[10px] disabled:opacity-60"
      title="שולח אירוע order.created לדוגמה"
    >
      {busy ? "..." : toast ?? "Test"}
    </button>
  );
}

function RetryDeliveryButton({ id, disabled }: { id: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function retry() {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/merchant/webhooks/deliveries/${id}/retry`, { method: "POST" });
      if (res.ok) {
        setTimeout(() => router.refresh(), 500);
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={retry}
      disabled={busy || disabled}
      className="px-2 py-0.5 rounded-md border border-qf-line-dash hover:bg-qf-line-soft text-[10px] disabled:opacity-40"
    >
      {busy ? "..." : "Retry"}
    </button>
  );
}
