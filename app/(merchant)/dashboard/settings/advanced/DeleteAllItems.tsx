"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { IcoTrash } from "@/components/shared/Icons";

export function DeleteAllItems({ itemCount }: { itemCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletedCount, setDeletedCount] = useState<number | null>(null);

  async function onConfirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        "/api/v1/merchant/menu/items/bulk-delete",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ confirm: "DELETE_ALL_ITEMS" }),
        },
      );
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error?.message || "המחיקה נכשלה");
        return;
      }
      setDeletedCount(body.deleted ?? 0);
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setDeletedCount(null);
            setOpen(true);
          }}
          disabled={itemCount === 0}
          className="bg-qf-tomato hover:bg-[#a8381b] text-white font-semibold px-5 py-2.5 rounded-xl text-sm disabled:opacity-50 inline-flex items-center gap-2 transition"
        >
          <IcoTrash s={16} c="#fff" />
          מחק את כל המוצרים
        </button>
        <span className="text-xs text-qf-mute tnum">
          {itemCount === 0
            ? "אין מוצרים בתפריט"
            : `${itemCount} מוצרים בתפריט כרגע`}
        </span>
      </div>

      {error && (
        <div className="bg-qf-tomato/10 border border-qf-tomato/30 text-qf-tomato text-sm rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      {deletedCount !== null && (
        <div className="bg-qf-green-soft border border-qf-green-deep/20 text-qf-green-deep text-sm rounded-xl px-3 py-2 tnum">
          נמחקו {deletedCount} מוצרים.
        </div>
      )}

      <ConfirmDialog
        open={open}
        variant="danger"
        title="למחוק את כל המוצרים?"
        message={
          <>
            כל <b className="tnum">{itemCount}</b> המוצרים בתפריט יימחקו לצמיתות
            (כולל מידות, תוספות ומועדפים). היסטוריית הזמנות לא תיפגע - שמות
            ומחירים נשמרים בכל הזמנה. הקטגוריות והתוספות לשימוש חוזר יישארו, כך
            שאפשר לייבא מחדש מוולט אם תרצו.
          </>
        }
        confirmLabel="כן, מחק הכל"
        cancelLabel="ביטול"
        busy={busy}
        onConfirm={onConfirm}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
