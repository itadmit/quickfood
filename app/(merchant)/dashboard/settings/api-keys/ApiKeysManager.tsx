"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { IcoWarning, IcoArrowLeft } from "@/components/shared/Icons";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export function ApiKeysManager({ initial }: { initial: ApiKey[] }) {
  const router = useRouter();
  const [keys, setKeys] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [ttl, setTtl] = useState<"never" | "30d" | "90d" | "365d">("never");
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<{ id: string; token: string } | null>(null);

  async function createKey() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const expiresAt =
        ttl === "never"
          ? null
          : new Date(
              Date.now() +
                (ttl === "30d" ? 30 : ttl === "90d" ? 90 : 365) * 86400_000,
            ).toISOString();
      const res = await fetch("/api/v1/merchant/settings/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), expires_at: expiresAt }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const k = data.api_key as {
        id: string;
        name: string;
        prefix: string;
        token: string;
        expires_at: string | null;
        created_at: string;
      };
      setKeys((prev) => [
        {
          id: k.id,
          name: k.name,
          prefix: k.prefix,
          lastUsedAt: null,
          expiresAt: k.expires_at,
          createdAt: k.created_at,
        },
        ...prev,
      ]);
      setRevealed({ id: k.id, token: k.token });
      setName("");
      setTtl("never");
      setCreating(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("לבטל את המפתח? כל מערכת שמשתמשת בו תפסיק לעבוד מיד.")) return;
    const res = await fetch(`/api/v1/merchant/settings/api-keys/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setKeys((prev) => prev.filter((k) => k.id !== id));
      if (revealed?.id === id) setRevealed(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-qf-blue-soft border border-qf-blue/30 text-sm rounded-2xl p-4 text-qf-ink2 space-y-2">
        <div className="font-medium text-qf-ink">
          איך משתמשים במפתח?
        </div>
        <p>
          המערכת המתחברת (קופה, Make, Zapier, n8n, אפליקציה פנימית) שולחת כל
          בקשה עם כותרת{" "}
          <code className="bg-white px-1 rounded text-xs" dir="ltr">
            Authorization: Bearer qfk_...
          </code>
          . כל מפתח קשור למסעדה הזו בלבד - אי אפשר לראות איתו הזמנות של מסעדה
          אחרת.
        </p>
        <p>
          <a
            href="/docs/pos"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-(--qf-deep) font-semibold underline"
          >
            <IcoArrowLeft s={14} />
            <span>מדריך אינטגרציה מלא למפתח</span>
          </a>{" "}
          - שלחו את הקישור לחברת הקופה או למי שמטמיע אצלכם.
        </p>
      </div>

      <section className="bg-white rounded-2xl border border-qf-line-dash">
        <header className="flex items-center justify-between gap-2 px-4 lg:px-5 py-4 border-b border-qf-line-soft">
          <div className="min-w-0">
            <div className="font-semibold">מפתחות פעילים</div>
            <div className="text-xs text-qf-mute">{keys.length} מפתחות</div>
          </div>
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm"
          >
            {creating ? "ביטול" : "+ צור מפתח חדש"}
          </button>
        </header>

        {creating && (
          <div className="px-4 lg:px-5 py-4 border-b border-qf-line-soft space-y-3 bg-qf-line-soft/40">
            <div>
              <label className="text-sm font-medium block mb-1">שם תיאורי</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="לדוגמה: קופת המסעדה הראשית"
                maxLength={80}
                className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
              />
              <div className="text-xs text-qf-mute mt-1">
                לתעד למה המפתח שימש - קל לנהל בהמשך.
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-1.5">תוקף</div>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { v: "never", l: "ללא תפוגה" },
                    { v: "30d", l: "30 ימים" },
                    { v: "90d", l: "90 ימים" },
                    { v: "365d", l: "שנה" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setTtl(opt.v)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs border",
                      ttl === opt.v
                        ? "bg-(--qf-primary) text-white border-transparent"
                        : "bg-white border-qf-line-dash text-qf-ink2",
                    )}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={createKey}
                disabled={!name.trim() || busy}
                className="px-4 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm disabled:opacity-60"
              >
                {busy ? "יוצר..." : "צור מפתח"}
              </button>
            </div>
          </div>
        )}

        <div>
          {keys.length === 0 ? (
            <div className="px-4 lg:px-5 py-10 text-center text-sm text-qf-mute">
              אין מפתחות. צור את הראשון כדי לחבר קופה או מערכת חיצונית.
            </div>
          ) : (
            keys.map((k) => {
              const expired = k.expiresAt && new Date(k.expiresAt) < new Date();
              return (
                <div
                  key={k.id}
                  className="px-4 lg:px-5 py-4 border-t border-qf-line-soft first:border-t-0"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{k.name}</div>
                      <div className="text-xs text-qf-mute font-mono" dir="ltr">
                        qfk_{k.prefix}_••••••••
                      </div>
                      <div className="text-xs text-qf-mute mt-0.5">
                        נוצר {formatDateTime(k.createdAt)}
                        {k.lastUsedAt
                          ? ` · נעשה שימוש לאחרונה ${formatDateTime(k.lastUsedAt)}`
                          : " · לא נעשה שימוש"}
                        {k.expiresAt
                          ? ` · ${expired ? "פג תוקף" : "תוקף עד"} ${formatDateTime(k.expiresAt)}`
                          : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {expired && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-qf-tomato-soft text-qf-tomato">
                          פג תוקף
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => revoke(k.id)}
                        className="px-2.5 py-0.5 rounded-md border border-qf-line-dash hover:bg-qf-tomato-soft hover:text-qf-tomato text-xs"
                      >
                        בטל
                      </button>
                    </div>
                  </div>
                  {revealed?.id === k.id && (
                    <div className="mt-3 p-3 rounded-lg bg-qf-yolk-soft border border-qf-yolk/40 text-xs space-y-2">
                      <div className="font-medium text-qf-ink inline-flex items-center gap-1.5">
                        <IcoWarning c="#c2421f" s={14} />
                        המפתח מוצג פעם אחת בלבד - שמור אותו עכשיו
                      </div>
                      <code
                        className="block font-mono text-[11px] break-all bg-white p-2 rounded"
                        dir="ltr"
                      >
                        {revealed.token}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard?.writeText(revealed.token);
                        }}
                        className="text-(--qf-deep) underline"
                      >
                        העתק ללוח
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
