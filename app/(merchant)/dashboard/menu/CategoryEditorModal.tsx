"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IcoClose, IcoEdit, IcoTrash, IcoPlus, IcoCheck } from "@/components/shared/Icons";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Toast, type ToastState, type ToastKind } from "@/components/shared/Toast";
import { DragList, DragHandle } from "@/components/shared/DragList";
import {
  CATEGORY_ICONS,
  CATEGORY_COLORS,
  DEFAULT_ICON,
  DEFAULT_COLOR,
  resolveCategoryStyle,
  type CategoryIconKey,
  type CategoryColorKey,
} from "@/lib/category-style";
import { cn } from "@/lib/cn";

export interface EditableCategory {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  position: number;
  upsellInCart?: boolean;
  upsellBeforeCheckout?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  categories: EditableCategory[];
}

type Draft = {
  id?: string;
  name: string;
  icon: CategoryIconKey;
  color: CategoryColorKey;
  position: number;
  upsellInCart: boolean;
  upsellBeforeCheckout: boolean;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  icon: DEFAULT_ICON,
  color: DEFAULT_COLOR,
  position: 0,
  upsellInCart: false,
  upsellBeforeCheckout: false,
};

export function CategoryEditorModal({ open, onClose, categories }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<EditableCategory | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Local draft of category order so the DragList can rearrange without
  // waiting for the SSR refresh to round-trip. Sync from props every time
  // the parent re-renders with a new list.
  const [orderedCategories, setOrderedCategories] = useState(categories);
  useEffect(() => {
    setOrderedCategories(categories);
  }, [categories]);

  function pushToast(kind: ToastKind, message: string) {
    setToast({ id: Date.now(), kind, message });
  }

  async function persistOrder(next: EditableCategory[]) {
    const prev = orderedCategories;
    setOrderedCategories(next);
    const res = await fetch("/api/v1/merchant/menu/categories/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ category_ids: next.map((c) => c.id) }),
    });
    if (!res.ok) {
      setOrderedCategories(prev);
      const body = await res.json().catch(() => ({}));
      pushToast("err", body?.error?.message ?? "שמירת הסדר נכשלה");
      return;
    }
    router.refresh();
  }

  if (!open) return null;

  function openNew() {
    setError(null);
    setEditing({
      ...EMPTY_DRAFT,
      position: orderedCategories.length,
    });
  }

  function openEdit(c: EditableCategory) {
    const style = resolveCategoryStyle(c.icon, c.color);
    setError(null);
    setEditing({
      id: c.id,
      name: c.name,
      icon: style.iconKey,
      color: style.colorKey,
      position: c.position,
      upsellInCart: c.upsellInCart ?? false,
      upsellBeforeCheckout: c.upsellBeforeCheckout ?? false,
    });
  }

  async function save() {
    if (!editing) return;
    if (!editing.name.trim()) {
      setError("נדרש שם קטגוריה");
      return;
    }
    setSaving(true);
    setError(null);
    const isCreate = !editing.id;
    const url = isCreate
      ? "/api/v1/merchant/menu/categories"
      : `/api/v1/merchant/menu/categories/${editing.id}`;
    const res = await fetch(url, {
      method: isCreate ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: editing.name.trim(),
        icon: editing.icon,
        color: editing.color,
        upsell_in_cart: editing.upsellInCart,
        upsell_before_checkout: editing.upsellBeforeCheckout,
        ...(isCreate && { position: editing.position }),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      setError(e?.error?.message ?? "שמירה נכשלה");
      return;
    }
    setEditing(null);
    router.refresh();
  }

  function startDelete(c: EditableCategory) {
    setPendingDelete(c);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const res = await fetch(`/api/v1/merchant/menu/categories/${pendingDelete.id}`, {
      method: "DELETE",
    });
    setDeleting(false);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      pushToast("err", e?.error?.message ?? "מחיקה נכשלה");
      setPendingDelete(null);
      return;
    }
    pushToast("ok", "הקטגוריה נמחקה");
    setPendingDelete(null);
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm grid place-items-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <header className="flex items-center justify-between px-5 py-4 border-b border-qf-line">
          <h2 className="font-semibold text-lg">
            {editing ? (editing.id ? "עריכת קטגוריה" : "קטגוריה חדשה") : "ניהול קטגוריות"}
          </h2>
          <button
            type="button"
            onClick={() => (editing ? setEditing(null) : onClose())}
            className="w-8 h-8 rounded-full grid place-items-center hover:bg-qf-line-soft"
            aria-label="סגור"
          >
            <IcoClose s={16} />
          </button>
        </header>

        {editing ? (
          <DraftForm
            draft={editing}
            onChange={setEditing}
            onCancel={() => setEditing(null)}
            onSave={save}
            saving={saving}
            error={error}
          />
        ) : (
          <div className="flex-1 overflow-y-auto p-3">
            {orderedCategories.length === 0 ? (
              <p className="text-center text-sm text-qf-mute py-8">אין קטגוריות עדיין</p>
            ) : (
              <DragList
                items={orderedCategories}
                onReorder={persistOrder}
                getKey={(c) => c.id}
                className="space-y-1"
              >
                {(c, _i, drag) => {
                  const style = resolveCategoryStyle(c.icon, c.color);
                  const Icon = style.Icon;
                  return (
                    <div
                      className={cn(
                        "flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-qf-line-soft/60",
                        drag.isDragging && "opacity-50",
                      )}
                    >
                      <span
                        {...drag.handleProps}
                        className="grid place-items-center w-5 h-8 rounded-md hover:bg-qf-line-soft cursor-grab active:cursor-grabbing shrink-0 text-qf-mute"
                      >
                        <DragHandle />
                      </span>
                      <div
                        className="w-10 h-10 rounded-full grid place-items-center shrink-0"
                        style={{ backgroundColor: style.bg }}
                      >
                        <Icon size={18} color={style.fg} strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 min-w-0 text-sm font-medium truncate">{c.name}</div>
                      <button
                        type="button"
                        onClick={() => openEdit(c)}
                        className="w-8 h-8 rounded-lg hover:bg-white grid place-items-center"
                        aria-label="ערוך"
                      >
                        <IcoEdit s={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => startDelete(c)}
                        className="w-8 h-8 rounded-lg hover:bg-qf-tomato-soft grid place-items-center"
                        aria-label="מחק"
                      >
                        <IcoTrash c="#c2421f" s={15} />
                      </button>
                    </div>
                  );
                }}
              </DragList>
            )}
            <button
              type="button"
              onClick={openNew}
              className="mt-3 w-full border border-dashed border-qf-line-dash rounded-xl py-3 text-sm font-medium text-qf-ink2 hover:border-(--qf-primary) hover:bg-qf-green-soft/40 inline-flex items-center justify-center gap-1.5"
            >
              <IcoPlus c="#3a4a40" s={16} />
              קטגוריה חדשה
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="מחיקת קטגוריה"
        message={
          <>
            הקטגוריה <span className="font-semibold">&quot;{pendingDelete?.name}&quot;</span> תימחק.
            פריטים שמשויכים לקטגוריה צריכים לעבור לקטגוריה אחרת לפני המחיקה.
          </>
        }
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

function DraftForm({
  draft,
  onChange,
  onCancel,
  onSave,
  saving,
  error,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
}) {
  const previewStyle = resolveCategoryStyle(draft.icon, draft.color);
  const PreviewIcon = previewStyle.Icon;

  return (
    <>
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Live preview */}
        <div className="flex flex-col items-center gap-2 py-2">
          <div
            className="w-16 h-16 rounded-full grid place-items-center"
            style={{ backgroundColor: previewStyle.bg }}
          >
            <PreviewIcon size={28} color={previewStyle.fg} strokeWidth={1.8} />
          </div>
          <div className="text-sm font-medium">{draft.name || "שם קטגוריה"}</div>
        </div>

        {/* Name */}
        <div>
          <label className="text-sm font-medium block mb-1">
            שם <span className="text-qf-tomato">*</span>
          </label>
          <input
            type="text"
            value={draft.name}
            maxLength={60}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            placeholder="למשל: קלאסיות"
            className="w-full border border-qf-line rounded-xl px-3 py-2.5 text-sm outline-none focus:border-(--qf-primary)"
          />
        </div>

        {/* Color */}
        <div>
          <label className="text-sm font-medium block mb-2">צבע</label>
          <div className="grid grid-cols-8 gap-2">
            {(Object.keys(CATEGORY_COLORS) as CategoryColorKey[]).map((key) => {
              const c = CATEGORY_COLORS[key];
              const active = draft.color === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onChange({ ...draft, color: key })}
                  aria-label={c.label}
                  aria-pressed={active}
                  className={cn(
                    "aspect-square rounded-full grid place-items-center transition relative",
                    active ? "ring-2 ring-offset-2 ring-qf-ink" : "hover:scale-110",
                  )}
                  style={{ backgroundColor: c.bg }}
                >
                  {active && <IcoCheck c={c.fg} s={14} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Icon */}
        <div>
          <label className="text-sm font-medium block mb-2">אייקון</label>
          <div className="grid grid-cols-8 gap-2">
            {(Object.keys(CATEGORY_ICONS) as CategoryIconKey[]).map((key) => {
              const I = CATEGORY_ICONS[key].Icon;
              const active = draft.icon === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onChange({ ...draft, icon: key })}
                  title={CATEGORY_ICONS[key].label}
                  aria-pressed={active}
                  className={cn(
                    "aspect-square rounded-xl grid place-items-center transition",
                    active
                      ? "bg-(--qf-primary) text-white"
                      : "bg-qf-line-soft/70 hover:bg-qf-line-soft text-qf-ink2",
                  )}
                >
                  <I size={18} strokeWidth={1.8} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Upsell toggle */}
        <label className="flex items-start justify-between gap-3 py-2 cursor-pointer">
          <div className="min-w-0">
            <div className="text-sm font-medium">הצע קטגוריה זו בעגלת הקניות (אפסייל)</div>
            <div className="text-xs text-qf-mute mt-0.5 leading-relaxed">
              הפריטים הפופולריים מהקטגוריה יופיעו כקרוסלה &quot;מומלץ עבורך&quot; בעגלת הלקוח. מתאים בעיקר למשקאות, תוספות וקינוחים.
            </div>
          </div>
          <input
            type="checkbox"
            checked={draft.upsellInCart}
            onChange={(e) => onChange({ ...draft, upsellInCart: e.target.checked })}
            className="w-5 h-5 mt-0.5 shrink-0 accent-(--qf-primary)"
          />
        </label>

        {/* Pre-checkout interstitial toggle */}
        <label className="flex items-start justify-between gap-3 py-2 cursor-pointer">
          <div className="min-w-0">
            <div className="text-sm font-medium">תזכורת לפני סגירת ההזמנה</div>
            <div className="text-xs text-qf-mute mt-0.5 leading-relaxed">
              כשהלקוח לוחץ &quot;להזמין&quot; (בקיוסק ובחנות), יפתח חלון &quot;להוסיף עוד משהו?&quot; עם פריטים מהקטגוריה הזו. מתאים במיוחד לקינוחים — הלקוח כבר התחייב, ההמלצה האחרונה הזו ממירה.
            </div>
          </div>
          <input
            type="checkbox"
            checked={draft.upsellBeforeCheckout}
            onChange={(e) => onChange({ ...draft, upsellBeforeCheckout: e.target.checked })}
            className="w-5 h-5 mt-0.5 shrink-0 accent-(--qf-primary)"
          />
        </label>

        {error && (
          <div className="text-xs bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </div>

      <footer className="flex items-center justify-end gap-2 px-5 py-4 border-t border-qf-line bg-qf-bg/40">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm text-qf-ink2 hover:bg-qf-line-soft"
        >
          חזרה
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="bg-(--qf-primary) hover:bg-(--qf-deep) text-white rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {saving ? "שומר..." : "שמור"}
        </button>
      </footer>
    </>
  );
}
