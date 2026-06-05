"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IcoPlus, IcoClose, IcoChev } from "@/components/shared/Icons";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Toast, type ToastState, type ToastKind } from "@/components/shared/Toast";
import { DragList, DragHandle } from "@/components/shared/DragList";
import { MiniImagePicker } from "@/components/shared/MiniImagePicker";
import { PageHeader } from "@/components/merchant/v2/PageHeader";
import { cn } from "@/lib/cn";

interface SetOption {
  name: string;
  priceDelta: number;
  isDefault: boolean;
  available: boolean;
  imageUrl: string | null;
}

interface ModifierSet {
  id: string;
  name: string;
  type: "single" | "multi";
  required: boolean;
  minSelect: number;
  maxSelect: number;
  includedFree: number;
  helpText: string | null;
  allowHalf: boolean;
  maxPerSide: number | null;
  position: number;
  attachedCount: number;
  options: SetOption[];
}

interface NewModifierSet extends Omit<ModifierSet, "id" | "attachedCount"> {
  id: null;
  attachedCount: 0;
}

type EditingSet = ModifierSet | NewModifierSet;

const EMPTY: NewModifierSet = {
  id: null,
  name: "תוספות חדשות",
  type: "multi",
  required: false,
  minSelect: 0,
  maxSelect: 5,
  includedFree: 0,
  helpText: null,
  allowHalf: false,
  maxPerSide: null,
  position: 0,
  attachedCount: 0,
  options: [],
};

