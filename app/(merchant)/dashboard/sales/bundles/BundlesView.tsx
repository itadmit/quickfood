"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Toast, type ToastState, type ToastKind } from "@/components/shared/Toast";
import { PageHeader } from "@/components/merchant/v2/PageHeader";
import { formatPrice } from "@/lib/format";

interface Bundle {
  id: string;
  name: string;
  description: string | null;
  bundlePrice: number;
  active: boolean;
  triggerItemIds: string[];
  addonItems: Array<{ itemId: string; qty: number }>;
}
interface ItemRow {
  id: string;
  name: string;
  basePrice: number;
}
type DraftAddon = { itemId: string; qty: number };
interface Draft {
  id?: string;
  name: string;
  description: string;
  bundlePrice: number;
  active: boolean;
  triggerItemIds: string[];
  addonItems: DraftAddon[];
}

const EMPTY_DRAFT: Draft = {
  name: "",
  description: "",
  bundlePrice: 0,
  active: true,
  triggerItemIds: [],
  addonItems: [],
};

export function BundlesView({
  initial,
  items,
}: {
  initial: Bundle[];
  items: ItemRow[];
}) {
  const router = useRouter();
  const itemById = new Map(items.map((i) => [i.id, i]));
  const [editing, setEditing] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Bundle | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  function pushToast(kind: ToastKind, message: string) {
    setToast({ id: Date.now(), kind, message });
  }

  function openNew() {
    setEditing({ ...EMPTY_DRAFT });
  }
  function openEdit(b: Bundle) {
    setEditing({
      id: b.id,
      name: b.name,
      description: b.description ?? "",
      bundlePrice: b.bundlePrice,
      active: b.active,
      triggerItemIds: [...b.triggerItemIds],
      addonItems: b.addonItems.map((a) => ({ ...a })),
    });
  }

  async function save() {
    if (!editing) return;
    if (!editing.name.trim()) return pushToast("err", "נדרש שם מבצע");
    if (editing.triggerItemIds.length === 0)
      return pushToast("err", "בחר/י לפחות פריט אחד שמפעיל את המבצע");
    if (editing.addonItems.length === 0)
      return pushToast("err", "בחר/י לפחות פריט אחד להוסיף");
    if (editing.bundlePrice <= 0) return pushToast("err", "מחיר חבילה לא תקין");

    setSaving(true);
    const isCreate = !editing.id;
    const url = isCreate
      ? "/api/v1/merchant/bundles"
      : `/api/v1/merchant/bundles/${editing.id}`;
    const res = await fetch(url, {
      method: isCreate ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: editing.name.trim(),
        description: editing.description.trim() || null,
        bundle_price: editing.bundlePrice,
        active: editing.active,
        trigger_item_ids: editing.triggerItemIds,
        addon_items: editing.addonItems,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      pushToast("err", body?.error?.message ?? "שמירה נכשלה");
      return;
    }
    setEditing(null);
    pushToast("ok", isCreate ? "המבצע נוצר" : "המבצע עודכן");
    router.refresh();
  }

  async function performDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const res = await fetch(`/api/v1/merchant/bundles/${pendingDelete.id}`, {
      method: "DELETE",
    });
    setDeleting(false);
    setPendingDelete(null);
    if (!res.ok) {
      pushToast("err", "מחיקה נכשלה");
      return;
    }
    pushToast("ok", "המבצע נמחק");
    router.refresh();
  }

  function fullPriceOf(d: Draft): number {
    return d.addonItems.reduce(
      (acc, a) => acc + (itemById.get(a.itemId)?.basePrice ?? 0) * a.qty,
      0,
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        chip="מכירות"
        title="מבצעי חבילות"
        subtitle={`${initial.length} מבצעים · "הוסיפו צ׳יפס + שתייה ב-X" — מופיעים בסל כשפריט מתאים נכנס`}
        actions={
          <button
            type="button"
            onClick={openNew}
            className="px-3.5 py-2 rounded-xl bg-black text-[#F8CB1E] border-2 border-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/90"
          >
            + מבצע חדש
          </button>
        }
      />

      {initial.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-qf-line-dash p-10 text-center text-qf-mute">
          עוד אין מבצעי חבילות. צרי את הראשון — &quot;פיצה ⟵ צ&apos;יפס + שתייה ב-₪15&quot;.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {initial.map((b) => {
            const fullPrice = b.addonItems.reduce(
              (acc, a) => acc + (itemById.get(a.itemId)?.basePrice ?? 0) * a.qty,
              0,
            );
            const savings = Math.max(0, fullPrice - b.bundlePrice);
            return (
              <article
                key={b.id}
                className="bg-white rounded-2xl border border-qf-line-dash p-4 space-y-2"
              >
                <header className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold truncate flex items-center gap-2">
                      {b.name}
                      {!b.active && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-qf-line-soft text-qf-mute">
                          לא פעיל
                        </span>
                      )}
                    </div>
                    {b.description && (
                      <p className="text-xs text-qf-mute mt-0.5">{b.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(b)}
                      className="text-xs px-2.5 py-1 rounded-md border border-qf-line-dash text-qf-mute hover:text-qf-ink"
                    >
                      עריכה
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(b)}
                      className="text-qf-mute hover:text-qf-tomato text-xl leading-none px-1"
                      aria-label="הסר מבצע"
                    >
                      ×
                    </button>
                  </div>
                </header>
                <div className="text-xs text-qf-mute">
                  <span className="font-medium text-qf-ink">מפעיל:</span>{" "}
                  {b.triggerItemIds
                    .map((id) => itemById.get(id)?.name ?? "?")
                    .join(" / ")}
                </div>
                <div className="text-xs text-qf-mute">
                  <span className="font-medium text-qf-ink">מוסיף:</span>{" "}
                  {b.addonItems
                    .map((a) => {
                      const name = itemById.get(a.itemId)?.name ?? "?";
                      return a.qty > 1 ? `${a.qty}× ${name}` : name;
                    })
                    .join(" + ")}
                </div>
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-lg font-black tnum text-(--qf-deep)">
                    {formatPrice(b.bundlePrice)}
                  </span>
                  {fullPrice > b.bundlePrice && (
                    <>
                      <span className="text-xs text-qf-mute line-through tnum">
                        {formatPrice(fullPrice)}
                      </span>
                      <span className="text-xs text-qf-tomato font-bold">
                        חוסכים {formatPrice(savings)}
                      </span>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4"
          onClick={() => !saving && setEditing(null)}
        >
          <div
            className="bg-white rounded-2xl p-5 w-full max-w-xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-lg">
              {editing.id ? "עריכת מבצע" : "מבצע חדש"}
            </h3>

            <label className="block">
              <span className="text-xs font-bold block mb-1">שם המבצע</span>
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="ארוחה זוגית"
                className="w-full px-3 py-2 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold block mb-1">תיאור (אופציונלי)</span>
              <input
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                placeholder="צ׳יפס + שתייה במחיר מיוחד"
                className="w-full px-3 py-2 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
              />
            </label>

            <div>
              <span className="text-xs font-bold block mb-1">פריטים שמפעילים את המבצע</span>
              <p className="text-[11px] text-qf-mute mb-2">
                המבצע יוצע ללקוח אם לפחות אחד מהפריטים האלה נמצא בסל.
              </p>
              <select
                multiple
                value={editing.triggerItemIds}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    triggerItemIds: Array.from(e.target.selectedOptions, (o) => o.value),
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none min-h-32"
              >
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} · {formatPrice(i.basePrice)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="text-xs font-bold block mb-1">פריטים בחבילה (תוספות)</span>
              <p className="text-[11px] text-qf-mute mb-2">
                הפריטים שיתווספו לסל כשהלקוח מאשר. כל אחד עם כמות.
              </p>
              <div className="space-y-1.5">
                {editing.addonItems.map((a, idx) => (
                  <div key={idx} className="flex gap-2">
                    <select
                      value={a.itemId}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          addonItems: editing.addonItems.map((x, i) =>
                            i === idx ? { ...x, itemId: e.target.value } : x,
                          ),
                        })
                      }
                      className="flex-1 px-3 py-2 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
                    >
                      <option value="">בחר פריט...</option>
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={a.qty}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          addonItems: editing.addonItems.map((x, i) =>
                            i === idx ? { ...x, qty: parseInt(e.target.value) || 1 } : x,
                          ),
                        })
                      }
                      className="w-20 px-3 py-2 rounded-xl border border-qf-line-dash text-center tnum"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({
                          ...editing,
                          addonItems: editing.addonItems.filter((_, i) => i !== idx),
                        })
                      }
                      className="text-qf-mute hover:text-qf-tomato text-2xl px-1"
                      aria-label="הסר"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setEditing({
                      ...editing,
                      addonItems: [...editing.addonItems, { itemId: "", qty: 1 }],
                    })
                  }
                  className="text-xs text-(--qf-deep) hover:underline"
                >
                  + הוסף פריט
                </button>
              </div>
            </div>

            <label className="block">
              <span className="text-xs font-bold block mb-1">מחיר חבילה (₪)</span>
              <input
                type="number"
                min={1}
                value={editing.bundlePrice || ""}
                onChange={(e) =>
                  setEditing({ ...editing, bundlePrice: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 rounded-xl border border-qf-line-dash text-center text-2xl font-bold tnum"
              />
              <p className="text-[11px] text-qf-mute mt-1 tnum">
                מחיר רגיל של התוספות: {formatPrice(fullPriceOf(editing))} · חיסכון:{" "}
                {formatPrice(Math.max(0, fullPriceOf(editing) - editing.bundlePrice))}
              </p>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editing.active}
                onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                className="w-5 h-5 accent-(--qf-primary)"
              />
              <span className="text-sm">המבצע פעיל</span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={saving}
                className="px-4 py-2 rounded-xl border border-qf-line-dash text-sm"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-bold disabled:opacity-60"
              >
                {saving ? "שומר..." : "שמירה"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="הסרת מבצע"
        message={<>המבצע &quot;<strong>{pendingDelete?.name}</strong>&quot; יוסר.</>}
        confirmLabel="הסר"
        cancelLabel="ביטול"
        variant="danger"
        busy={deleting}
        onConfirm={performDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
