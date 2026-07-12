"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IcoPlus, IcoClose } from "@/components/shared/Icons";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Toast, type ToastState, type ToastKind } from "@/components/shared/Toast";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { PageHeader } from "@/components/merchant/v2/PageHeader";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

interface PickerItem {
  id: string;
  name: string;
  basePrice: number;
  categoryId: string;
  available: boolean;
  image: string | null;
}

interface DealSlotRow {
  id?: string;
  name: string;
  quantity: number;
  items: Array<{ id: string; name: string; base_price: number; available: boolean; image: string | null }>;
}

interface DealRow {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  fixed_price: number;
  active: boolean;
  position: number;
  category_id: string | null;
  slots: DealSlotRow[];
}

interface EditingDeal extends Omit<DealRow, "id"> {
  id: string | null;
}

const EMPTY: EditingDeal = {
  id: null,
  name: "דיל חדש",
  description: "",
  image_url: null,
  fixed_price: 68,
  active: true,
  position: 0,
  category_id: null,
  slots: [{ name: "מנה", quantity: 1, items: [] }],
};

export function DealsManager({
  initialDeals,
  menuItems,
  categories,
}: {
  initialDeals: DealRow[];
  menuItems: PickerItem[];
  categories: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [deals, setDeals] = useState(initialDeals);
  const [editing, setEditing] = useState<EditingDeal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DealRow | null>(null);
  const [busy, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  function pushToast(kind: ToastKind, message: string) {
    setToast({ id: Date.now(), kind, message });
  }

  async function save() {
    if (!editing) return;
    setError(null);
    if (!editing.name.trim() || editing.fixed_price < 1) {
      setError("חובה: שם ומחיר תקין");
      return;
    }
    if (editing.slots.length === 0 || editing.slots.some((s) => !s.name.trim() || s.items.length === 0)) {
      setError("לכל שלב בדיל צריך שם ולפחות מנה אחת לבחירה");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: editing.name,
        description: editing.description,
        image_url: editing.image_url,
        fixed_price: editing.fixed_price,
        active: editing.active,
        position: editing.position,
        category_id: editing.category_id,
        slots: editing.slots.map((s) => ({
          name: s.name,
          quantity: s.quantity,
          item_ids: s.items.map((i) => i.id),
        })),
      };
      const res = await fetch(
        editing.id ? `/api/v1/merchant/menu/deals/${editing.id}` : "/api/v1/merchant/menu/deals",
        {
          method: editing.id ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = await res.json();
      if (!res.ok) {
        setError(result.error?.message ?? "שמירה נכשלה");
        return;
      }
      const saved: DealRow = result.deal;
      setDeals((prev) =>
        editing.id ? prev.map((d) => (d.id === editing.id ? saved : d)) : [...prev, saved],
      );
      setEditing(null);
      pushToast("ok", editing.id ? "הדיל עודכן" : "הדיל נוצר");
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  async function performDelete() {
    if (!confirmDelete) return;
    const res = await fetch(`/api/v1/merchant/menu/deals/${confirmDelete.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      pushToast("err", body?.error?.message ?? "מחיקה נכשלה");
      setConfirmDelete(null);
      return;
    }
    setDeals((prev) => prev.filter((d) => d.id !== confirmDelete.id));
    pushToast("ok", "הדיל נמחק");
    setConfirmDelete(null);
    startTransition(() => router.refresh());
  }

  async function toggleActive(deal: DealRow) {
    const next = { ...deal, active: !deal.active };
    setDeals((prev) => prev.map((d) => (d.id === deal.id ? next : d)));
    const res = await fetch(`/api/v1/merchant/menu/deals/${deal.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: deal.name,
        description: deal.description,
        image_url: deal.image_url,
        fixed_price: deal.fixed_price,
        active: !deal.active,
        position: deal.position,
        category_id: deal.category_id,
        slots: deal.slots.map((s) => ({
          name: s.name,
          quantity: s.quantity,
          item_ids: s.items.map((i) => i.id),
        })),
      }),
    });
    if (!res.ok) {
      setDeals((prev) => prev.map((d) => (d.id === deal.id ? deal : d)));
      pushToast("err", "השינוי נכשל");
      return;
    }
    pushToast("ok", next.active ? "הדיל הופעל" : "הדיל הושבת");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        chip="קטלוג"
        title="דילים"
        subtitle="ארוחות במחיר קבוע שמורכבות ממנות קיימות - הלקוח בוחר, התוספות מתעדכנות לבד"
        actions={
          !editing ? (
            <button
              type="button"
              onClick={() => setEditing({ ...EMPTY, position: deals.length })}
              className="px-4 py-2 rounded-xl bg-black text-[#F8CB1E] border-2 border-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/90 inline-flex items-center gap-1"
            >
              <IcoPlus c="#F8CB1E" s={14} /> דיל חדש
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
        <DealEditor
          deal={editing}
          onChange={setEditing}
          menuItems={menuItems}
          categories={categories}
          saving={saving}
          onCancel={() => {
            setEditing(null);
            setError(null);
          }}
          onSave={save}
        />
      )}

      {!editing && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {deals.length === 0 && (
            <div className="col-span-full text-center py-14 bg-white border-2 border-dashed border-qf-line-dash rounded-2xl px-6">
              <div className="text-base font-semibold text-qf-ink mb-1">אין דילים עדיין</div>
              <p className="text-sm text-qf-mute max-w-md mx-auto leading-snug">
                לדוגמה: ״דיל זוגי - 2 מנות פלאפל/סביח + 2 פחיות ב-68₪״. בוחרים מנות קיימות
                מהתפריט, קובעים מחיר קבוע, והלקוח מרכיב לבד. התוספות של כל מנה נמשכות
                מהתפריט בזמן אמת.
              </p>
              <button
                type="button"
                onClick={() => setEditing({ ...EMPTY })}
                className="mt-4 inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium"
              >
                <IcoPlus c="white" s={14} /> צור את הדיל הראשון
              </button>
            </div>
          )}
          {deals.map((d) => (
            <article key={d.id} className="bg-white border border-qf-line-dash rounded-2xl p-4 space-y-2">
              <header className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-semibold truncate">{d.name}</h3>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-qf-green-soft text-qf-green-deep tnum">
                      {formatPrice(d.fixed_price)}
                    </span>
                  </div>
                  {d.description && (
                    <p className="text-xs text-qf-mute leading-snug line-clamp-1">{d.description}</p>
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap",
                    d.active ? "bg-qf-green-soft text-qf-green-deep" : "bg-qf-line-soft text-qf-mute",
                  )}
                >
                  {d.active ? "פעיל" : "כבוי"}
                </span>
              </header>
              <div className="space-y-1">
                {d.slots.map((s, i) => (
                  <div key={i} className="text-xs text-qf-ink2">
                    <span className="font-semibold">
                      {s.quantity > 1 ? `${s.quantity}× ` : ""}
                      {s.name}:
                    </span>{" "}
                    {s.items.map((it) => it.name).join(" / ")}
                  </div>
                ))}
              </div>
              <footer className="flex justify-end gap-2 pt-2 border-t border-qf-line-soft">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(d)}
                  className="text-xs text-qf-tomato hover:underline"
                >
                  מחק
                </button>
                <button
                  type="button"
                  onClick={() => toggleActive(d)}
                  className="text-xs text-qf-ink2 hover:underline font-medium"
                >
                  {d.active ? "השבת" : "הפעל"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing({ ...d, slots: d.slots.map((s) => ({ ...s, items: [...s.items] })) })}
                  className="text-xs text-(--qf-deep) hover:underline font-medium"
                >
                  עריכה
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="מחיקת דיל"
        message={
          <>
            הדיל <span className="font-semibold">&quot;{confirmDelete?.name}&quot;</span> יימחק. פעולה זו לא ניתנת לביטול.
          </>
        }
        confirmLabel="מחק"
        cancelLabel="ביטול"
        variant="danger"
        busy={busy}
        onConfirm={performDelete}
        onCancel={() => setConfirmDelete(null)}
      />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

function DealEditor({
  deal,
  onChange,
  menuItems,
  categories,
  saving,
  onCancel,
  onSave,
}: {
  deal: EditingDeal;
  onChange: (d: EditingDeal) => void;
  menuItems: PickerItem[];
  categories: Array<{ id: string; name: string }>;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);

  function updateSlot(i: number, patch: Partial<DealSlotRow>) {
    onChange({
      ...deal,
      slots: deal.slots.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    });
  }

  return (
    <section className="bg-white rounded-2xl border border-qf-line-dash p-5 space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="font-semibold">{deal.id ? "עריכת דיל" : "דיל חדש"}</h2>
        <button
          type="button"
          onClick={onCancel}
          className="w-8 h-8 rounded-lg hover:bg-qf-line-soft grid place-items-center"
          aria-label="סגור"
        >
          <IcoClose s={14} />
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">שם הדיל</span>
          <input
            value={deal.name}
            onChange={(e) => onChange({ ...deal, name: e.target.value })}
            placeholder="דיל זוגי"
            className="px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-base lg:text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">מחיר קבוע (₪)</span>
          <input
            type="number"
            min={1}
            value={deal.fixed_price}
            onChange={(e) => onChange({ ...deal, fixed_price: parseInt(e.target.value, 10) || 0 })}
            className="px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none tnum text-base lg:text-sm"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">תיאור</span>
        <input
          value={deal.description}
          onChange={(e) => onChange({ ...deal, description: e.target.value })}
          placeholder="2 מנות פלאפל/סביח + 2 פחיות"
          maxLength={400}
          className="px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-base lg:text-sm"
        />
      </label>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="text-sm space-y-1">
          <span className="font-medium">תמונה (אופציונלי)</span>
          <ImageUploader
            type="menu_item_image"
            value={deal.image_url ? [deal.image_url] : []}
            onChange={(next) => onChange({ ...deal, image_url: next[0] ?? null })}
            max={1}
          />
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">להציג גם בקטגוריה (אופציונלי)</span>
          <select
            value={deal.category_id ?? ""}
            onChange={(e) => onChange({ ...deal, category_id: e.target.value || null })}
            className="px-3.5 py-2.5 rounded-xl border border-qf-line-dash bg-white outline-none text-base lg:text-sm"
          >
            <option value="">רק במדור הדילים</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-qf-mute">
            הדיל תמיד מופיע במדור ״דילים״ בראש התפריט; כאן אפשר לשייך אותו גם לקטגוריה.
          </span>
        </label>
      </div>

      <div className="space-y-3">
        <header className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">הרכב הדיל</h3>
          <button
            type="button"
            onClick={() =>
              onChange({ ...deal, slots: [...deal.slots, { name: "", quantity: 1, items: [] }] })
            }
            className="text-(--qf-deep) text-sm inline-flex items-center gap-1"
          >
            <IcoPlus c="var(--qf-deep)" s={14} /> הוסף שלב
          </button>
        </header>
        <p className="text-xs text-qf-mute -mt-1">
          כל שלב = בחירה אחת של הלקוח. ״2 מנות״ = שלב עם כמות 2; הלקוח יבחר כל מנה בנפרד
          מתוך המנות שסימנת. התוספות של כל מנה נמשכות מהתפריט אוטומטית.
        </p>

        {deal.slots.map((slot, si) => (
          <div key={si} className="border border-qf-line-soft bg-qf-bg/40 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <input
                value={slot.name}
                onChange={(e) => updateSlot(si, { name: e.target.value })}
                placeholder="שם השלב (למשל: מנה עיקרית / שתייה)"
                className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-qf-line-dash bg-white text-sm"
              />
              <label className="flex items-center gap-1.5 text-xs text-qf-mute shrink-0">
                כמות
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={slot.quantity}
                  onChange={(e) =>
                    updateSlot(si, { quantity: Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)) })
                  }
                  className="w-14 px-2 py-1.5 rounded-lg border border-qf-line-dash bg-white text-center text-sm tnum"
                />
              </label>
              <button
                type="button"
                onClick={() => onChange({ ...deal, slots: deal.slots.filter((_, idx) => idx !== si) })}
                className="w-9 h-9 rounded-md hover:bg-qf-tomato-soft text-qf-mute hover:text-qf-tomato grid place-items-center shrink-0"
                aria-label="הסר שלב"
              >
                <IcoClose s={14} />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {slot.items.map((it) => (
                <span
                  key={it.id}
                  className="inline-flex items-center gap-1.5 bg-white border border-qf-line rounded-lg px-2 py-1 text-xs"
                >
                  {it.name}
                  <button
                    type="button"
                    onClick={() =>
                      updateSlot(si, { items: slot.items.filter((x) => x.id !== it.id) })
                    }
                    aria-label={`הסר ${it.name}`}
                    className="text-qf-mute hover:text-qf-tomato"
                  >
                    <IcoClose s={10} />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={() => setPickerSlot(pickerSlot === si ? null : si)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-qf-mute text-xs text-qf-ink2 hover:border-(--qf-primary) hover:text-(--qf-deep)"
              >
                <IcoPlus s={10} c="currentColor" /> הוסף מנות לבחירה
              </button>
            </div>

            {pickerSlot === si && (
              <ItemPicker
                menuItems={menuItems}
                selected={new Set(slot.items.map((i) => i.id))}
                onToggle={(item) => {
                  const has = slot.items.some((x) => x.id === item.id);
                  updateSlot(si, {
                    items: has
                      ? slot.items.filter((x) => x.id !== item.id)
                      : [
                          ...slot.items,
                          {
                            id: item.id,
                            name: item.name,
                            base_price: item.basePrice,
                            available: item.available,
                            image: item.image,
                          },
                        ],
                  });
                }}
              />
            )}
          </div>
        ))}
      </div>

      <footer className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl border border-qf-line-dash text-sm hover:bg-qf-line-soft"
        >
          ביטול
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-5 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-bold disabled:opacity-60"
        >
          {saving ? "שומר..." : "שמירה"}
        </button>
      </footer>
    </section>
  );
}

function ItemPicker({
  menuItems,
  selected,
  onToggle,
}: {
  menuItems: PickerItem[];
  selected: Set<string>;
  onToggle: (item: PickerItem) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return menuItems;
    return menuItems.filter((i) => i.name.toLowerCase().includes(query));
  }, [menuItems, q]);

  return (
    <div className="bg-white border border-qf-line rounded-xl p-2.5 space-y-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="חיפוש מנה..."
        className="w-full px-3 py-2 rounded-lg border border-qf-line-dash text-sm outline-none focus:border-(--qf-primary)"
      />
      <div className="max-h-52 overflow-y-auto space-y-1">
        {filtered.map((item) => {
          const active = selected.has(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item)}
              className={cn(
                "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-sm text-start transition",
                active ? "bg-(--qf-primary)/10 text-(--qf-deep) font-medium" : "hover:bg-qf-line-soft",
              )}
              aria-pressed={active}
            >
              <span className="truncate">
                {item.name}
                {!item.available && <span className="text-qf-tomato text-xs ms-1.5">(מוסתר)</span>}
              </span>
              <span className="text-xs text-qf-mute tnum shrink-0">{formatPrice(item.basePrice)}</span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-xs text-qf-mute text-center py-3">לא נמצאו מנות</div>
        )}
      </div>
    </div>
  );
}
