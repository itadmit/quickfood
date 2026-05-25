"use client";

import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useRouter } from "next/navigation";
import { IcoChev, IcoPlus, IcoClose, IcoCheck } from "@/components/shared/Icons";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { MiniImagePicker } from "@/components/shared/MiniImagePicker";
import { DragList, DragHandle } from "@/components/shared/DragList";
import { PageHeader } from "@/components/merchant/v2/PageHeader";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
import { Toggle } from "@/components/shared/Toggle";
import { ALL_TAG_LABELS } from "@/lib/dietary-tags";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

interface Category {
  id: string;
  name: string;
}

interface Size {
  code: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
}

interface Option {
  name: string;
  priceDelta: number;
  isDefault: boolean;
  available: boolean;
  imageUrl: string | null;
}

interface OptionGroup {
  name: string;
  type: "single" | "multi";
  required: boolean;
  minSelect: number;
  maxSelect: number;
  includedFree: number;
  helpText: string | null;
  templateSetId: string | null;
  options: Option[];
}

export interface ModifierSetSummary {
  id: string;
  name: string;
  type: "single" | "multi";
  optionsCount: number;
  options?: { name: string; priceDelta: number }[];
}

interface ItemData {
  id?: string;
  name: string;
  description: string;
  categoryId: string;
  basePrice: number;
  prepMinutes: number;
  artType: string | null;
  imageUrl: string | null;
  images: string[];
  available: boolean;
  tags: string[];
  sku: string | null;
  sizes: Size[];
  optionGroups: OptionGroup[];
  availableFrom: number | null;
  availableTo: number | null;
  availableDays: number | null;
  stockRemaining: number | null;
}

const TAGS = ALL_TAG_LABELS;

const EMPTY_ITEM: ItemData = {
  name: "",
  description: "",
  categoryId: "",
  basePrice: 50,
  prepMinutes: 10,
  artType: null,
  imageUrl: null,
  images: [],
  available: true,
  tags: [],
  sku: null,
  sizes: [],
  optionGroups: [],
  availableFrom: null,
  availableTo: null,
  availableDays: null,
  stockRemaining: null,
};

// Hebrew weekday names indexed by JavaScript getDay() (0 = Sunday). Used by
// the availability windowing UI's weekday-bitmask checkboxes.
const HEBREW_DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"] as const;

