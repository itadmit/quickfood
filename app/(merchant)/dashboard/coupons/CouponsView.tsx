"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IcoPlus, IcoClose, IcoCheck } from "@/components/shared/Icons";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Toast, type ToastState, type ToastKind } from "@/components/shared/Toast";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/merchant/v2/PageHeader";

interface Coupon {
  id: string;
  code: string;
  description: string;
  type: "percent" | "fixed";
  value: number;
  minOrder: number | null;
  maxDiscount: number | null;
  usageLimit: number | null;
  usageCount: number;
  perCustomerLimit: number | null;
  validFrom: string;
  validUntil: string | null;
  active: boolean;
  appliesTo: "all" | "category" | "items";
  categoryId: string | null;
  itemIds: string[];
}

interface Category {
  id: string;
  name: string;
}

interface DraftCoupon {
  id: string | null;
  code: string;
  description: string;
  type: "percent" | "fixed";
  value: number;
  minOrder: string;
  maxDiscount: string;
  usageLimit: string;
  validUntil: string;
  active: boolean;
  appliesTo: "all" | "category" | "items";
  categoryId: string;
}

const EMPTY: DraftCoupon = {
  id: null,
  code: "",
  description: "",
  type: "percent",
  value: 10,
  minOrder: "",
  maxDiscount: "",
  usageLimit: "",
  validUntil: "",
  active: true,
  appliesTo: "all",
  categoryId: "",
};

