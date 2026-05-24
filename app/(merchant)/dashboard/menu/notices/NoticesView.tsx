"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IcoPlus, IcoEdit, IcoTrash, IcoMegaphone } from "@/components/shared/Icons";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Toast, type ToastState, type ToastKind } from "@/components/shared/Toast";
import { PageHeader } from "@/components/merchant/v2/PageHeader";
import { cn } from "@/lib/cn";

type Scope = "store" | "category" | "item";
type Kind = "info" | "warning" | "allergen" | "kosher" | "dietary";

interface Notice {
  id: string;
  scope: Scope;
  categoryId: string | null;
  itemId: string | null;
  kind: Kind;
  title: string;
  body: string | null;
  icon: string | null;
  active: boolean;
  position: number;
}

interface Category { id: string; name: string }
interface Item { id: string; name: string; categoryId: string }

interface Draft {
  id: string | null;
  scope: Scope;
  categoryId: string;
  itemId: string;
  kind: Kind;
  title: string;
  body: string;
  icon: string;
  active: boolean;
}

const EMPTY: Draft = {
  id: null,
  scope: "store",
  categoryId: "",
  itemId: "",
  kind: "info",
  title: "",
  body: "",
  icon: "",
  active: true,
};

const SCOPE_LABEL: Record<Scope, string> = {
  store: "כל החנות",
  category: "קטגוריה",
  item: "פריט",
};

const KIND_LABEL: Record<Kind, string> = {
  info: "מידע",
  warning: "אזהרה",
  allergen: "אלרגן",
  kosher: "כשרות",
  dietary: "תזונתי",
};

const KIND_STYLES: Record<Kind, string> = {
  info: "bg-qf-blue-soft border-qf-blue/40 text-qf-blue",
  warning: "bg-qf-tomato-soft border-qf-tomato/40 text-qf-tomato",
  allergen: "bg-qf-warm-dash border-qf-yolk/50 text-qf-ink",
  kosher: "bg-qf-green-soft border-qf-green-line/60 text-qf-green-deep",
  dietary: "bg-qf-line-soft border-qf-line-dash text-qf-ink",
};

