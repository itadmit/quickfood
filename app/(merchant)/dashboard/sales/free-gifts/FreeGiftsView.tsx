"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Modal } from "@/components/shared/Modal";
import { Toggle } from "@/components/shared/Toggle";
import { Toast, type ToastState, type ToastKind } from "@/components/shared/Toast";
import { PageHeader } from "@/components/merchant/v2/PageHeader";
import { formatPrice } from "@/lib/format";

interface Rule {
  id: string;
  itemId: string;
  itemName: string;
  itemAvailable: boolean;
  minSubtotal: number;
  active: boolean;
  validFrom: string | null;
  validUntil: string | null;
}
interface ItemRow {
  id: string;
  name: string;
  basePrice: number;
}
interface Draft {
  id?: string;
  itemId: string;
  minSubtotal: number;
  active: boolean;
  /** datetime-local values ("YYYY-MM-DDTHH:mm"), "" = no limit */
  validFrom: string;
  validUntil: string;
}

const EMPTY: Draft = { itemId: "", minSubtotal: 150, active: true, validFrom: "", validUntil: "" };

/** ISO → value for <input type="datetime-local"> in the browser's local time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string): string | null {
  return v ? new Date(v).toISOString() : null;
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
}

export function FreeGiftsView({ initial, items }: { initial: Rule[]; items: ItemRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Rule | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  // Frozen at mount: only used for the "expired / not started" badges.
  const [now] = useState(() => Date.now());
  const toastSeq = useRef(0);
  function pushToast(kind: ToastKind, message: string) {
    toastSeq.current += 1;
    setToast({ id: toastSeq.current, kind, message });
  }

  async function save() {
    if (!editing) return;
    if (!editing.itemId) return pushToast("err", "בחר/י את המנה שתינתן במתנה");
    if (!(editing.minSubtotal >= 1)) return pushToast("err", "סכום מינימום לא תקין");
    if (editing.validFrom && editing.validUntil && editing.validFrom >= editing.validUntil)
      return pushToast("err", "תאריך הסיום חייב להיות אחרי תאריך ההתחלה");

    setSaving(true);
    const isCreate = !editing.id;
    const res = await fetch(
      isCreate ? "/api/v1/merchant/free-gifts" : `/api/v1/merchant/free-gifts/${editing.id}`,
      {
        method: isCreate ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          item_id: editing.itemId,
          min_subtotal: Math.round(editing.minSubtotal),
          active: editing.active,
          valid_from: fromLocalInput(editing.validFrom),
          valid_until: fromLocalInput(editing.validUntil),
        }),
      },
    );
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      pushToast("err", body?.error?.message ?? "שמירה נכשלה");
      return;
    }
    setEditing(null);
    pushToast("ok", isCreate ? "המתנה נוצרה" : "המתנה עודכנה");
    router.refresh();
  }

  async function toggleActive(r: Rule, next: boolean) {
    const res = await fetch(`/api/v1/merchant/free-gifts/${r.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: next }),
    });
    if (!res.ok) return pushToast("err", "העדכון נכשל");
    router.refresh();
  }

  async function performDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const res = await fetch(`/api/v1/merchant/free-gifts/${pendingDelete.id}`, { method: "DELETE" });
    setDeleting(false);
    setPendingDelete(null);
    if (!res.ok) return pushToast("err", "מחיקה נכשלה");
    pushToast("ok", "המתנה נמחקה");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        chip="מכירות"
        title="מתנה מעל סכום"
        subtitle="מנה שנוספת לסל אוטומטית ב-0 ₪ כשסכום ההזמנה מגיע לסף. יורד מתחת לסף - המנה יורדת."
        actions={
          <button
            type="button"
            onClick={() => setEditing({ ...EMPTY })}
            className="px-3.5 py-2 rounded-xl bg-black text-[#F8CB1E] border-2 border-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/90"
          >
            + מתנה חדשה
          </button>
        }
      />

      <p className="text-xs text-qf-mute leading-relaxed">
        הסף נמדד על סכום המנות בסל, לפני הנחות, בלי דמי משלוח ובלי המתנה עצמה. אם יש כמה כללים,
        הלקוח מקבל מתנה אחת: של הסף הגבוה ביותר שהגיע אליו. המתנה ניתנת בהזמנות מהאתר ומהקיוסק.
      </p>

      {initial.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-qf-line-dash p-10 text-center text-qf-mute">
          עוד אין מתנות. לדוגמה: בהזמנה מעל ₪150 - רול סלמון במתנה.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {initial.map((r) => {
            const expired = r.validUntil != null && Date.parse(r.validUntil) < now;
            const notStarted = r.validFrom != null && Date.parse(r.validFrom) > now;
            return (
              <article key={r.id} className="bg-white rounded-2xl border border-qf-line-dash p-4 space-y-2">
                <header className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold truncate flex items-center gap-2 flex-wrap">
                      {r.itemName}
                      {!r.active && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-qf-line-soft text-qf-mute">לא פעיל</span>
                      )}
                      {expired && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-qf-line-soft text-qf-mute">פג תוקף</span>
                      )}
                      {notStarted && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-qf-line-soft text-qf-mute">טרם התחיל</span>
                      )}
                      {!r.itemAvailable && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-qf-tomato-soft text-qf-tomato">המנה לא זמינה</span>
                      )}
                    </div>
                    <div className="text-sm mt-1">
                      בהזמנה מעל <span className="font-black tnum">{formatPrice(r.minSubtotal)}</span>
                    </div>
                    {(r.validFrom || r.validUntil) && (
                      <div className="text-xs text-qf-mute mt-0.5 tnum">
                        {r.validFrom ? `מ-${fmtDate(r.validFrom)}` : ""}
                        {r.validFrom && r.validUntil ? " · " : ""}
                        {r.validUntil ? `עד ${fmtDate(r.validUntil)}` : ""}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Toggle checked={r.active} onChange={(next) => toggleActive(r, next)} aria-label="המתנה פעילה" />
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({
                          id: r.id,
                          itemId: r.itemId,
                          minSubtotal: r.minSubtotal,
                          active: r.active,
                          validFrom: toLocalInput(r.validFrom),
                          validUntil: toLocalInput(r.validUntil),
                        })
                      }
                      className="text-xs px-2.5 py-1 rounded-md border border-qf-line-dash text-qf-mute hover:text-qf-ink"
                    >
                      עריכה
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(r)}
                      className="text-qf-mute hover:text-qf-tomato text-xl leading-none px-1"
                      aria-label="מחק מתנה"
                    >
                      ×
                    </button>
                  </div>
                </header>
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
          size="md"
          ariaLabel={editing.id ? "עריכת מתנה" : "מתנה חדשה"}
        >
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
            <h3 className="font-bold text-lg">{editing.id ? "עריכת מתנה" : "מתנה חדשה"}</h3>

            <label className="block">
              <span className="text-xs font-bold block mb-1">המנה שתינתן במתנה</span>
              <select
                value={editing.itemId}
                onChange={(e) => setEditing({ ...editing, itemId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none bg-white"
              >
                <option value="">בחר/י מנה...</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} · {formatPrice(i.basePrice)}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-qf-mute mt-1">
                המנה נכנסת כמו שהיא, בלי בחירת תוספות. עדיף מנה בלי תוספות חובה.
              </p>
            </label>

            <label className="block">
              <span className="text-xs font-bold block mb-1">סכום מינימום להזמנה (₪)</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={editing.minSubtotal || ""}
                onChange={(e) => setEditing({ ...editing, minSubtotal: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-xl border border-qf-line-dash text-center text-2xl font-bold tnum"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-bold block mb-1">מתחיל (אופציונלי)</span>
                <input
                  type="datetime-local"
                  value={editing.validFrom}
                  onChange={(e) => setEditing({ ...editing, validFrom: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-qf-line-dash tnum"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold block mb-1">מסתיים (אופציונלי)</span>
                <input
                  type="datetime-local"
                  value={editing.validUntil}
                  onChange={(e) => setEditing({ ...editing, validUntil: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-qf-line-dash tnum"
                />
              </label>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <Toggle
                checked={editing.active}
                onChange={(next) => setEditing({ ...editing, active: next })}
                aria-label="המתנה פעילה"
              />
              <span className="text-sm font-medium">המתנה פעילה</span>
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
        title="מחיקת מתנה"
        message={<>המתנה &quot;<strong>{pendingDelete?.itemName}</strong>&quot; תימחק.</>}
        confirmLabel="מחק"
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