export function ModifiersManager({ initialSets }: { initialSets: ModifierSet[] }) {
  const router = useRouter();
  const [sets, setSets] = useState(initialSets);
  const [editing, setEditing] = useState<EditingSet | null>(null);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ModifierSet | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  function pushToast(kind: ToastKind, message: string) {
    setToast({ id: Date.now(), kind, message });
  }

  function startNew() {
    setEditing({ ...EMPTY, position: sets.length });
  }

  function startEdit(s: ModifierSet) {
    setEditing({ ...s, options: s.options.map((o) => ({ ...o })) });
  }

  async function save() {
    if (!editing) return;
    setError(null);
    const payload = {
      name: editing.name,
      type: editing.type,
      required: editing.required,
      min_select: editing.minSelect,
      max_select: editing.maxSelect,
      included_free: editing.includedFree,
      help_text: editing.helpText,
      allow_half: editing.allowHalf,
      max_per_side: editing.maxPerSide,
      position: editing.position,
      options: editing.options.map((o) => ({
        name: o.name,
        price_delta: o.priceDelta,
        is_default: o.isDefault,
        available: o.available,
        image_url: o.imageUrl,
      })),
    };
    const url = editing.id
      ? `/api/v1/merchant/menu/modifier-sets/${editing.id}`
      : `/api/v1/merchant/menu/modifier-sets`;
    const method = editing.id ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) {
      setError(result.error?.message ?? "שמירה נכשלה");
      return;
    }
    const savedId: string = result.set?.id ?? editing.id;
    const savedSet: ModifierSet = {
      id: savedId,
      name: editing.name,
      type: editing.type,
      required: editing.required,
      minSelect: editing.minSelect,
      maxSelect: editing.maxSelect,
      includedFree: editing.includedFree,
      helpText: editing.helpText,
      allowHalf: editing.allowHalf,
      maxPerSide: editing.maxPerSide,
      position: editing.position,
      attachedCount: editing.id ? editing.attachedCount : 0,
      options: editing.options.map((o) => ({ ...o })),
    };
    setSets((prev) =>
      editing.id
        ? prev.map((s) => (s.id === editing.id ? savedSet : s))
        : [...prev, savedSet],
    );
    setEditing(null);
    pushToast("ok", editing.id ? "הקטלוג עודכן" : "הקטלוג נוצר");
    startTransition(() => router.refresh());
  }

  async function performDelete() {
    if (!confirmDelete) return;
    const res = await fetch(`/api/v1/merchant/menu/modifier-sets/${confirmDelete.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      pushToast("err", body?.error?.message ?? "מחיקה נכשלה");
      setConfirmDelete(null);
      return;
    }
    const deletedId = confirmDelete.id;
    setSets((prev) => prev.filter((s) => s.id !== deletedId));
    pushToast("ok", "הקטלוג נמחק");
    setConfirmDelete(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-5">
      <PageHeader
        chip="קטלוג"
        title={
          <span className="flex items-center gap-3">
            <Link
              href="/dashboard/menu"
              className="w-9 h-9 rounded-xl bg-white border-2 border-black grid place-items-center shadow-[0_2px_0_#000] hover:bg-black/5 transition"
              aria-label="חזרה לתפריט"
            >
              <IcoChev s={18} />
            </Link>
            <span>קטלוג תוספות</span>
          </span>
        }
        subtitle="קבוצות לשימוש חוזר - צור פעם אחת, שייך לעשרות פריטים, שינוי מתעדכן בכולם"
        actions={
          !editing ? (
            <button
              type="button"
              onClick={startNew}
              className="px-4 py-2 rounded-xl bg-black text-[#F8CB1E] border-2 border-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/90 inline-flex items-center gap-1"
            >
              <IcoPlus c="#F8CB1E" s={14} /> קטלוג חדש
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
        <SetEditor
          set={editing}
          onChange={setEditing}
          onCancel={() => {
            setEditing(null);
            setError(null);
          }}
          onSave={save}
        />
      )}

      {!editing && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sets.length === 0 && (
            <div className="col-span-full text-center py-14 bg-white border-2 border-dashed border-qf-line-dash rounded-2xl px-6">
              <div className="text-base font-semibold text-qf-ink mb-1">
                אין קטלוגים עדיין
              </div>
              <p className="text-sm text-qf-mute max-w-md mx-auto leading-snug">
                צור פעם אחת קבוצת תוספות (לדוגמה: ׳תוספות פיצה׳ עם 12 אפשרויות), ושייך אותה
                לכל המנות הרלוונטיות. שינוי במחיר תוספת מתעדכן בכל הפריטים בו-זמנית.
              </p>
              <button
                type="button"
                onClick={startNew}
                className="mt-4 inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium"
              >
                <IcoPlus c="white" s={14} /> צור את הקטלוג הראשון
              </button>
            </div>
          )}
          {sets.map((s) => (
            <article
              key={s.id}
              className="bg-white border border-qf-line-dash rounded-2xl p-4 space-y-2"
            >
              <header className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-semibold truncate">{s.name}</h3>
                    {s.required && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap bg-qf-tomato text-white"
                        title="הלקוח חייב לבחור מקבוצה זו"
                      >
                        חובה
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-qf-mute">
                    {s.type === "single" ? "בחירה יחידה" : `בחירה מרובה (מקס׳ ${s.maxSelect})`}
                    {s.includedFree > 0 && ` · ${s.includedFree} כלולים`}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap",
                    s.attachedCount > 0
                      ? "bg-qf-green-soft text-qf-green-deep"
                      : "bg-qf-line-soft text-qf-mute",
                  )}
                  title="מספר פריטים שמשתמשים בקטלוג הזה"
                >
                  {s.attachedCount} פריטים
                </span>
              </header>
              {s.helpText && (
                <p className="text-xs text-qf-mute leading-snug line-clamp-2">{s.helpText}</p>
              )}
              <div className="flex flex-wrap gap-1">
                {s.options.slice(0, 6).map((o, i) => (
                  <span
                    key={i}
                    className={cn(
                      "text-[11px] px-2 py-0.5 rounded-md",
                      o.available
                        ? "bg-qf-line-soft text-qf-ink2"
                        : "bg-qf-tomato-soft/40 text-qf-tomato line-through",
                    )}
                  >
                    {o.name}
                    {o.priceDelta !== 0 && (
                      <span className="text-qf-mute ms-1 tnum">
                        {o.priceDelta > 0 ? `+₪${o.priceDelta}` : `-₪${Math.abs(o.priceDelta)}`}
                      </span>
                    )}
                  </span>
                ))}
                {s.options.length > 6 && (
                  <span className="text-[11px] text-qf-mute px-1">+{s.options.length - 6}</span>
                )}
                {s.options.length === 0 && (
                  <span className="text-[11px] text-qf-mute italic">אין אפשרויות</span>
                )}
              </div>
              <footer className="flex justify-end gap-2 pt-2 border-t border-qf-line-soft">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(s)}
                  disabled={s.attachedCount > 0}
                  className="text-xs text-qf-tomato hover:underline disabled:opacity-40 disabled:no-underline"
                  title={
                    s.attachedCount > 0
                      ? "נתק את הקטלוג מכל הפריטים לפני המחיקה"
                      : undefined
                  }
                >
                  מחק
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(s)}
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
        title="מחיקת קטלוג"
        message={
          <>
            הקטלוג <span className="font-semibold">&quot;{confirmDelete?.name}&quot;</span> יימחק. פעולה זו לא ניתנת לביטול.
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

function SetEditor({
  set,
  onChange,
  onCancel,
  onSave,
}: {
  set: EditingSet;
  onChange: (s: EditingSet) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const isMulti = set.type === "multi";
  return (
    <section className="bg-white rounded-2xl border border-qf-line-dash p-5 space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="font-semibold">
          {set.id ? "עריכת קטלוג" : "קטלוג חדש"}
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-white border-2 border-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/5"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={onSave}
            className="px-4 py-2 rounded-xl bg-black text-[#F8CB1E] border-2 border-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/90"
          >
            שמור קטלוג
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">שם הקטלוג</span>
          <input
            value={set.name}
            onChange={(e) => onChange({ ...set, name: e.target.value })}
            className="px-3 py-2 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
            placeholder="למשל: תוספות פיצה"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">סוג בחירה</span>
          <select
            value={set.type}
            onChange={(e) => {
              const type = e.target.value as "single" | "multi";
              if (type === "single") {
                onChange({
                  ...set,
                  type,
                  maxSelect: 1,
                  minSelect: set.required ? 1 : 0,
                  includedFree: 0,
                  allowHalf: false,
                  maxPerSide: null,
                });
              } else {
                onChange({ ...set, type });
              }
            }}
            className="px-3 py-2 rounded-xl border border-qf-line-dash bg-white focus:border-(--qf-primary) outline-none"
          >
            <option value="single">בחירה יחידה (למשל: סוג בצק)</option>
            <option value="multi">בחירה מרובה (למשל: תוספות)</option>
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={set.required}
          onChange={(e) => onChange({ ...set, required: e.target.checked })}
        />
        <span>חובה לבחור - הלקוח לא יוכל להזמין בלי לבחור</span>
      </label>

      {isMulti && (
        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-qf-mute">מינ׳ בחירות</span>
            <input
              type="number"
              min={0}
              value={set.minSelect}
              onChange={(e) =>
                onChange({ ...set, minSelect: Math.max(0, parseInt(e.target.value, 10) || 0) })
              }
              className="px-2.5 py-1.5 rounded-lg border border-qf-line-dash bg-white tnum"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-qf-mute">מקס׳ בחירות</span>
            <input
              type="number"
              min={1}
              value={set.maxSelect}
              onChange={(e) =>
                onChange({ ...set, maxSelect: Math.max(1, parseInt(e.target.value, 10) || 1) })
              }
              className="px-2.5 py-1.5 rounded-lg border border-qf-line-dash bg-white tnum"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-qf-mute" title="כמה תוספות כלולות במחיר לפני שמחייבים">
              כלולות חינם
            </span>
            <input
              type="number"
              min={0}
              value={set.includedFree}
              onChange={(e) =>
                onChange({ ...set, includedFree: Math.max(0, parseInt(e.target.value, 10) || 0) })
              }
              className="px-2.5 py-1.5 rounded-lg border border-qf-line-dash bg-white tnum"
            />
          </label>
        </div>
      )}

      {isMulti && (
        <div className="rounded-xl bg-qf-line-soft/40 border border-qf-line-dash p-3 space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={set.allowHalf}
              onChange={(e) =>
                onChange({
                  ...set,
                  allowHalf: e.target.checked,
                  maxPerSide: e.target.checked ? set.maxPerSide : null,
                })
              }
            />
            <span>חצי/חצי - לקוח יכול לבחור כל תוספת לחצי בלבד (פיצה ועוד)</span>
          </label>
          {set.allowHalf && (
            <label className="flex flex-col gap-1 text-xs max-w-xs">
              <span className="text-qf-mute" title="כמה תוספות מותר לבחור על כל חצי. 'שלם' נספרת בשני הצדדים. ריק = ללא הגבלה לפי צד.">
                מקסימום תוספות לצד (אופציונלי)
              </span>
              <input
                type="number"
                min={1}
                placeholder="ללא הגבלה לפי צד"
                value={set.maxPerSide ?? ""}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  const parsed = raw === "" ? null : Math.max(1, parseInt(raw, 10) || 1);
                  onChange({ ...set, maxPerSide: parsed });
                }}
                className="px-2.5 py-1.5 rounded-lg border border-qf-line-dash bg-white tnum"
              />
            </label>
          )}
          {set.attachedCount > 0 && (
            <p className="text-[11px] text-qf-mute">
              שינוי כאן יחול אוטומטית על {set.attachedCount} הפריטים שמחוברים לקטלוג.
            </p>
          )}
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">טקסט עזר ללקוח (אופציונלי)</span>
        <textarea
          value={set.helpText ?? ""}
          onChange={(e) => onChange({ ...set, helpText: e.target.value || null })}
          rows={2}
          maxLength={200}
          placeholder="למשל: ׳3 תוספות חינם, כל תוספת נוספת בתשלום׳"
          className="px-3 py-2 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-sm resize-none"
        />
      </label>

      <div className="border-t border-qf-line-soft pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">אפשרויות בקטלוג</h3>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...set,
                options: [
                  ...set.options,
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
            className="text-xs text-(--qf-deep) inline-flex items-center gap-1 font-medium"
          >
            <IcoPlus c="var(--qf-deep)" s={12} /> אפשרות
          </button>
        </div>
        {set.options.length === 0 ? (
          <p className="text-xs text-qf-mute italic">הוסף לפחות אפשרות אחת.</p>
        ) : (
          <DragList
            items={set.options}
            onReorder={(next) => onChange({ ...set, options: next })}
            className="space-y-1.5"
          >
            {(o, oi, drag) => (
              <div className="flex items-center gap-2">
                <span
                  {...drag.handleProps}
                  className="grid place-items-center w-5 h-8 rounded-md hover:bg-qf-line-soft cursor-grab active:cursor-grabbing shrink-0"
                >
                  <DragHandle />
                </span>
                <MiniImagePicker
                  value={o.imageUrl}
                  onChange={(url) =>
                    onChange({
                      ...set,
                      options: set.options.map((x, i) =>
                        i === oi ? { ...x, imageUrl: url } : x,
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
                      ...set,
                      options: set.options.map((x, i) =>
                        i === oi ? { ...x, name: e.target.value } : x,
                      ),
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
                      ...set,
                      options: set.options.map((x, i) =>
                        i === oi ? { ...x, priceDelta: parseInt(e.target.value, 10) || 0 } : x,
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
                    type={set.type === "single" ? "radio" : "checkbox"}
                    name="default-opt"
                    checked={o.isDefault}
                    onChange={(e) =>
                      onChange({
                        ...set,
                        options:
                          set.type === "single"
                            ? set.options.map((x, i) => ({ ...x, isDefault: i === oi }))
                            : set.options.map((x, i) =>
                                i === oi ? { ...x, isDefault: e.target.checked } : x,
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
                      ...set,
                      options: set.options.map((x, i) =>
                        i === oi ? { ...x, available: !x.available } : x,
                      ),
                    })
                  }
                  className={cn(
                    "text-[10px] font-semibold px-2 py-1 rounded-md transition shrink-0",
                    o.available
                      ? "bg-qf-green-soft text-qf-green-deep"
                      : "bg-qf-tomato-soft text-qf-tomato",
                  )}
                  title={o.available ? "זמין - לחץ לסמן כאזל" : "אזל - לחץ להחזיר לזמין"}
                >
                  {o.available ? "זמין" : "אזל"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...set,
                      options: set.options.filter((_, i) => i !== oi),
                    })
                  }
                  className="w-8 h-8 rounded-lg hover:bg-qf-tomato-soft text-qf-mute hover:text-qf-tomato grid place-items-center shrink-0"
                  aria-label="הסר"
                >
                  <IcoClose s={12} />
                </button>
              </div>
            )}
          </DragList>
        )}
      </div>
    </section>
  );
}
