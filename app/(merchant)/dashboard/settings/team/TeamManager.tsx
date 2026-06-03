"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Toast, type ToastState, type ToastKind } from "@/components/shared/Toast";

type Role = "owner" | "manager" | "kitchen" | "courier_dispatch";

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: string;
  last_login_at: string | null;
  created_at: string;
  is_me: boolean;
}

const ROLE_LABEL: Record<Role, string> = {
  owner: "בעלים",
  manager: "מנהל",
  kitchen: "מטבח",
  courier_dispatch: "מוקד שליחים",
};

const ROLE_DESCRIPTION: Record<Role, string> = {
  owner: "גישה מלאה — כולל ניהול צוות, חיוב, ומחיקה.",
  manager: "ניהול תפריט, הזמנות, הגדרות — אבל לא ניהול צוות.",
  kitchen: "מסך מטבח בלבד. לא רואה תפריט, מכירות או חיוב.",
  courier_dispatch: "ניהול שליחים והקצאה — לא כולל ניהול עסק.",
};

const ROLE_OPTIONS: Role[] = ["owner", "manager", "kitchen", "courier_dispatch"];

function isRole(v: string): v is Role {
  return (ROLE_OPTIONS as readonly string[]).includes(v);
}

export function TeamManager({
  currentRole,
  initial,
}: {
  currentRole: string;
  initial: TeamUser[];
}) {
  const router = useRouter();
  const isOwner = currentRole === "owner";
  const [users, setUsers] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("kitchen");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastCounter = useRef(0);
  function pushToast(kind: ToastKind, message: string) {
    toastCounter.current += 1;
    setToast({ id: toastCounter.current, kind, message });
  }

  async function createUser() {
    if (!name.trim() || !email.trim() || password.length < 8) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/merchant/team", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          role,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        pushToast("err", data?.error?.message ?? "יצירה נכשלה");
        return;
      }
      setUsers((prev) => [...prev, data.user as TeamUser]);
      setName("");
      setEmail("");
      setPassword("");
      setRole("kitchen");
      setCreating(false);
      pushToast("ok", "המשתמש נוצר. תני לו את האימייל והסיסמה כדי להיכנס.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function updateRole(id: string, nextRole: Role) {
    const res = await fetch(`/api/v1/merchant/team/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: nextRole }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      pushToast("err", data?.error?.message ?? "עדכון נכשל");
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === id ? (data.user as TeamUser) : u)));
    pushToast("ok", "התפקיד עודכן");
    router.refresh();
  }

  async function resetPassword(id: string) {
    const next = window.prompt("סיסמה חדשה (8 תווים לפחות)");
    if (!next) return;
    if (next.length < 8) {
      pushToast("err", "סיסמה צריכה להיות לפחות 8 תווים");
      return;
    }
    const res = await fetch(`/api/v1/merchant/team/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: next }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      pushToast("err", data?.error?.message ?? "איפוס נכשל");
      return;
    }
    pushToast("ok", "הסיסמה אופסה. מסרי את החדשה למשתמש.");
  }

  async function removeUser(id: string, label: string) {
    if (!confirm(`למחוק את ${label}? הפעולה לא הפיכה.`)) return;
    const res = await fetch(`/api/v1/merchant/team/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      pushToast("err", data?.error?.message ?? "מחיקה נכשלה");
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== id));
    pushToast("ok", "המשתמש נמחק");
    router.refresh();
  }

  return (
    <>
      <div className="space-y-5">
        <div className="bg-qf-blue-soft border border-qf-blue/30 text-sm rounded-2xl p-4 text-qf-ink2 space-y-2">
          <div className="font-medium text-qf-ink">איך זה עובד?</div>
          <p>
            כל משתמש שאת מוסיפה כאן יכול להתחבר עם האימייל והסיסמה ב-
            <span className="font-mono text-xs bg-white px-1 rounded" dir="ltr">
              /dashboard/login
            </span>
            . בחירת התפקיד קובעת למה הוא נכנס מיד אחרי ההתחברות — מטבח רואה רק
            את מסך המטבח, מנהל רואה את כל המסכים פרט לניהול צוות, בעלים רואה
            הכל.
          </p>
          {!isOwner && (
            <p className="text-xs text-qf-mute">
              את לא בעלים — את יכולה לראות את הרשימה אבל לא להוסיף, לשנות
              תפקידים או למחוק.
            </p>
          )}
        </div>

        <section className="bg-white rounded-2xl border border-qf-line-dash">
          <header className="flex items-center justify-between gap-2 px-4 lg:px-5 py-4 border-b border-qf-line-soft">
            <div className="min-w-0">
              <div className="font-semibold">צוות העסק</div>
              <div className="text-xs text-qf-mute">{users.length} משתמשים</div>
            </div>
            {isOwner && (
              <button
                type="button"
                onClick={() => setCreating((v) => !v)}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm"
              >
                {creating ? "ביטול" : "+ הוסף משתמש"}
              </button>
            )}
          </header>

          {creating && isOwner && (
            <div className="px-4 lg:px-5 py-4 border-b border-qf-line-soft space-y-3 bg-qf-line-soft/40">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-1">שם מלא</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="לדוגמה: ישראל ישראלי"
                    maxLength={120}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">אימייל</label>
                  <input
                    type="email"
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="staff@example.com"
                    maxLength={160}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium block mb-1">
                    סיסמה ראשונית (8 תווים לפחות)
                  </label>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="ישלח למשתמש בנפרד"
                    minLength={8}
                    maxLength={120}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none font-mono"
                  />
                  <p className="text-xs text-qf-mute mt-1">
                    המשתמש יוכל לשנות את הסיסמה אחרי שייכנס דרך &quot;שכחתי סיסמה&quot;.
                  </p>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-1.5">תפקיד</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {ROLE_OPTIONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={cn(
                        "text-right p-3 rounded-xl border-2 transition",
                        role === r
                          ? "bg-(--qf-primary)/10 border-(--qf-primary)"
                          : "bg-white border-qf-line-dash hover:border-(--qf-primary)/40",
                      )}
                    >
                      <div className="font-bold text-sm">{ROLE_LABEL[r]}</div>
                      <div className="text-xs text-qf-mute mt-0.5 leading-relaxed">
                        {ROLE_DESCRIPTION[r]}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={createUser}
                  disabled={
                    busy || !name.trim() || !email.trim() || password.length < 8
                  }
                  className="px-4 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm disabled:opacity-60"
                >
                  {busy ? "יוצר..." : "צור משתמש"}
                </button>
              </div>
            </div>
          )}

          <div>
            {users.length === 0 ? (
              <div className="px-4 lg:px-5 py-10 text-center text-sm text-qf-mute">
                אין עדיין משתמשים בצוות.
              </div>
            ) : (
              users.map((u) => {
                const userRole: Role = isRole(u.role) ? u.role : "manager";
                const canEdit = isOwner && !u.is_me;
                return (
                  <div
                    key={u.id}
                    className="px-4 lg:px-5 py-4 border-t border-qf-line-soft first:border-t-0"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold truncate">{u.name}</span>
                          {u.is_me && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-qf-line-soft text-qf-ink2">
                              את/ה
                            </span>
                          )}
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-qf-yolk-soft text-qf-ink">
                            {ROLE_LABEL[userRole]}
                          </span>
                        </div>
                        <div className="text-xs text-qf-mute font-mono mt-0.5" dir="ltr">
                          {u.email}
                        </div>
                        <div className="text-xs text-qf-mute mt-0.5">
                          נוצר {formatDateTime(u.created_at)}
                          {u.last_login_at
                            ? ` · התחבר ${formatDateTime(u.last_login_at)}`
                            : " · עדיין לא התחבר"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {canEdit && (
                          <select
                            value={userRole}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (isRole(v)) void updateRole(u.id, v);
                            }}
                            className="text-xs px-2 py-1 rounded-md border border-qf-line-dash bg-white"
                          >
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABEL[r]}
                              </option>
                            ))}
                          </select>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => void resetPassword(u.id)}
                            className="px-2.5 py-0.5 rounded-md border border-qf-line-dash hover:bg-qf-line-soft text-xs"
                          >
                            איפוס סיסמה
                          </button>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => void removeUser(u.id, u.name)}
                            className="px-2.5 py-0.5 rounded-md border border-qf-line-dash hover:bg-qf-tomato-soft hover:text-qf-tomato text-xs"
                          >
                            מחק
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