export function CouponsView({
  initial,
  categories,
}: {
  initial: Coupon[];
  categories: Category[];
}) {
  const router = useRouter();
  const [list] = useState(initial);
  const [editing, setEditing] = useState<DraftCoupon | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Coupon | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  function pushToast(kind: ToastKind, message: string) {
    setToast({ id: Date.now(), kind, message });
  }

  function startNew() {
    setError(null);
    setEditing({ ...EMPTY, categoryId: categories[0]?.id ?? "" });
  }

  function startEdit(c: Coupon) {
    setError(null);
    setEditing({
      id: c.id,
      code: c.code,
      description: c.description,
      type: c.type,
      value: c.value,
      minOrder: c.minOrder?.toString() ?? "",
      maxDiscount: c.maxDiscount?.toString() ?? "",
      usageLimit: c.usageLimit?.toString() ?? "",
      validUntil: c.validUntil ? c.validUntil.slice(0, 10) : "",
      active: c.active,
      appliesTo: c.appliesTo,
      categoryId: c.categoryId ?? "",
    });
  }

  async function save() {
    if (!editing) return;
    if (!editing.code.trim()) {
      setError("חובה: קוד");
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      code: editing.code.trim().toUpperCase(),
      description: editing.description,
      type: editing.type,
      value: editing.value,
      min_order: editing.minOrder ? parseInt(editing.minOrder, 10) : null,
      max_discount: editing.maxDiscount ? parseInt(editing.maxDiscount, 10) : null,
      usage_limit: editing.usageLimit ? parseInt(editing.usageLimit, 10) : null,
      valid_until: editing.validUntil
        ? new Date(`${editing.validUntil}T23:59:59.999Z`).toISOString()
        : null,
      active: editing.active,
      applies_to: editing.appliesTo,
      category_id: editing.appliesTo === "category" ? editing.categoryId : null,
      item_ids: editing.appliesTo === "items" ? [] : [],
    };
    const url = editing.id ? `/api/v1/merchant/coupons/${editing.id}` : "/api/v1/merchant/coupons";
    const method = editing.id ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(editing.id ? { ...payload, code: undefined } : payload),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data?.error?.message ?? "שמירה נכשלה");
      return;
    }
    setEditing(null);
    pushToast("ok", editing.id ? "הקופון עודכן" : "הקופון נוצר");
    router.refresh();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const res = await fetch(`/api/v1/merchant/coupons/${pendingDelete.id}`, {
      method: "DELETE",
    });
    setDeleting(false);
    setPendingDelete(null);
    if (!res.ok) {
      pushToast("err", "מחיקה נכשלה");
      return;
    }
    pushToast("ok", "הקופון נמחק");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        chip="שיווק"
        title="קופונים"
        subtitle="קוד הנחה, תוקף ומגבלת שימוש — הלקוח מקליד בצ׳קאוט ומקבל את ההנחה בלייב"
        actions={
          !editing ? (
            <button
              type="button"
              onClick={startNew}
              className="px-4 py-2 rounded-xl bg-black text-[#F8CB1E] border-2 border-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/90 inline-flex items-center gap-1"
            >
              <IcoPlus c="#F8CB1E" s={14} /> קופון חדש
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
        <CouponEditor
          draft={editing}
          categories={categories}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={save}
          saving={busy}
        />
      )}

      {!editing && (
        <div className="space-y-2">
          {list.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-qf-line-dash px-6 py-12 text-center">
              <div className="text-base font-semibold mb-1">אין קופונים</div>
              <p className="text-sm text-qf-mute max-w-md mx-auto leading-snug">
                קוד הנחה הוא הדרך הכי קלה להחזיר לקוחות. צור קוד אחד עם הנחה
                של 10-20% לראשונה, חלק בוואטסאפ או באינסטגרם, ותראה.
              </p>
              <button
                type="button"
                onClick={startNew}
                className="mt-4 inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium"
              >
                <IcoPlus c="white" s={14} /> צור קופון ראשון
              </button>
            </div>
          ) : (
            list.map((c) => {
              const categoryName = c.categoryId
                ? categories.find((cat) => cat.id === c.categoryId)?.name
                : null;
              return (
                <article
                  key={c.id}
                  className={cn(
                    "bg-white rounded-2xl border p-4 flex items-center gap-3",
                    c.active ? "border-qf-line-dash" : "border-qf-line-dash opacity-60",
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold tnum text-base">{c.code}</span>
                      <span className="text-xs bg-qf-line-soft px-2 py-0.5 rounded-md">
                        {c.type === "percent" ? `${c.value}%` : `₪${c.value}`}
                      </span>
                      {!c.active && (
                        <span className="text-[10px] bg-qf-tomato-soft text-qf-tomato px-2 py-0.5 rounded-md font-semibold">
                          לא פעיל
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-qf-mute mt-1">
                      {c.appliesTo === "all"
                        ? "כל ההזמנה"
                        : c.appliesTo === "category" && categoryName
                          ? `קטגוריה: ${categoryName}`
                          : "פריטים נבחרים"}
                      {c.minOrder ? ` · מינ׳ ₪${c.minOrder}` : ""}
                      {c.usageLimit
                        ? ` · ${c.usageCount}/${c.usageLimit} שימושים`
                        : ` · ${c.usageCount} שימושים`}
                      {c.validUntil
                        ? ` · תוקף עד ${new Date(c.validUntil).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" })}`
                        : ""}
                    </p>
                    {c.description && (
                      <p className="text-xs text-qf-ink2 mt-1 truncate">{c.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPendingDelete(c)}
                      className="text-xs text-qf-tomato hover:underline"
                    >
                      מחק
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="text-xs text-(--qf-deep) hover:underline font-medium ms-2"
                    >
                      עריכה
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="מחיקת קופון"
        message={
          <>
            הקופון <span className="font-semibold font-mono">&quot;{pendingDelete?.code}&quot;</span> יימחק.
            לקוחות שניסו לממש אותו כבר לא יוכלו. פעולה לא הפיכה.
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

function CouponEditor({
  draft,
  categories,
  onChange,
  onCancel,
  onSave,
  saving,
}: {
  draft: DraftCoupon;
  categories: Category[];
  onChange: (d: DraftCoupon) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <section className="bg-white rounded-2xl border border-qf-line-dash p-5 space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="font-semibold">
          {draft.id ? "עריכת קופון" : "קופון חדש"}
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg border border-qf-line-dash text-sm"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="px-3.5 py-1.5 rounded-lg bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-60"
          >
            {saving ? "שומר..." : "שמור"}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">קוד <span className="text-qf-tomato">*</span></span>
          <input
            value={draft.code}
            onChange={(e) => onChange({ ...draft, code: e.target.value.toUpperCase() })}
            disabled={!!draft.id}
            placeholder="WELCOME20"
            dir="ltr"
            maxLength={40}
            className="px-3 py-2 rounded-xl border border-qf-line-dash text-sm tnum disabled:bg-qf-line-soft disabled:opacity-70"
          />
          {draft.id && (
            <span className="text-[10px] text-qf-mute">קוד לא ניתן לשינוי אחרי יצירה</span>
          )}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">תיאור (פנימי)</span>
          <input
            value={draft.description}
            onChange={(e) => onChange({ ...draft, description: e.target.value })}
            placeholder="קמפיין אינסטגרם — אוקטובר"
            className="px-3 py-2 rounded-xl border border-qf-line-dash text-sm"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">סוג הנחה</span>
          <select
            value={draft.type}
            onChange={(e) => onChange({ ...draft, type: e.target.value as "percent" | "fixed" })}
            className="px-3 py-2 rounded-xl border border-qf-line-dash text-sm bg-white"
          >
            <option value="percent">אחוז</option>
            <option value="fixed">סכום קבוע (₪)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">ערך</span>
          <div className="flex items-center border border-qf-line-dash rounded-xl">
            <input
              type="number"
              min={1}
              value={draft.value}
              onChange={(e) => onChange({ ...draft, value: parseInt(e.target.value, 10) || 0 })}
              className="flex-1 px-3 py-2 outline-none tnum"
            />
            <span className="px-3 text-qf-mute font-semibold">
              {draft.type === "percent" ? "%" : "₪"}
            </span>
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">סטטוס</span>
          <button
            type="button"
            onClick={() => onChange({ ...draft, active: !draft.active })}
            className={cn(
              "px-3 py-2 rounded-xl text-sm font-medium transition inline-flex items-center justify-center gap-1.5",
              draft.active
                ? "bg-qf-green-soft text-qf-green-deep border border-qf-green-deep/20"
                : "bg-qf-line-soft text-qf-mute border border-qf-line-dash",
            )}
          >
            {draft.active && <IcoCheck c="currentColor" s={14} />}
            {draft.active ? "פעיל" : "כבוי"}
          </button>
        </label>
      </div>

      <div>
        <span className="text-sm font-medium block mb-2">חל על</span>
        <div className="grid grid-cols-3 gap-2">
          {(["all", "category", "items"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange({ ...draft, appliesTo: opt })}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-semibold transition border",
                draft.appliesTo === opt
                  ? "border-(--qf-primary) bg-(--qf-primary)/10 text-(--qf-deep)"
                  : "border-qf-line-dash text-qf-ink2 hover:bg-qf-line-soft",
              )}
            >
              {opt === "all" ? "כל ההזמנה" : opt === "category" ? "קטגוריה" : "פריטים נבחרים"}
            </button>
          ))}
        </div>
        {draft.appliesTo === "category" && categories.length > 0 && (
          <select
            value={draft.categoryId}
            onChange={(e) => onChange({ ...draft, categoryId: e.target.value })}
            className="mt-2 w-full px-3 py-2 rounded-xl border border-qf-line-dash text-sm bg-white"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        {draft.appliesTo === "items" && (
          <p className="mt-2 text-xs text-qf-mute">
            בחירת פריטים ספציפיים — בקרוב. בינתיים השתמש ב״קטגוריה״ או ״כל ההזמנה״.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">סכום מינימום (אופציונלי)</span>
          <input
            type="number"
            min={0}
            value={draft.minOrder}
            onChange={(e) => onChange({ ...draft, minOrder: e.target.value })}
            placeholder="₪50"
            className="px-3 py-2 rounded-xl border border-qf-line-dash text-sm tnum"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">הגבלת שימוש כוללת (אופציונלי)</span>
          <input
            type="number"
            min={1}
            value={draft.usageLimit}
            onChange={(e) => onChange({ ...draft, usageLimit: e.target.value })}
            placeholder="100"
            className="px-3 py-2 rounded-xl border border-qf-line-dash text-sm tnum"
          />
        </label>
        {draft.type === "percent" && (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">תקרת הנחה ב-₪ (אופציונלי)</span>
            <input
              type="number"
              min={0}
              value={draft.maxDiscount}
              onChange={(e) => onChange({ ...draft, maxDiscount: e.target.value })}
              placeholder="50"
              className="px-3 py-2 rounded-xl border border-qf-line-dash text-sm tnum"
            />
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">תאריך תפוגה (אופציונלי)</span>
          <input
            type="date"
            value={draft.validUntil}
            onChange={(e) => onChange({ ...draft, validUntil: e.target.value })}
            className="px-3 py-2 rounded-xl border border-qf-line-dash text-sm"
          />
        </label>
      </div>
    </section>
  );
}