export function NoticesView({
  initial,
  categories,
  items,
}: {
  initial: Notice[];
  categories: Category[];
  items: Item[];
}) {
  const router = useRouter();
  const [list, setList] = useState(initial);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Notice | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  function pushToast(kind: ToastKind, message: string) {
    setToast({ id: Date.now(), kind, message });
  }

  const categoryName = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories],
  );
  const itemLookup = useMemo(
    () => Object.fromEntries(items.map((i) => [i.id, i.name])),
    [items],
  );

  function startNew() {
    setError(null);
    setEditing({ ...EMPTY });
  }

  function startEdit(n: Notice) {
    setError(null);
    setEditing({
      id: n.id,
      scope: n.scope,
      categoryId: n.categoryId ?? "",
      itemId: n.itemId ?? "",
      kind: n.kind,
      title: n.title,
      body: n.body ?? "",
      icon: n.icon ?? "",
      active: n.active,
    });
  }

  async function save() {
    if (!editing) return;
    if (!editing.title.trim()) {
      setError("חובה: כותרת");
      return;
    }
    if (editing.scope === "category" && !editing.categoryId) {
      setError("בחר קטגוריה");
      return;
    }
    if (editing.scope === "item" && !editing.itemId) {
      setError("בחר פריט");
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      scope: editing.scope,
      category_id: editing.scope === "category" ? editing.categoryId : null,
      item_id: editing.scope === "item" ? editing.itemId : null,
      kind: editing.kind,
      title: editing.title.trim(),
      body: editing.body.trim() || null,
      icon: editing.icon.trim() || null,
      active: editing.active,
      position: 0,
    };
    const url = editing.id ? `/api/v1/merchant/notices/${editing.id}` : "/api/v1/merchant/notices";
    const method = editing.id ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data?.error?.message ?? "שמירה נכשלה");
      return;
    }
    const saved: Notice = data.notice;
    setList((prev) =>
      editing.id
        ? prev.map((n) => (n.id === saved.id ? saved : n))
        : [saved, ...prev],
    );
    setEditing(null);
    pushToast("ok", editing.id ? "ההודעה עודכנה" : "ההודעה נוצרה");
    router.refresh();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const res = await fetch(`/api/v1/merchant/notices/${pendingDelete.id}`, {
      method: "DELETE",
    });
    setDeleting(false);
    if (!res.ok) {
      pushToast("err", "מחיקה נכשלה");
      setPendingDelete(null);
      return;
    }
    setList((prev) => prev.filter((n) => n.id !== pendingDelete.id));
    setPendingDelete(null);
    pushToast("ok", "ההודעה נמחקה");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        chip="קטלוג"
        title="הודעות"
        subtitle="באנרים שמופיעים על התפריט — אזהרות, אלרגנים, כשרות. שטח שמור, לא מוצר."
        actions={
          !editing ? (
            <button
              type="button"
              onClick={startNew}
              className="px-4 py-2 rounded-xl bg-black text-[#F8CB1E] border-2 border-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/90 inline-flex items-center gap-1"
            >
              <IcoPlus c="#F8CB1E" s={14} /> הודעה חדשה
            </button>
          ) : undefined
        }
      />

      {error && (
        <div className="bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato text-sm rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      {editing && (
        <div className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-6 space-y-4 max-w-3xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="היקף">
              <select
                value={editing.scope}
                onChange={(e) =>
                  setEditing({ ...editing, scope: e.target.value as Scope })
                }
                className="w-full px-3 py-2 rounded-xl border border-qf-line-dash text-sm"
              >
                <option value="store">כל החנות</option>
                <option value="category">קטגוריה ספציפית</option>
                <option value="item">פריט ספציפי</option>
              </select>
            </Field>
            <Field label="סוג">
              <select
                value={editing.kind}
                onChange={(e) =>
                  setEditing({ ...editing, kind: e.target.value as Kind })
                }
                className="w-full px-3 py-2 rounded-xl border border-qf-line-dash text-sm"
              >
                {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {editing.scope === "category" && (
            <Field label="קטגוריה">
              <select
                value={editing.categoryId}
                onChange={(e) =>
                  setEditing({ ...editing, categoryId: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl border border-qf-line-dash text-sm"
              >
                <option value="">בחר קטגוריה</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {editing.scope === "item" && (
            <Field label="פריט">
              <select
                value={editing.itemId}
                onChange={(e) =>
                  setEditing({ ...editing, itemId: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl border border-qf-line-dash text-sm"
              >
                <option value="">בחר פריט</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} {categoryName[it.categoryId] ? `· ${categoryName[it.categoryId]}` : ""}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="כותרת">
            <input
              type="text"
              value={editing.title}
              maxLength={120}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              placeholder="לדוגמה: הזיתים עלולים להכיל חרצנים"
              className="w-full px-3 py-2 rounded-xl border border-qf-line-dash text-sm"
            />
          </Field>

          <Field label="תיאור (אופציונלי)">
            <textarea
              value={editing.body}
              maxLength={500}
              rows={3}
              onChange={(e) => setEditing({ ...editing, body: e.target.value })}
              placeholder="טקסט תומך — מופיע מתחת לכותרת"
              className="w-full px-3 py-2 rounded-xl border border-qf-line-dash text-sm resize-none"
            />
          </Field>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={editing.active}
              onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
            />
            פעיל
          </label>

          <div className="flex justify-end gap-2 pt-3 border-t border-qf-line-soft">
            <button
              type="button"
              onClick={() => setEditing(null)}
              disabled={busy}
              className="px-4 py-2 rounded-xl bg-white border-2 border-black text-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/5 disabled:opacity-60"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="px-4 py-2 rounded-xl bg-black text-[#F8CB1E] border-2 border-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/90 disabled:opacity-60"
            >
              {busy ? "שומר..." : editing.id ? "עדכן" : "צור"}
            </button>
          </div>
        </div>
      )}

      {!editing && (
        <>
          {list.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-black px-6 py-14 text-center max-w-2xl mx-auto">
              <div
                className="mx-auto w-14 h-14 rounded-2xl grid place-items-center mb-3 border-2 border-black"
                style={{ backgroundColor: "#F8CB1E" }}
              >
                <IcoMegaphone c="#000" s={26} />
              </div>
              <div className="text-lg font-black mb-1">אין הודעות עדיין</div>
              <p className="text-sm text-qf-mute max-w-md mx-auto leading-relaxed">
                הודעות הן באנרים שמופיעים על התפריט — לדוגמה אזהרת חרצנים בזיתים,
                הצהרת אלרגנים או כשרות. שונה ממוצר: אין מחיר, אין כפתור הוספה לעגלה.
              </p>
              <button
                type="button"
                onClick={startNew}
                className="mt-5 inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-black text-[#F8CB1E] border-2 border-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/90"
              >
                <IcoPlus c="#F8CB1E" s={14} /> צור הודעה ראשונה
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {list.map((n) => {
                const target =
                  n.scope === "store"
                    ? "כל החנות"
                    : n.scope === "category"
                      ? `קטגוריה: ${categoryName[n.categoryId ?? ""] ?? "—"}`
                      : `פריט: ${itemLookup[n.itemId ?? ""] ?? "—"}`;
                return (
                  <article
                    key={n.id}
                    className={cn(
                      "bg-white rounded-2xl border p-4 flex items-start gap-3 transition",
                      n.active ? "border-qf-line-dash" : "border-qf-line-dash opacity-60",
                    )}
                  >
                    <div
                      className={cn(
                        "shrink-0 px-2 py-1 rounded-md text-[11px] font-black tracking-wide border",
                        KIND_STYLES[n.kind],
                      )}
                    >
                      {KIND_LABEL[n.kind]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm leading-tight">{n.title}</div>
                      {n.body && (
                        <div className="text-xs text-qf-mute mt-1 leading-relaxed line-clamp-2">{n.body}</div>
                      )}
                      <div className="text-[11px] text-qf-mute mt-2 flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold">{SCOPE_LABEL[n.scope]}</span>
                        <span>·</span>
                        <span className="truncate">{target}</span>
                        {!n.active && (
                          <>
                            <span>·</span>
                            <span className="text-qf-tomato font-semibold">לא פעיל</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(n)}
                        className="w-8 h-8 rounded-lg border border-qf-line-dash grid place-items-center hover:bg-qf-line-soft"
                        aria-label="עריכה"
                      >
                        <IcoEdit c="currentColor" s={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(n)}
                        className="w-8 h-8 rounded-lg border border-qf-tomato/40 text-qf-tomato grid place-items-center hover:bg-qf-tomato-soft"
                        aria-label="מחיקה"
                      >
                        <IcoTrash c="currentColor" s={14} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="למחוק את ההודעה?"
        message={pendingDelete?.title ?? ""}
        confirmLabel="מחק"
        cancelLabel="ביטול"
        variant="danger"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-sm font-medium mb-1.5">{label}</div>
      {children}
    </label>
  );
}