function minutesToHM(min: number | null): string {
  if (min === null || min === undefined) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function hmToMinutes(hm: string): number | null {
  if (!hm) return null;
  const [h, m] = hm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

export function ItemEditor({
  mode,
  categories,
  item,
  businessType = "general",
  modifierSets = [],
}: {
  mode: "new" | "edit";
  categories: Category[];
  item?: ItemData;
  businessType?: BusinessType;
  modifierSets?: ModifierSetSummary[];
}) {
  const router = useRouter();
  const [data, setData] = useState<ItemData>(item ?? { ...EMPTY_ITEM, categoryId: categories[0]?.id ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function update<K extends keyof ItemData>(k: K, v: ItemData[K]) {
    setData((d) => ({ ...d, [k]: v }));
  }

  function toggleTag(t: string) {
    setData((d) => ({
      ...d,
      tags: d.tags.includes(t) ? d.tags.filter((x) => x !== t) : [...d.tags, t],
    }));
  }

  function addSize() {
    setData((d) => ({
      ...d,
      sizes: [...d.sizes, { code: `S${d.sizes.length + 1}`, name: "גודל חדש", priceDelta: 0, isDefault: d.sizes.length === 0 }],
    }));
  }

  function removeSize(i: number) {
    setData((d) => ({ ...d, sizes: d.sizes.filter((_, idx) => idx !== i) }));
  }

  function addGroup() {
    setData((d) => ({
      ...d,
      optionGroups: [
        ...d.optionGroups,
        {
          name: "קבוצה חדשה",
          type: "multi",
          required: false,
          minSelect: 0,
          maxSelect: 5,
          includedFree: 0,
          helpText: null,
          templateSetId: null,
          options: [],
        },
      ],
    }));
  }

  function attachSet(setId: string) {
    const set = modifierSets.find((s) => s.id === setId);
    if (!set) return;
    setData((d) => ({
      ...d,
      optionGroups: [
        ...d.optionGroups,
        {
          name: set.name,
          type: set.type,
          required: false,
          minSelect: 0,
          maxSelect: 5,
          includedFree: 0,
          helpText: null,
          templateSetId: set.id,
          options: [],
        },
      ],
    }));
  }

  function removeGroup(i: number) {
    setData((d) => ({ ...d, optionGroups: d.optionGroups.filter((_, idx) => idx !== i) }));
  }

  async function save() {
    if (!data.name || !data.categoryId || data.basePrice < 0) {
      setError("חובה: שם, קטגוריה, ומחיר תקין");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name: data.name,
        description: data.description,
        category_id: data.categoryId,
        base_price: data.basePrice,
        prep_minutes: data.prepMinutes,
        art_type: data.artType ?? undefined,
        image_url: data.imageUrl ?? undefined,
        images: data.images,
        available: data.available,
        tags: data.tags,
        position: 0,
        sku: data.sku ?? undefined,
        available_from: data.availableFrom,
        available_to: data.availableTo,
        available_days: data.availableDays,
        stock_remaining: data.stockRemaining,
        sizes: data.sizes.map((s) => ({
          code: s.code,
          name: s.name,
          price_delta: s.priceDelta,
          is_default: s.isDefault,
        })),
        option_groups: data.optionGroups.map((g) => ({
          name: g.name,
          type: g.type,
          required: g.required,
          min_select: g.minSelect,
          max_select: g.maxSelect,
          included_free: g.includedFree,
          help_text: g.helpText,
          template_set_id: g.templateSetId,
          options: g.options.map((o) => ({
            name: o.name,
            price_delta: o.priceDelta,
            is_default: o.isDefault,
            available: o.available,
            image_url: o.imageUrl,
          })),
        })),
      };
      const res = await fetch(
        mode === "edit" ? `/api/v1/merchant/menu/items/${item!.id}` : "/api/v1/merchant/menu/items",
        {
          method: mode === "edit" ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = await res.json();
      if (!res.ok) {
        setError(result.error?.message ?? "שמירה נכשלה");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      router.push("/dashboard/menu");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function performDelete() {
    if (mode !== "edit" || !item?.id) return;
    setDeleting(true);
    const res = await fetch(`/api/v1/merchant/menu/items/${item.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      setConfirmDel(false);
      router.push("/dashboard/menu");
      router.refresh();
      return;
    }
    const body = await res.json().catch(() => ({}));
    setConfirmDel(false);
    setError(body?.error?.message ?? "מחיקה נכשלה");
    // Scroll up so the merchant actually sees the error banner at the top
    // of the form (otherwise it lives off-screen on tall items).
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const [duplicating, setDuplicating] = useState(false);
  async function duplicate() {
    if (mode !== "edit" || !item?.id) return;
    setDuplicating(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/merchant/menu/items/${item.id}/duplicate`, {
        method: "POST",
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error?.message ?? "שכפול נכשל");
        return;
      }
      router.push(`/dashboard/menu/${result.item.id}`);
      router.refresh();
    } finally {
      setDuplicating(false);
    }
  }

  return (
    <div className="space-y-5 pb-28 lg:pb-0">
      {/* Header — on mobile we drop the "save" button (it lives in the
          sticky bottom bar instead) and only keep back + title + the
          destructive/secondary actions, so 3 buttons don't elbow the
          title into ellipsis. */}
      <PageHeader
        chip="קטלוג"
        title={
          <span className="flex items-center gap-3 min-w-0">
            <Link
              href="/dashboard/menu"
              className="w-9 h-9 rounded-xl bg-white border-2 border-black grid place-items-center shrink-0 shadow-[0_2px_0_#000] hover:bg-black/5 transition"
              aria-label="חזרה"
            >
              <IcoChev s={18} />
            </Link>
            <span className="truncate">{mode === "edit" ? "עריכת פריט" : "פריט חדש"}</span>
          </span>
        }
        subtitle={data.name || "ללא שם"}
        actions={
          <>
            {mode === "edit" && (
              <>
                <button
                  type="button"
                  onClick={duplicate}
                  disabled={duplicating}
                  className="px-3 py-2 rounded-xl bg-white border-2 border-black text-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/5 disabled:opacity-60"
                >
                  {duplicating ? "..." : "שכפל"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDel(true)}
                  className="px-3 py-2 rounded-xl bg-white border-2 border-qf-tomato text-qf-tomato font-bold text-sm shadow-[0_2px_0_#c2421f] hover:bg-qf-tomato-soft"
                >
                  מחק
                </button>
              </>
            )}
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="hidden lg:inline-flex px-4 py-2 rounded-xl bg-black text-[#F8CB1E] border-2 border-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/90 disabled:opacity-60"
            >
              {busy ? "שומר..." : "שמירת שינויים"}
            </button>
          </>
        }
      />

      {error && (
        <div className="bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato text-sm rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
        <div className="space-y-5">
          {/* Basics */}
          <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-3">
            <h2 className="font-semibold">פרטים בסיסיים</h2>
            <Field label="שם הפריט" required>
              <input
                value={data.name}
                onChange={(e) => update("name", e.target.value)}
                aria-required="true"
                className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-base lg:text-sm"
              />
            </Field>
            <Field label="קטגוריה" required>
              {categories.length === 0 ? (
                <Link
                  href="/dashboard/menu"
                  className="block w-full px-3.5 py-2.5 rounded-xl border border-qf-tomato/40 bg-qf-tomato-soft text-qf-tomato text-sm"
                >
                  אין קטגוריות עדיין — פתח קטגוריה לפני שמירה
                </Link>
              ) : (
                <select
                  value={data.categoryId}
                  onChange={(e) => update("categoryId", e.target.value)}
                  aria-required="true"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-base lg:text-sm"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="תיאור">
              <textarea
                value={data.description}
                onChange={(e) => update("description", e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-base lg:text-sm"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="מחיר בסיס">
                <div className="flex items-center border border-qf-line-dash rounded-xl focus-within:border-(--qf-primary)">
                  <span className="px-3 text-qf-mute">₪</span>
                  <input
                    type="number"
                    min={0}
                    value={data.basePrice}
                    onChange={(e) => update("basePrice", parseInt(e.target.value, 10) || 0)}
                    className="flex-1 py-2.5 outline-none bg-transparent tnum text-base lg:text-sm"
                  />
                </div>
              </Field>
              <Field label="זמן הכנה (דקות)">
                <input
                  type="number"
                  min={0}
                  value={data.prepMinutes}
                  onChange={(e) => update("prepMinutes", parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none tnum text-base lg:text-sm"
                />
              </Field>
            </div>
            <Field label="זמינות">
              <Toggle
                checked={data.available}
                onChange={(next) => update("available", next)}
                aria-label="זמינות פריט"
              />
            </Field>
          </section>

          {/* Images */}
          <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-3">
            <h2 className="font-semibold">תמונות המוצר</h2>
            <p className="text-xs text-qf-mute">
              העלה תמונה אחת או יותר. אם לא תעלה — יוצג פלייסהולדר מותאם לסוג העסק שלך.
            </p>
            <ImageUploader
              type="menu_item_image"
              value={data.images}
              onChange={(next) => update("images", next)}
              multiple
              max={5}
            />
          </section>

          {/* Sizes */}
          <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-3">
            <header className="flex items-center justify-between">
              <h2 className="font-semibold">גדלים</h2>
              <button
                type="button"
                onClick={addSize}
                className="text-(--qf-deep) text-sm inline-flex items-center gap-1"
              >
                <IcoPlus c="var(--qf-deep)" s={14} /> הוסף גודל
              </button>
            </header>
            {data.sizes.length === 0 ? (
              <div className="text-xs text-qf-mute">לא מוגדרים גדלים</div>
            ) : (
              <DragList
                items={data.sizes}
                onReorder={(next) => setData((d) => ({ ...d, sizes: next }))}
                className="space-y-2"
              >
                {(s, i, drag) => (
                  // Each size is its own bordered card. Top row carries the
                  // name (the customer-facing label, which gets the most
                  // room); the secondary fields (short code, price delta,
                  // default radio) live in a 3-col grid below WITH LABELS so
                  // a merchant on a 390px phone can tell what each tiny
                  // input is for.
                  <div className="border border-qf-line-soft bg-qf-bg/40 rounded-xl p-3 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        {...drag.handleProps}
                        className="grid place-items-center w-7 h-9 rounded-md hover:bg-qf-line-dash/60 cursor-grab active:cursor-grabbing shrink-0"
                        aria-label="גרור לסידור"
                      >
                        <DragHandle />
                      </span>
                      <input
                        value={s.name}
                        onChange={(e) =>
                          setData((d) => ({
                            ...d,
                            sizes: d.sizes.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)),
                          }))
                        }
                        placeholder="שם הגודל (למשל: משפחתית 32 ס״מ)"
                        className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-qf-line-dash bg-white text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeSize(i)}
                        className="w-9 h-9 rounded-md hover:bg-qf-tomato-soft text-qf-mute hover:text-qf-tomato grid place-items-center shrink-0"
                        aria-label="הסר גודל"
                      >
                        <IcoClose s={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-medium text-qf-mute">קוד</span>
                        <input
                          value={s.code}
                          onChange={(e) =>
                            setData((d) => ({
                              ...d,
                              sizes: d.sizes.map((x, idx) => (idx === i ? { ...x, code: e.target.value.toUpperCase() } : x)),
                            }))
                          }
                          maxLength={4}
                          placeholder="S"
                          dir="ltr"
                          className="px-2 py-1.5 rounded-lg border border-qf-line-dash bg-white text-center text-sm tnum"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-medium text-qf-mute">הפרש מחיר (₪)</span>
                        <input
                          type="number"
                          value={s.priceDelta}
                          onChange={(e) =>
                            setData((d) => ({
                              ...d,
                              sizes: d.sizes.map((x, idx) => (idx === i ? { ...x, priceDelta: parseInt(e.target.value, 10) || 0 } : x)),
                            }))
                          }
                          className="px-2 py-1.5 rounded-lg border border-qf-line-dash bg-white text-center text-sm tnum"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-medium text-qf-mute">ברירת מחדל</span>
                        <button
                          type="button"
                          onClick={() =>
                            setData((d) => ({
                              ...d,
                              sizes: d.sizes.map((x, idx) => ({ ...x, isDefault: idx === i })),
                            }))
                          }
                          className={cn(
                            "px-2 py-1.5 rounded-lg border text-xs font-semibold transition",
                            s.isDefault
                              ? "bg-(--qf-primary) text-white border-(--qf-primary)"
                              : "bg-white text-qf-mute border-qf-line-dash hover:border-qf-mute",
                          )}
                        >
                          {s.isDefault ? "כן" : "לא"}
                        </button>
                      </label>
                    </div>
                  </div>
                )}
              </DragList>
            )}
          </section>

          {/* Option groups */}
          <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-3">
            <header className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="font-semibold">קבוצות אפשרויות</h2>
              <div className="flex items-center gap-2">
                {modifierSets.length > 0 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        attachSet(e.target.value);
                        e.target.value = "";
                      }
                    }}
                    value=""
                    className="px-2.5 py-1.5 rounded-lg border border-qf-line-dash text-sm bg-white text-(--qf-deep)"
                  >
                    <option value="">+ מקטלוג…</option>
                    {modifierSets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.optionsCount})
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={addGroup}
                  className="text-(--qf-deep) text-sm inline-flex items-center gap-1"
                >
                  <IcoPlus c="var(--qf-deep)" s={14} /> קבוצה חדשה
                </button>
              </div>
            </header>
            {modifierSets.length === 0 && (
              <p className="text-xs text-qf-mute leading-snug">
                טיפ: יצרת תפריט גדול? פתח <Link href="/dashboard/menu/modifiers" className="underline">קטלוג תוספות</Link> פעם
                אחת ושייך אותו לעשרות פריטים — עורכים במקום אחד, מתעדכן בכל הפריטים.
              </p>
            )}
            <DragList
              items={data.optionGroups}
              onReorder={(next) => setData((d) => ({ ...d, optionGroups: next }))}
              className="space-y-3"
            >
              {(g, gi, drag) => (
                <GroupEditor
                  group={g}
                  dragHandleProps={drag.handleProps}
                  templateSet={
                    g.templateSetId
                      ? modifierSets.find((s) => s.id === g.templateSetId) ?? null
                      : null
                  }
                  onChange={(next) =>
                    setData((d) => ({
                      ...d,
                      optionGroups: d.optionGroups.map((x, idx) => (idx === gi ? next : x)),
                    }))
                  }
                  onRemove={() => removeGroup(gi)}
                />
              )}
            </DragList>
          </section>

          {/* Tags */}
          <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-3">
            <h2 className="font-semibold">תגיות</h2>
            <div className="flex flex-wrap gap-1.5">
              {TAGS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTag(t)}
                  className={cn(
                    "px-2.5 py-1.5 rounded-full text-xs border transition",
                    data.tags.includes(t)
                      ? "bg-(--qf-primary) text-white border-transparent"
                      : "bg-white border-qf-line-dash text-qf-ink2",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </section>

          {/* Availability windowing — when does this item appear on the
              storefront. Time + weekdays + stock. NULL on all = always. */}
          <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-4">
            <header>
              <h2 className="font-semibold">זמינות מתקדמת</h2>
              <p className="text-xs text-qf-mute mt-0.5">
                הצג את הפריט רק בחלון שעות מסוים (לדוגמה ארוחת בוקר עד 11:00), רק בימים מסוימים, או מוגבל ב-X מנות בלבד.
              </p>
            </header>
            {/* Time-of-day window. Both ends NULL → no restriction; we show
                an explicit pill so the merchant sees the current state at a
                glance, plus a "אפס" link when a window is set. Native time
                inputs on iOS Safari can look thin/empty until tapped — the
                pill makes the intent ("zone of activity") obvious. */}
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-sm font-medium">חלון שעות</span>
                <span
                  className={cn(
                    "text-[11px] font-semibold px-2 py-0.5 rounded-md",
                    data.availableFrom === null && data.availableTo === null
                      ? "bg-qf-green-soft text-qf-green-deep"
                      : "bg-qf-yolk-soft text-qf-ink",
                  )}
                >
                  {data.availableFrom === null && data.availableTo === null
                    ? "תמיד זמין"
                    : `${minutesToHM(data.availableFrom) || "—"} → ${minutesToHM(data.availableTo) || "—"}`}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-qf-mute">משעה</span>
                  <input
                    type="time"
                    value={minutesToHM(data.availableFrom)}
                    onChange={(e) => update("availableFrom", hmToMinutes(e.target.value))}
                    className="px-3 py-2.5 rounded-xl border border-qf-line-dash bg-white focus:border-(--qf-primary) outline-none tnum text-base lg:text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-qf-mute">עד שעה</span>
                  <input
                    type="time"
                    value={minutesToHM(data.availableTo)}
                    onChange={(e) => update("availableTo", hmToMinutes(e.target.value))}
                    className="px-3 py-2.5 rounded-xl border border-qf-line-dash bg-white focus:border-(--qf-primary) outline-none tnum text-base lg:text-sm"
                  />
                </label>
              </div>
              {(data.availableFrom !== null || data.availableTo !== null) && (
                <button
                  type="button"
                  onClick={() => {
                    update("availableFrom", null);
                    update("availableTo", null);
                  }}
                  className="text-xs text-qf-mute hover:text-qf-ink underline mt-2 inline-block"
                >
                  אפס חלון שעות
                </button>
              )}
            </div>
            <Field label="ימים בשבוע">
              <div className="flex gap-1.5">
                {HEBREW_DAYS.map((label, i) => {
                  const mask = 1 << i;
                  // null means "every day" — treat as all on so checks reflect reality
                  const days = data.availableDays ?? 0b1111111;
                  const on = (days & mask) !== 0;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        const current = data.availableDays ?? 0b1111111;
                        const next = on ? current & ~mask : current | mask;
                        // Going back to "every day" = stash null so we don't bias toward saturday-only
                        update("availableDays", next === 0b1111111 ? null : next);
                      }}
                      className={cn(
                        "w-10 h-10 lg:w-9 lg:h-9 rounded-lg text-sm lg:text-xs font-bold transition shrink-0",
                        on
                          ? "bg-(--qf-primary) text-white"
                          : "bg-qf-line-soft text-qf-mute hover:bg-qf-line-dash/60",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {data.availableDays !== null && (
                <button
                  type="button"
                  onClick={() => update("availableDays", null)}
                  className="text-xs text-qf-mute hover:text-qf-ink underline mt-2 inline-block"
                >
                  אפס לכל הימים
                </button>
              )}
            </Field>
            <Field label="מלאי נשאר (אופציונלי)">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={data.stockRemaining ?? ""}
                  onChange={(e) =>
                    update(
                      "stockRemaining",
                      e.target.value === "" ? null : Math.max(0, parseInt(e.target.value, 10) || 0),
                    )
                  }
                  placeholder="ללא הגבלה"
                  className="w-32 px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none tnum text-base lg:text-sm"
                />
                <span className="text-xs text-qf-mute leading-snug">
                  כשהמספר מגיע ל-0 הפריט יוסתר אוטומטית מהתפריט. השאר ריק אם אין הגבלת מלאי.
                </span>
              </div>
            </Field>
          </section>
        </div>

        {/* Preview */}
        <div className="hidden lg:block sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pb-4">
          <div className="text-xs text-qf-mute mb-2 px-1">תצוגה מקדימה</div>
          <aside className="bg-white rounded-2xl border border-qf-line-dash overflow-hidden">
            {data.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.images[0]}
                alt={data.name || "פריט"}
                className="w-full h-auto block"
                loading="lazy"
              />
            ) : (
              <div className="aspect-4/3">
                <MenuItemImage
                  src={null}
                  alt={data.name || "פריט"}
                  businessType={businessType}
                  fill
                  rounded="none"
                  className="w-full h-full"
                />
              </div>
            )}
            <div className="px-4 pt-4 space-y-1">
              <div className="font-semibold text-base">{data.name || "ללא שם"}</div>
              <div className="text-xs text-qf-mute line-clamp-3">{data.description || "אין תיאור"}</div>
              <div className="font-bold tnum text-lg mt-2">{formatPrice(data.basePrice)}</div>
            </div>

            {data.sizes.length > 0 && (
              <div className="mt-4 px-4">
                <div className="border-t border-qf-line-dash pt-3 pb-1">
                  <div className="font-semibold text-sm mb-2">גודל</div>
                  <div className="space-y-0">
                    {data.sizes.map((s) => (
                      <PreviewRow
                        key={s.code}
                        radio
                        active={s.isDefault}
                        label={s.name || "—"}
                        priceLabel={
                          s.priceDelta === 0
                            ? null
                            : s.priceDelta > 0
                              ? `+${formatPrice(s.priceDelta)}`
                              : `-${formatPrice(-s.priceDelta)}`
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {data.optionGroups.length > 0 && (
              <div className="px-4">
                {data.optionGroups.map((g, gi) => {
                  const templateSet = g.templateSetId
                    ? modifierSets.find((m) => m.id === g.templateSetId)
                    : null;
                  const opts: { name: string; priceDelta: number }[] = g.templateSetId
                    ? (templateSet?.options ?? [])
                    : g.options.map((o) => ({ name: o.name, priceDelta: o.priceDelta }));
                  const subtitle = g.required
                    ? g.type === "single"
                      ? "חובה לבחור 1"
                      : g.minSelect === g.maxSelect
                        ? `חובה ${g.minSelect}`
                        : `חובה ${g.minSelect}–${g.maxSelect}`
                    : g.type === "multi"
                      ? g.includedFree > 0
                        ? `${g.includedFree} הראשונים חינם · עד ${g.maxSelect}`
                        : `אפשר לבחור עד ${g.maxSelect}`
                      : "אופציונלי";
                  return (
                    <div key={gi} className="border-t border-qf-line-dash pt-3 pb-1 mt-4 first:mt-3">
                      <div className="flex items-baseline justify-between gap-2 mb-2">
                        <span className="font-semibold text-sm truncate">
                          {g.name || "ללא שם"}
                          {g.required && <span className="text-qf-tomato ms-1">*</span>}
                        </span>
                        <span className="text-[11px] text-qf-mute shrink-0">{subtitle}</span>
                      </div>
                      {opts.length > 0 ? (
                        <div className="space-y-0">
                          {opts.map((o, oi) => (
                            <PreviewRow
                              key={oi}
                              radio={g.type === "single"}
                              active={false}
                              label={o.name || "—"}
                              priceLabel={
                                o.priceDelta === 0
                                  ? null
                                  : o.priceDelta > 0
                                    ? `+${formatPrice(o.priceDelta)}`
                                    : `-${formatPrice(-o.priceDelta)}`
                              }
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-qf-mute py-2">אין אפשרויות עדיין</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="pb-4" />
          </aside>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDel}
        title="מחיקת פריט"
        message={
          <>
            הפריט <span className="font-semibold">&quot;{data.name || "ללא שם"}&quot;</span> יימחק לצמיתות.
            פעולה זו אינה ניתנת לביטול.
          </>
        }
        confirmLabel="מחק"
        cancelLabel="ביטול"
        variant="danger"
        busy={deleting}
        onConfirm={performDelete}
        onCancel={() => setConfirmDel(false)}
      />

      {/* Mobile-only sticky save bar — Wolt-style commit affordance at the
          bottom of the viewport instead of a tiny header button. Desktop
          keeps the header save (visible from line ~360). pb safe-area on
          iPhone home-indicator handsets. */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-qf-line shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.1)]">
        <div className="max-w-3xl mx-auto px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="w-full h-14 rounded-2xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-base font-bold disabled:opacity-60 active:scale-[0.99] transition"
          >
            {busy ? "שומר..." : mode === "edit" ? "שמירת שינויים" : "צור פריט"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewRow({
  radio,
  active,
  label,
  priceLabel,
}: {
  radio?: boolean;
  active: boolean;
  label: string;
  priceLabel: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 text-sm border-b border-qf-line last:border-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className={cn(
            radio ? "rounded-full" : "rounded-md",
            "w-5 h-5 border-2 grid place-items-center shrink-0",
            active ? "border-(--qf-primary) bg-(--qf-primary)" : "border-qf-line-dash",
          )}
        >
          {active &&
            (radio ? (
              <span className="w-2 h-2 rounded-full bg-white" />
            ) : (
              <IcoCheck c="#fff" s={12} />
            ))}
        </span>
        <span className={cn("truncate", active ? "font-medium text-qf-ink" : "text-qf-ink")}>
          {label}
        </span>
      </div>
      {priceLabel && (
        <span className="text-xs tnum font-medium text-qf-mute shrink-0">{priceLabel}</span>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium block">
        {label}
        {required && <span className="text-qf-tomato ms-1" aria-hidden>*</span>}
      </label>
      {children}
    </div>
  );
}

function GroupEditor({
  group,
  templateSet,
  dragHandleProps,
  onChange,
  onRemove,
}: {
  group: OptionGroup;
  templateSet: ModifierSetSummary | null;
  dragHandleProps?: React.HTMLAttributes<HTMLElement> & {
    draggable?: boolean;
    style?: React.CSSProperties;
  };
  onChange: (g: OptionGroup) => void;
  onRemove: () => void;
}) {
  // When this group is linked to a ModifierSet, all its fields and options
  // come from the set at runtime. The merchant edits the set itself (in the
  // catalog page) — here we just show a read-only summary + offer to detach.
  if (group.templateSetId) {
    return (
      <div className="border border-(--qf-primary)/30 rounded-xl p-3 space-y-2 bg-(--qf-primary)/5">
        <div className="flex items-center gap-2 flex-wrap">
          {dragHandleProps && (
            <span
              {...dragHandleProps}
              className="grid place-items-center w-6 h-6 rounded-md hover:bg-qf-line-soft cursor-grab active:cursor-grabbing"
            >
              <DragHandle />
            </span>
          )}
          <span className="text-[10px] bg-(--qf-primary) text-white px-2 py-0.5 rounded-md font-semibold tracking-wider">
            מקטלוג
          </span>
          <div className="font-medium text-sm flex-1 min-w-0 truncate">
            {templateSet?.name ?? group.name}
          </div>
          <Link
            href="/dashboard/menu/modifiers"
            className="text-xs text-(--qf-deep) underline"
          >
            עריכה
          </Link>
          <button
            type="button"
            onClick={onRemove}
            className="w-8 h-8 rounded-lg hover:bg-qf-tomato-soft text-qf-mute hover:text-qf-tomato"
            aria-label="הסר מהמנה"
            title="הסר את הקבוצה מהמנה (לא מוחק את הקטלוג)"
          >
            <IcoClose s={14} />
          </button>
        </div>
        <p className="text-xs text-qf-mute leading-snug">
          הקבוצה הזו נשלפת מקטלוג התוספות. עריכת השם, האפשרויות והמחירים — בדף הקטלוג. כל שינוי שם
          יחול גם על שאר הפריטים שמחוברים אליה.
          {templateSet ? ` (${templateSet.optionsCount} אפשרויות)` : ""}
        </p>
      </div>
    );
  }
  return (
    <div className="border border-qf-line-dash rounded-xl p-3 space-y-3 bg-qf-line-soft/40">
      <div className="flex items-center gap-2 flex-wrap">
        {dragHandleProps && (
          <span
            {...dragHandleProps}
            className="grid place-items-center w-6 h-6 rounded-md hover:bg-qf-line-dash/60 cursor-grab active:cursor-grabbing"
          >
            <DragHandle />
          </span>
        )}
        <input
          value={group.name}
          onChange={(e) => onChange({ ...group, name: e.target.value })}
          className="flex-1 min-w-0 basis-32 px-2.5 py-1.5 rounded-lg border border-qf-line-dash text-sm bg-white"
        />
        <select
          value={group.type}
          onChange={(e) => onChange({ ...group, type: e.target.value as "single" | "multi" })}
          className="px-2.5 py-1.5 rounded-lg border border-qf-line-dash text-sm bg-white"
        >
          <option value="single">בחירה יחידה</option>
          <option value="multi">בחירה מרובה</option>
        </select>
        <label className="text-xs inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={group.required}
            onChange={(e) => onChange({ ...group, required: e.target.checked })}
          />
          חובה
        </label>
        <button
          type="button"
          onClick={onRemove}
          className="w-8 h-8 rounded-lg hover:bg-qf-tomato-soft text-qf-mute hover:text-qf-tomato"
          aria-label="הסר"
        >
          <IcoClose s={14} />
        </button>
      </div>
      {/* Limits row — only relevant for multi. min_select also matters for
          single+required (effectively 1) but we keep the UI simple. */}
      {group.type === "multi" && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <label className="flex flex-col gap-1">
            <span className="text-qf-mute">מינ׳ בחירות</span>
            <input
              type="number"
              min={0}
              value={group.minSelect}
              onChange={(e) =>
                onChange({ ...group, minSelect: Math.max(0, parseInt(e.target.value, 10) || 0) })
              }
              className="px-2.5 py-1.5 rounded-lg border border-qf-line-dash bg-white tnum text-base lg:text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-qf-mute">מקס׳ בחירות</span>
            <input
              type="number"
              min={1}
              value={group.maxSelect}
              onChange={(e) =>
                onChange({ ...group, maxSelect: Math.max(1, parseInt(e.target.value, 10) || 1) })
              }
              className="px-2.5 py-1.5 rounded-lg border border-qf-line-dash bg-white tnum text-base lg:text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-qf-mute" title="כמה בחירות כלולות במחיר לפני שמחייבים">
              כלולות חינם
            </span>
            <input
              type="number"
              min={0}
              value={group.includedFree}
              onChange={(e) =>
                onChange({ ...group, includedFree: Math.max(0, parseInt(e.target.value, 10) || 0) })
              }
              className="px-2.5 py-1.5 rounded-lg border border-qf-line-dash bg-white tnum text-base lg:text-sm"
            />
          </label>
        </div>
      )}
      <textarea
        value={group.helpText ?? ""}
        onChange={(e) => onChange({ ...group, helpText: e.target.value || null })}
        rows={1}
        maxLength={200}
        placeholder="טקסט עזר (אופציונלי) — ׳בחר רטב לצד׳"
        className="w-full px-2.5 py-1.5 rounded-lg border border-qf-line-dash text-xs bg-white resize-none"
      />
      <DragList
        items={group.options}
        onReorder={(next) => onChange({ ...group, options: next })}
        className="space-y-1.5"
      >
        {(o, oi, drag) => (
          <div className="flex items-center gap-2">
            <span
              {...drag.handleProps}
              className="grid place-items-center w-5 h-8 rounded-md hover:bg-qf-line-dash/60 cursor-grab active:cursor-grabbing shrink-0"
            >
              <DragHandle />
            </span>
            <MiniImagePicker
              value={o.imageUrl}
              onChange={(url) =>
                onChange({
                  ...group,
                  options: group.options.map((x, idx) =>
                    idx === oi ? { ...x, imageUrl: url } : x,
                  ),
                })
              }
              size={36}
              className="shrink-0"
            />
            <input
              value={o.name}
              onChange={(e) =>
                onChange({
                  ...group,
                  options: group.options.map((x, idx) => (idx === oi ? { ...x, name: e.target.value } : x)),
                })
              }
              className={cn(
                "flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-qf-line-dash text-sm bg-white",
                !o.available && "opacity-50",
              )}
            />
            <input
              type="number"
              value={o.priceDelta}
              onChange={(e) =>
                onChange({
                  ...group,
                  options: group.options.map((x, idx) =>
                    idx === oi ? { ...x, priceDelta: parseInt(e.target.value, 10) || 0 } : x,
                  ),
                })
              }
              className="w-16 px-2 py-1.5 rounded-lg border border-qf-line-dash text-sm bg-white tnum shrink-0"
              title="מחיר נוסף (₪)"
            />
            <label
              className="text-xs inline-flex items-center justify-center w-6 h-8 shrink-0"
              title="ברירת מחדל"
            >
              <input
                type={group.type === "single" ? "radio" : "checkbox"}
                name={`g-${group.name}-default`}
                checked={o.isDefault}
                onChange={(e) =>
                  onChange({
                    ...group,
                    options:
                      group.type === "single"
                        ? group.options.map((x, idx) => ({ ...x, isDefault: idx === oi }))
                        : group.options.map((x, idx) =>
                            idx === oi ? { ...x, isDefault: e.target.checked } : x,
                          ),
                  })
                }
                className="cursor-pointer"
              />
            </label>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...group,
                  options: group.options.map((x, idx) =>
                    idx === oi ? { ...x, available: !x.available } : x,
                  ),
                })
              }
              className={cn(
                "text-[10px] font-semibold px-2 py-1 rounded-md transition shrink-0",
                o.available
                  ? "bg-qf-green-soft text-qf-green-deep"
                  : "bg-qf-tomato-soft text-qf-tomato",
              )}
              title={o.available ? "זמין — לחץ כדי לסמן כאזל" : "אזל היום — לחץ להחזיר לזמין"}
            >
              {o.available ? "זמין" : "אזל"}
            </button>
            <button
              type="button"
              onClick={() =>
                onChange({ ...group, options: group.options.filter((_, idx) => idx !== oi) })
              }
              className="w-8 h-8 rounded-lg hover:bg-qf-tomato-soft text-qf-mute hover:text-qf-tomato shrink-0"
              aria-label="הסר"
            >
              <IcoClose s={12} />
            </button>
          </div>
        )}
      </DragList>
      <button
        type="button"
        onClick={() =>
          onChange({
            ...group,
            options: [
              ...group.options,
              {
                name: "אפשרות חדשה",
                priceDelta: 0,
                isDefault: false,
                available: true,
                imageUrl: null,
              },
            ],
          })
        }
        className="text-xs text-(--qf-deep) inline-flex items-center gap-1"
      >
        <IcoPlus c="var(--qf-deep)" s={12} /> אפשרות
      </button>
    </div>
  );
}
