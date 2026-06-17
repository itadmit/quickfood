"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Modal } from "@/components/shared/Modal";
import { Toggle } from "@/components/shared/Toggle";
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
  linkedItemId: string | null;
  linkedItemName: string | null;
  linkedItemPrice: number | null;
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
  linkedItemId: string | null;
  addonItems: DraftAddon[];
}

const EMPTY_DRAFT: Draft = {
  name: "",
  description: "",
  bundlePrice: 0,
  active: true,
  triggerItemIds: [],
  linkedItemId: null,
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
      linkedItemId: b.linkedItemId,
      addonItems: b.addonItems.map((a) => ({ ...a })),
    });
  }

  async function save() {
    if (!editing) return;
    if (!editing.name.trim()) return pushToast("err", "נדרש שם מבצע");
    if (editing.triggerItemIds.length === 0)
      return pushToast("err", "בחר/י לפחות פריט אחד שמפעיל את המבצע");
    if (!editing.linkedItemId && editing.addonItems.length === 0)
      return pushToast("err", "בחר/י מוצר משודרג או לפחות תוספת אחת");
    if (!editing.linkedItemId && editing.bundlePrice <= 0)
      return pushToast("err", "מחיר חבילה לא תקין");

    setSaving(true);
    const isCreate = !editing.id;
    const url = isCreate
      ? "/api/v1/merchant/bundles"
      : `/api/v1/merchant/bundles/${editing.id}`;
    // When linked_item_id is set, the bundle is a Wolt-style upgrade
    // suggestion - addons get ignored on the customer side, and the
    // bundle's own `bundle_price` is replaced by the linked item's
    // price at suggestion time. We still send a positive bundle_price
    // to satisfy the API schema (the field is required for legacy
    // bundles where it's the actual quoted price).
    const res = await fetch(url, {
      method: isCreate ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: editing.name.trim(),
        description: editing.description.trim() || null,
        bundle_price: editing.bundlePrice || 1,
        active: editing.active,
        trigger_item_ids: editing.triggerItemIds,
        linked_item_id: editing.linkedItemId,
        addon_items: editing.linkedItemId
          ? []
          : editing.addonItems.map((a) => ({ item_id: a.itemId, qty: a.qty })),
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
        subtitle={`${initial.length} מבצעים פעילים · הצעות שמופיעות בסל כשהלקוח מוסיף פריט שמפעיל את המבצע`}
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
          עוד אין מבצעי חבילות. צרו את המבצע הראשון, למשל: בקניית &quot;המבורגר&quot; תציע &quot;צ&apos;יפס + שתייה ב-₪15&quot;.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {initial.map((b) => {
            const isLinked = !!b.linkedItemId;
            // Wolt-style bundle: savings = sum of trigger item prices vs
            // the combo product's price (since the combo replaces the
            // triggers in the cart on accept). Legacy bundle: savings =
            // sum of addon prices vs bundle_price (the addons get added
            // on top of the cart at a discount).
            const fullPrice = isLinked
              ? b.triggerItemIds.reduce(
                  (acc, id) => acc + (itemById.get(id)?.basePrice ?? 0),
                  0,
                )
              : b.addonItems.reduce(
                  (acc, a) => acc + (itemById.get(a.itemId)?.basePrice ?? 0) * a.qty,
                  0,
                );
            const displayPrice = isLinked
              ? b.linkedItemPrice ?? 0
              : b.bundlePrice;
            const savings = Math.max(0, fullPrice - displayPrice);
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
                  <span className="font-medium text-qf-ink">
                    {isLinked ? "משדרג ל-" : "מוסיף:"}
                  </span>{" "}
                  {isLinked
                    ? b.linkedItemName ?? "?"
                    : b.addonItems
                        .map((a) => {
                          const name = itemById.get(a.itemId)?.name ?? "?";
                          return a.qty > 1 ? `${a.qty}× ${name}` : name;
                        })
                        .join(" + ")}
                </div>
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-lg font-black tnum text-(--qf-deep)">
                    {formatPrice(displayPrice)}
                  </span>
                  {fullPrice > displayPrice && (
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
        <Modal
          open
          onClose={() => setEditing(null)}
          closeOnBackdrop={!saving}
          size="xl"
          ariaLabel={editing.id ? "עריכת מבצע" : "מבצע חדש"}
        >
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
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

            <div className="bg-[#FFF7D6] border border-[#F8CB1E]/50 rounded-2xl p-3 space-y-2">
              <div>
                <span className="text-xs font-bold block mb-1">
                  מוצר משודרג (מומלץ)
                </span>
                <p className="text-[11px] text-qf-ink2 mb-2 leading-relaxed">
                  בחר/י מוצר קומבו קיים בתפריט (לדוגמה "ארוחת מלווח · 25₪").
                  ההצעה תוצג ללקוח כ"שדרג ל-X, חוסכים Y₪" - הלקוח יפתח את
                  המוצר ויבחר בעצמו את התוספות (שתייה / גודל / וכו׳).
                  המנות שהפעילו את ההצעה יוסרו מהסל אוטומטית.
                </p>
                <select
                  value={editing.linkedItemId ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      linkedItemId: e.target.value || null,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none bg-white"
                >
                  <option value="">- ללא מוצר משודרג (השתמש בתוספות סטטיות למטה) -</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} · {formatPrice(i.basePrice)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!editing.linkedItemId && (
            <div>
              <span className="text-xs font-bold block mb-1">
                פריטים בחבילה (תוספות סטטיות)
              </span>
              <p className="text-[11px] text-qf-mute mb-2">
                ישתמש רק כשאין מוצר משודרג. הפריטים מתווספים לסל ישירות
                בכמות שתבחר/י - הלקוח לא יכול להחליף אותם.
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
            )}

            {!editing.linkedItemId && (
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
            )}

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <Toggle
                checked={editing.active}
                onChange={(next) => setEditing({ ...editing, active: next })}
                aria-label="המבצע פעיל"
              />
              <span className="text-sm font-medium">המבצע פעיל</span>
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
                className="px-5 py-2 rounded-xl bg-[#F8CB1E] hover:bg-[#FFD843] text-black border-2 border-black shadow-[0_2px_0_#000] active:translate-y-px active:shadow-[0_1px_0_#000] text-sm font-bold transition disabled:opacity-60"
              >
                {saving ? "שומר..." : "שמירה"}
              </button>
            </div>
          </div>
        </Modal>
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
