"use client";

import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useRouter } from "next/navigation";
import { IcoChev, IcoPlus, IcoClose } from "@/components/shared/Icons";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
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
}

interface OptionGroup {
  name: string;
  type: "single" | "multi";
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: Option[];
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
}

const TAGS = ["פופולרי", "צמחוני", "טבעוני", "חריפה", "חדש", "מבצע"];

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
};

export function ItemEditor({
  mode,
  categories,
  item,
  businessType = "general",
}: {
  mode: "new" | "edit";
  categories: Category[];
  item?: ItemData;
  businessType?: BusinessType;
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
        { name: "קבוצה חדשה", type: "multi", required: false, minSelect: 0, maxSelect: 5, options: [] },
      ],
    }));
  }

  function removeGroup(i: number) {
    setData((d) => ({ ...d, optionGroups: d.optionGroups.filter((_, idx) => idx !== i) }));
  }

  async function save() {
    if (!data.name || !data.categoryId || data.basePrice < 0) {
      setError("חובה: שם, קטגוריה, ומחיר תקין");
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
          options: g.options.map((o) => ({
            name: o.name,
            price_delta: o.priceDelta,
            is_default: o.isDefault,
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
    }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/menu"
            className="w-9 h-9 rounded-full border border-qf-line-dash grid place-items-center"
            aria-label="חזרה"
          >
            <IcoChev s={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{mode === "edit" ? "עריכת פריט" : "פריט חדש"}</h1>
            <p className="text-sm text-qf-mute">{data.name || "ללא שם"}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {mode === "edit" && (
            <button
              type="button"
              onClick={() => setConfirmDel(true)}
              className="px-3.5 py-2 rounded-xl border border-qf-tomato/40 text-qf-tomato hover:bg-qf-tomato-soft text-sm"
            >
              מחק
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="px-4 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-60"
          >
            {busy ? "שומר..." : "שמירת שינויים"}
          </button>
        </div>
      </header>

      {error && (
        <div className="bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato text-sm rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
        <div className="space-y-5">
          {/* Basics */}
          <section className="bg-white rounded-2xl border border-qf-line-dash p-5 space-y-3">
            <h2 className="font-semibold">פרטים בסיסיים</h2>
            <Field label="שם הפריט">
              <input
                value={data.name}
                onChange={(e) => update("name", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
              />
            </Field>
            <Field label="קטגוריה">
              <select
                value={data.categoryId}
                onChange={(e) => update("categoryId", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
              >
                {categories.length === 0 && <option value="">אין קטגוריות</option>}
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="תיאור">
              <textarea
                value={data.description}
                onChange={(e) => update("description", e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
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
                    className="flex-1 py-2.5 outline-none bg-transparent tnum"
                  />
                </div>
              </Field>
              <Field label="זמן הכנה (דקות)">
                <input
                  type="number"
                  min={0}
                  value={data.prepMinutes}
                  onChange={(e) => update("prepMinutes", parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none tnum"
                />
              </Field>
            </div>
            <Field label="זמינות">
              <button
                type="button"
                role="switch"
                aria-checked={data.available}
                onClick={() => update("available", !data.available)}
                className={cn(
                  "relative inline-flex h-6 w-11 rounded-full transition",
                  data.available ? "bg-(--qf-primary)" : "bg-qf-line-dash",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
                    data.available ? "inset-e-0.5" : "inset-s-0.5",
                  )}
                />
              </button>
            </Field>
          </section>

          {/* Images */}
          <section className="bg-white rounded-2xl border border-qf-line-dash p-5 space-y-3">
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
          <section className="bg-white rounded-2xl border border-qf-line-dash p-5 space-y-3">
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
              <div className="space-y-2">
                {data.sizes.map((s, i) => (
                  <div key={i} className="grid grid-cols-[80px_1fr_120px_80px_32px] gap-2 items-center">
                    <input
                      value={s.code}
                      onChange={(e) =>
                        setData((d) => ({
                          ...d,
                          sizes: d.sizes.map((x, idx) => (idx === i ? { ...x, code: e.target.value } : x)),
                        }))
                      }
                      placeholder="קוד"
                      maxLength={4}
                      className="px-2 py-2 rounded-lg border border-qf-line-dash text-center text-sm"
                    />
                    <input
                      value={s.name}
                      onChange={(e) =>
                        setData((d) => ({
                          ...d,
                          sizes: d.sizes.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)),
                        }))
                      }
                      placeholder="שם"
                      className="px-2.5 py-2 rounded-lg border border-qf-line-dash text-sm"
                    />
                    <input
                      type="number"
                      value={s.priceDelta}
                      onChange={(e) =>
                        setData((d) => ({
                          ...d,
                          sizes: d.sizes.map((x, idx) => (idx === i ? { ...x, priceDelta: parseInt(e.target.value, 10) || 0 } : x)),
                        }))
                      }
                      className="px-2.5 py-2 rounded-lg border border-qf-line-dash text-sm tnum"
                    />
                    <label className="text-xs inline-flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="default-size"
                        checked={s.isDefault}
                        onChange={() =>
                          setData((d) => ({
                            ...d,
                            sizes: d.sizes.map((x, idx) => ({ ...x, isDefault: idx === i })),
                          }))
                        }
                      />
                      ברירת מחדל
                    </label>
                    <button
                      type="button"
                      onClick={() => removeSize(i)}
                      className="w-8 h-8 rounded-lg hover:bg-qf-tomato-soft text-qf-mute hover:text-qf-tomato"
                      aria-label="הסר"
                    >
                      <IcoClose s={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Option groups */}
          <section className="bg-white rounded-2xl border border-qf-line-dash p-5 space-y-3">
            <header className="flex items-center justify-between">
              <h2 className="font-semibold">קבוצות אפשרויות</h2>
              <button
                type="button"
                onClick={addGroup}
                className="text-(--qf-deep) text-sm inline-flex items-center gap-1"
              >
                <IcoPlus c="var(--qf-deep)" s={14} /> הוסף קבוצה
              </button>
            </header>
            <div className="space-y-3">
              {data.optionGroups.map((g, gi) => (
                <GroupEditor
                  key={gi}
                  group={g}
                  onChange={(next) =>
                    setData((d) => ({
                      ...d,
                      optionGroups: d.optionGroups.map((x, idx) => (idx === gi ? next : x)),
                    }))
                  }
                  onRemove={() => removeGroup(gi)}
                />
              ))}
            </div>
          </section>

          {/* Tags */}
          <section className="bg-white rounded-2xl border border-qf-line-dash p-5 space-y-3">
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
        </div>

        {/* Preview */}
        <aside className="bg-white rounded-2xl border border-qf-line-dash p-4 h-fit sticky top-20">
          <div className="text-xs text-qf-mute mb-2">תצוגה מקדימה</div>
          <div className="aspect-square rounded-xl overflow-hidden">
            <MenuItemImage
              src={data.images[0]}
              alt={data.name || "פריט"}
              businessType={businessType}
              size={280}
              rounded="xl"
              className="w-full h-full"
            />
          </div>
          <div className="mt-3 space-y-1">
            <div className="font-medium">{data.name || "ללא שם"}</div>
            <div className="text-xs text-qf-mute line-clamp-3">{data.description || "אין תיאור"}</div>
            <div className="font-semibold tnum mt-2">{formatPrice(data.basePrice)}</div>
          </div>
        </aside>
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
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium block">{label}</label>
      {children}
    </div>
  );
}

function GroupEditor({
  group,
  onChange,
  onRemove,
}: {
  group: OptionGroup;
  onChange: (g: OptionGroup) => void;
  onRemove: () => void;
}) {
  return (
    <div className="border border-qf-line-dash rounded-xl p-3 space-y-3 bg-qf-line-soft/40">
      <div className="flex items-center gap-2">
        <input
          value={group.name}
          onChange={(e) => onChange({ ...group, name: e.target.value })}
          className="flex-1 px-2.5 py-1.5 rounded-lg border border-qf-line-dash text-sm bg-white"
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
        {group.type === "multi" && (
          <input
            type="number"
            min={1}
            value={group.maxSelect}
            onChange={(e) => onChange({ ...group, maxSelect: parseInt(e.target.value, 10) || 1 })}
            className="w-14 px-2 py-1.5 rounded-lg border border-qf-line-dash text-sm bg-white tnum"
            title="מקסימום"
          />
        )}
        <button
          type="button"
          onClick={onRemove}
          className="w-8 h-8 rounded-lg hover:bg-qf-tomato-soft text-qf-mute hover:text-qf-tomato"
          aria-label="הסר"
        >
          <IcoClose s={14} />
        </button>
      </div>
      <div className="space-y-1.5">
        {group.options.map((o, oi) => (
          <div key={oi} className="grid grid-cols-[1fr_100px_90px_32px] gap-2 items-center">
            <input
              value={o.name}
              onChange={(e) =>
                onChange({
                  ...group,
                  options: group.options.map((x, idx) => (idx === oi ? { ...x, name: e.target.value } : x)),
                })
              }
              className="px-2.5 py-1.5 rounded-lg border border-qf-line-dash text-sm bg-white"
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
              className="px-2.5 py-1.5 rounded-lg border border-qf-line-dash text-sm bg-white tnum"
            />
            <label className="text-xs inline-flex items-center gap-1">
              <input
                type={group.type === "single" ? "radio" : "checkbox"}
                name={`g-${group.name}`}
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
              />
              ברירת מחדל
            </label>
            <button
              type="button"
              onClick={() =>
                onChange({ ...group, options: group.options.filter((_, idx) => idx !== oi) })
              }
              className="w-8 h-8 rounded-lg hover:bg-qf-tomato-soft text-qf-mute hover:text-qf-tomato"
              aria-label="הסר"
            >
              <IcoClose s={12} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({
              ...group,
              options: [...group.options, { name: "אפשרות חדשה", priceDelta: 0, isDefault: false }],
            })
          }
          className="text-xs text-(--qf-deep) inline-flex items-center gap-1"
        >
          <IcoPlus c="var(--qf-deep)" s={12} /> אפשרות
        </button>
      </div>
    </div>
  );
}
