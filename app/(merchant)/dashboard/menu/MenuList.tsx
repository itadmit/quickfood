"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/format";
import { IcoPizza, IcoEye, IcoEdit, IcoTrash, IcoClose, IcoCheck } from "@/components/shared/Icons";
import { cn } from "@/lib/cn";
import { ItemPreviewModal } from "./ItemPreviewModal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

interface Category {
  id: string;
  name: string;
}
interface Item {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  basePrice: number;
  prepMinutes: number;
  available: boolean;
  artType: string | null;
  sku: string | null;
}

export function MenuList({
  categories,
  items,
  visibleCount,
  hiddenCount,
}: {
  categories: Category[];
  items: Item[];
  visibleCount: number;
  hiddenCount: number;
}) {
  const router = useRouter();
  const [activeCat, setActiveCat] = useState<string | "all">("all");
  const [localItems, setLocalItems] = useState(items);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const filtered = useMemo(
    () => (activeCat === "all" ? localItems : localItems.filter((i) => i.categoryId === activeCat)),
    [activeCat, localItems],
  );

  async function toggleAvailability(itemId: string, next: boolean) {
    // optimistic
    setLocalItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, available: next } : i)));
    const res = await fetch(`/api/v1/merchant/menu/items/${itemId}/availability`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ available: next }),
    });
    if (!res.ok) {
      setLocalItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, available: !next } : i)));
    }
  }

  async function confirmDelete() {
    const item = pendingDelete;
    if (!item) return;
    setDeleting(true);
    const prev = localItems;
    setLocalItems((p) => p.filter((i) => i.id !== item.id));
    const res = await fetch(`/api/v1/merchant/menu/items/${item.id}`, { method: "DELETE" });
    setDeleting(false);
    setPendingDelete(null);
    if (!res.ok) {
      setLocalItems(prev);
      alert("מחיקה נכשלה");
      return;
    }
    router.refresh();
  }

  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">תפריט</h1>
          <p className="text-sm text-qf-mute">
            {visibleCount} פריטים זמינים · {hiddenCount} מוסתרים
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-qf-line-dash hover:bg-qf-line-soft text-sm"
          >
            ייבוא מ-CSV
          </button>
          <Link
            href="/dashboard/menu/new"
            className="px-3.5 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm"
          >
            + פריט חדש
          </Link>
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        <CategoryChip active={activeCat === "all"} onClick={() => setActiveCat("all")}>
          הכל ({localItems.length})
        </CategoryChip>
        {categories.map((c) => {
          const count = localItems.filter((i) => i.categoryId === c.id).length;
          return (
            <CategoryChip
              key={c.id}
              active={activeCat === c.id}
              onClick={() => setActiveCat(c.id)}
            >
              {c.name} ({count})
            </CategoryChip>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-qf-line-dash overflow-hidden">
        <div className="grid grid-cols-[60px_1fr_140px_100px_120px_100px_60px] gap-3 px-4 py-2.5 text-xs font-medium text-qf-mute border-b border-qf-line-dash bg-qf-line-soft/60">
          <div></div>
          <div>שם / SKU</div>
          <div>קטגוריה</div>
          <div>מחיר</div>
          <div>זמן הכנה</div>
          <div>זמינות</div>
          <div></div>
        </div>
        {filtered.map((item) => (
          <div
            key={item.id}
            className={cn(
              "grid grid-cols-[60px_1fr_140px_100px_120px_100px_60px] gap-3 px-4 py-3 items-center border-b border-qf-line-soft last:border-b-0 hover:bg-qf-line-soft/40",
              !item.available && "opacity-55",
            )}
          >
            <div className="w-10 h-10 rounded-xl bg-qf-warm-dash grid place-items-center">
              <IcoPizza c="#c2421f" s={20} />
            </div>
            <div className="min-w-0">
              <div className="font-medium truncate">{item.name}</div>
              {item.sku && <div className="text-xs text-qf-mute" dir="ltr">{item.sku}</div>}
            </div>
            <div className="text-sm text-qf-ink2 truncate">{catMap[item.categoryId]}</div>
            <div className="text-sm tnum font-medium">{formatPrice(item.basePrice)}</div>
            <div className="text-sm text-qf-ink2 tnum">{item.prepMinutes} דק&apos;</div>
            <div>
              <button
                type="button"
                role="switch"
                aria-checked={item.available}
                onClick={() => toggleAvailability(item.id, !item.available)}
                className={cn(
                  "relative inline-flex h-6 w-10 rounded-full transition",
                  item.available ? "bg-(--qf-primary)" : "bg-qf-line-dash",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 inline-block h-5 w-5 rounded-full bg-white shadow transition",
                    item.available ? "inset-e-0.5" : "inset-s-0.5",
                  )}
                />
              </button>
            </div>
            <RowActions
              item={item}
              onPreview={() => setPreviewId(item.id)}
              onDelete={() => setPendingDelete(item)}
            />
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="p-10 text-center text-sm text-qf-mute">
            אין פריטים בקטגוריה הזו
          </div>
        )}
      </div>

      {previewId && (
        <ItemPreviewModal itemId={previewId} onClose={() => setPreviewId(null)} />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="מחיקת פריט"
        message={
          <>
            הפריט <span className="font-semibold">&quot;{pendingDelete?.name}&quot;</span> יימחק לצמיתות.
            פעולה זו אינה ניתנת לביטול.
          </>
        }
        confirmLabel="מחק"
        cancelLabel="ביטול"
        variant="danger"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      {importOpen && <CsvImportModal onClose={() => setImportOpen(false)} />}
    </div>
  );
}

function CsvImportModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [csv, setCsv] = useState(`name,description,category,base_price,prep_minutes,available,tags
פיצה מרגריטה,רוטב עגבניות + מוצרלה,קלאסיות,58,10,true,פופולרי;צמחוני
קולה,משקה קר,שתייה,12,0,true,`);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: Array<{ row: number; message: string }> } | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function onFile(file: File) {
    const text = await file.text();
    setCsv(text);
  }

  async function importNow() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/v1/merchant/menu/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json();
      setResult({ created: data.created ?? 0, errors: data.errors ?? [] });
      if (data.created > 0) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-4 border-b border-qf-line-soft flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">ייבוא תפריט מ-CSV</h2>
            <p className="text-xs text-qf-mute">
              עמודות נדרשות: name, category, base_price · אופציונליות: description, prep_minutes, available, tags
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-qf-line-soft grid place-items-center text-qf-mute"
            aria-label="סגור"
          >
            <IcoClose c="currentColor" s={16} />
          </button>
        </header>
        <div className="p-5 space-y-3">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            className="block text-sm"
          />
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={10}
            dir="ltr"
            className="w-full font-mono text-xs bg-qf-line-soft/40 border border-qf-line-dash rounded-xl p-3 outline-none focus:border-(--qf-primary)"
            placeholder="הדבק כאן את ה-CSV או בחר קובץ למעלה"
          />
          {result && (
            <div className="bg-qf-green-soft border border-qf-green-line text-qf-green-deep rounded-xl px-3 py-2 text-sm">
              <div className="inline-flex items-center gap-1.5">
                <IcoCheck c="currentColor" s={14} />
                יובאו {result.created} פריטים
              </div>
              {result.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-qf-tomato">
                    {result.errors.length} שגיאות
                  </summary>
                  <ul className="text-xs mt-1 list-disc ps-5 space-y-0.5 text-qf-ink2">
                    {result.errors.slice(0, 10).map((e, i) => (
                      <li key={i}>
                        שורה {e.row}: {e.message}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
        <footer className="px-5 py-3 border-t border-qf-line-soft flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-xl border border-qf-line-dash text-sm"
          >
            סגור
          </button>
          <button
            type="button"
            onClick={importNow}
            disabled={!csv.trim() || busy}
            className="px-4 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-60"
          >
            {busy ? "מייבא..." : "ייבא"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function RowActions({
  item,
  onPreview,
  onDelete,
}: {
  item: Item;
  onPreview: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="פעולות"
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-8 h-8 rounded-lg hover:bg-qf-line-soft grid place-items-center text-qf-mute"
      >
        ⋯
      </button>
      {open && (
        <div
          role="menu"
          className="absolute inset-e-0 top-full mt-1 w-40 bg-white border border-qf-line-dash rounded-xl shadow-lg z-20 py-1 text-sm overflow-hidden"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onPreview();
            }}
            className="w-full text-start px-3 py-2 hover:bg-qf-line-soft inline-flex items-center gap-2"
          >
            <IcoEye s={16} c="#3a4a40" />
            <span>צפה במוצר</span>
          </button>
          <Link
            href={`/dashboard/menu/${item.id}`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="px-3 py-2 hover:bg-qf-line-soft flex items-center gap-2"
          >
            <IcoEdit s={16} c="#3a4a40" />
            <span>ערוך</span>
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="w-full text-start px-3 py-2 text-qf-tomato hover:bg-qf-tomato-soft inline-flex items-center gap-2"
          >
            <IcoTrash s={16} c="#c2421f" />
            <span>מחק</span>
          </button>
        </div>
      )}
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3.5 py-1.5 rounded-full border whitespace-nowrap text-sm transition",
        active
          ? "bg-(--qf-primary) text-white border-transparent"
          : "bg-white border-qf-line-dash text-qf-ink2 hover:border-(--qf-primary)",
      )}
    >
      {children}
    </button>
  );
}
