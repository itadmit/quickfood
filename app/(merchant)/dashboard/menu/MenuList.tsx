"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/format";
import { IcoEye, IcoEdit, IcoTrash, IcoClose, IcoCheck, IcoMore, IcoStar, IcoCopy } from "@/components/shared/Icons";
import { Toast, type ToastState, type ToastKind } from "@/components/shared/Toast";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
import { Toggle } from "@/components/shared/Toggle";
import { Modal } from "@/components/shared/Modal";
import { cn } from "@/lib/cn";
import { ItemPreviewModal } from "./ItemPreviewModal";
import { MenuFileImportModal } from "./MenuFileImportModal";
import { BulkPriceModal } from "./BulkPriceModal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { resolveCategoryStyle } from "@/lib/category-style";
import { PageHeader } from "@/components/merchant/v2/PageHeader";
import { DragList } from "@/components/shared/DragList";

/** Three-bar drag grip - matches the "סדר" affordance merchants expect. */
function ReorderGrip() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="text-qf-mute">
      <rect x="2" y="3.5" width="12" height="1.6" rx="0.8" fill="currentColor" />
      <rect x="2" y="7.2" width="12" height="1.6" rx="0.8" fill="currentColor" />
      <rect x="2" y="10.9" width="12" height="1.6" rx="0.8" fill="currentColor" />
    </svg>
  );
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  position: number;
  upsellInCart?: boolean;
  upsellBeforeCheckout?: boolean;
}
interface Item {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  basePrice: number;
  prepMinutes: number;
  available: boolean;
  featured: boolean;
  artType: string | null;
  sku: string | null;
  images: string[];
}

export function MenuList({
  categories,
  items,
  businessType,
  visibleCount,
  hiddenCount,
}: {
  categories: Category[];
  items: Item[];
  businessType: BusinessType;
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
  const [pdfImportOpen, setPdfImportOpen] = useState(false);
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Drag-to-reorder. Scoped to a single category (storefront orders items
  // by [categoryId, position], so reordering across categories is
  // meaningless). orderDraft is the working copy the DragList mutates;
  // it's committed to the server + localItems on save.
  const [reorderMode, setReorderMode] = useState(false);
  const [orderDraft, setOrderDraft] = useState<Item[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);

  function pushToast(kind: ToastKind, message: string) {
    setToast({ id: Date.now(), kind, message });
  }

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
      pushToast("err", "השינוי נכשל");
      return;
    }
    pushToast("ok", next ? "הפריט הופעל" : "הפריט הושבת");
  }

  async function toggleFeatured(itemId: string, next: boolean) {
    setLocalItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, featured: next } : i)));
    const res = await fetch(`/api/v1/merchant/menu/items/${itemId}/featured`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ featured: next }),
    });
    if (!res.ok) {
      setLocalItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, featured: !next } : i)));
      pushToast("err", "השינוי נכשל");
      return;
    }
    pushToast("ok", next ? "נוסף למומלצים" : "הוסר מהמומלצים");
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
      const body = await res.json().catch(() => ({}));
      pushToast("err", body?.error?.message ?? "מחיקה נכשלה");
      return;
    }
    pushToast("ok", "הפריט נמחק");
    router.refresh();
  }

  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  async function duplicateItem(item: Item) {
    if (duplicatingId) return;
    setDuplicatingId(item.id);
    try {
      const getRes = await fetch(`/api/v1/merchant/menu/items/${item.id}`);
      const getBody = await getRes.json();
      if (!getRes.ok) {
        pushToast("err", getBody?.error?.message ?? "השכפול נכשל");
        return;
      }
      const src = getBody.item;
      const copyName = `${src.name} (עותק)`.slice(0, 120);
      const res = await fetch("/api/v1/merchant/menu/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...src,
          id: undefined,
          name: copyName,
          art_type: src.art_type ?? undefined,
          image_url: src.image_url ?? undefined,
          sku: src.sku ?? undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        pushToast("err", body?.error?.message ?? "השכפול נכשל");
        return;
      }
      setLocalItems((prev) => {
        const at = prev.findIndex((i) => i.id === item.id);
        const copy: Item = { ...item, id: body.item.id, name: copyName };
        return [...prev.slice(0, at + 1), copy, ...prev.slice(at + 1)];
      });
      pushToast("ok", "הפריט שוכפל");
      router.refresh();
    } finally {
      setDuplicatingId(null);
    }
  }

  function startReorder() {
    if (activeCat === "all") {
      pushToast("err", "בחר קטגוריה ספציפית כדי לסדר את הפריטים שלה");
      return;
    }
    setOrderDraft(filtered);
    setReorderMode(true);
  }

  function cancelReorder() {
    setReorderMode(false);
    setOrderDraft([]);
  }

  // Touch-friendly fallback for reordering: HTML5 drag-and-drop doesn't fire
  // on touch devices, so the up/down buttons work everywhere (phone + desktop)
  // alongside the drag handle.
  function moveDraft(from: number, to: number) {
    if (to < 0 || to >= orderDraft.length) return;
    setOrderDraft((prev) => {
      const next = [...prev];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
  }

  async function saveOrder() {
    const ids = orderDraft.map((i) => i.id);
    setSavingOrder(true);
    const res = await fetch("/api/v1/merchant/menu/items/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ item_ids: ids }),
    });
    setSavingOrder(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      pushToast("err", body?.error?.message ?? "שמירת הסדר נכשלה");
      return;
    }
    // Reflect the new order locally before the SSR refresh lands.
    const draftIds = new Set(ids);
    setLocalItems((prev) => [...orderDraft, ...prev.filter((i) => !draftIds.has(i.id))]);
    setReorderMode(false);
    setOrderDraft([]);
    pushToast("ok", "הסדר נשמר");
    router.refresh();
  }

  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);

  return (
    <div className="space-y-4 lg:space-y-5">
      <PageHeader
        chip="קטלוג"
        title="תפריט"
        subtitle={`${visibleCount} פריטים זמינים · ${hiddenCount} מוסתרים`}
        actions={
          <>
            <button
              type="button"
              onClick={() => setBulkPriceOpen(true)}
              className="inline-flex px-3.5 py-2 rounded-xl bg-white border-2 border-black text-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/5"
            >
              עדכון מחירים
            </button>
            <button
              type="button"
              onClick={startReorder}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border-2 border-black text-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/5"
            >
              <ReorderGrip />
              סדר פריטים
            </button>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="inline-flex px-3.5 py-2 rounded-xl bg-white border-2 border-black text-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/5"
            >
              ייבוא מ-CSV
            </button>
            <button
              type="button"
              onClick={() => setPdfImportOpen(true)}
              className="inline-flex px-3.5 py-2 rounded-xl bg-white border-2 border-black text-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/5"
            >
              ייבוא מתפריט (PDF/תמונה)
            </button>
            <Link
              href="/dashboard/menu/new"
              className="flex-1 sm:flex-initial text-center px-3.5 py-2 rounded-xl bg-black text-[#F8CB1E] border-2 border-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/90"
            >
              + פריט חדש
            </Link>
          </>
        }
      />

      <div className={cn("flex items-center gap-2", reorderMode && "opacity-40 pointer-events-none")}>
        <div className="flex gap-2 overflow-x-auto qf-hscroll pb-1.5 flex-1 min-w-0">
          <CategoryChip active={activeCat === "all"} onClick={() => setActiveCat("all")}>
            הכל ({localItems.length})
          </CategoryChip>
          {categories.map((c) => {
            const count = localItems.filter((i) => i.categoryId === c.id).length;
            const style = resolveCategoryStyle(c.icon, c.color);
            const Icon = style.Icon;
            return (
              <CategoryChip
                key={c.id}
                active={activeCat === c.id}
                onClick={() => setActiveCat(c.id)}
              >
                <span
                  className="w-5 h-5 rounded-full grid place-items-center shrink-0"
                  style={{ backgroundColor: style.bg }}
                  aria-hidden
                >
                  <Icon size={11} color={style.fg} strokeWidth={2} />
                </span>
                <span>
                  {c.name} ({count})
                </span>
              </CategoryChip>
            );
          })}
        </div>
      </div>

      {reorderMode && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border-2 border-(--qf-primary) bg-(--qf-soft)">
          <div className="text-sm font-bold text-(--qf-deep)">
            סידור פריטים - {catMap[activeCat as string] ?? "קטגוריה"}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelReorder}
              disabled={savingOrder}
              className="px-3.5 py-2 rounded-xl bg-white border-2 border-black text-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/5 disabled:opacity-50"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={saveOrder}
              disabled={savingOrder}
              className="px-4 py-2 rounded-xl bg-black text-[#F8CB1E] border-2 border-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/90 disabled:opacity-50"
            >
              {savingOrder ? "שומר…" : "שמור סדר"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-qf-line-dash overflow-hidden">
        {/* Table header - desktop only. Mobile rows are self-explanatory cards. */}
        {!reorderMode && (
        <div className="hidden lg:grid grid-cols-[60px_44px_1fr_140px_100px_120px_100px_60px] gap-3 px-4 py-2.5 text-xs font-medium text-qf-mute border-b border-qf-line-dash bg-qf-line-soft/60">
          <div></div>
          <div className="text-center">מומלץ</div>
          <div>שם / SKU</div>
          <div>קטגוריה</div>
          <div>מחיר</div>
          <div>זמן הכנה</div>
          <div>זמינות</div>
          <div></div>
        </div>
        )}
        {reorderMode && (
          <DragList
            items={orderDraft}
            onReorder={setOrderDraft}
            getKey={(i) => i.id}
          >
            {(item, i, drag) => (
              <div className="flex items-center gap-2 sm:gap-3 px-3 lg:px-4 py-3 border-b border-qf-line-soft last:border-b-0 bg-white">
                {/* Drag handle - works on desktop (mouse). */}
                <span
                  {...drag.handleProps}
                  className="hidden sm:grid shrink-0 place-items-center w-9 h-9 rounded-lg hover:bg-qf-line-soft active:bg-qf-line-soft"
                >
                  <ReorderGrip />
                </span>
                {/* Up/down - the touch-friendly path (drag-and-drop doesn't
                    fire on phones). */}
                <div className="shrink-0 flex flex-col">
                  <button
                    type="button"
                    aria-label="הזז למעלה"
                    disabled={i === 0}
                    onClick={() => moveDraft(i, i - 1)}
                    className="w-8 h-7 grid place-items-center rounded-md text-qf-ink2 hover:bg-qf-line-soft disabled:opacity-30"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden><path d="M8 4l4 5H4z" fill="currentColor" /></svg>
                  </button>
                  <button
                    type="button"
                    aria-label="הזז למטה"
                    disabled={i === orderDraft.length - 1}
                    onClick={() => moveDraft(i, i + 1)}
                    className="w-8 h-7 grid place-items-center rounded-md text-qf-ink2 hover:bg-qf-line-soft disabled:opacity-30"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden><path d="M8 12L4 7h8z" fill="currentColor" /></svg>
                  </button>
                </div>
                <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
                  <MenuItemImage
                    src={item.images?.[0]}
                    alt={item.name}
                    businessType={businessType}
                    size={40}
                    rounded="xl"
                    fill
                  />
                </div>
                <div className="flex-1 min-w-0 font-medium truncate">{item.name}</div>
                <div className="shrink-0 text-sm tnum text-qf-mute">{formatPrice(item.basePrice)}</div>
              </div>
            )}
          </DragList>
        )}
        {!reorderMode && filtered.map((item) => (
          <div
            key={item.id}
            onClick={() => router.push(`/dashboard/menu/${item.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") router.push(`/dashboard/menu/${item.id}`);
            }}
            className={cn(
              "flex items-center gap-3 px-3 lg:px-4 py-3 border-b border-qf-line-soft last:border-b-0 hover:bg-qf-line-soft/40 cursor-pointer lg:grid lg:grid-cols-[60px_44px_1fr_140px_100px_120px_100px_60px]",
              !item.available && "opacity-55",
            )}
          >
            <div className="w-12 h-12 lg:w-10 lg:h-10 rounded-xl overflow-hidden shrink-0">
              <MenuItemImage
                src={item.images?.[0]}
                alt={item.name}
                businessType={businessType}
                size={48}
                rounded="xl"
                fill
              />
            </div>
            <div className="hidden lg:grid place-items-center" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                aria-pressed={item.featured}
                aria-label={item.featured ? "הסר ממומלצים" : "הוסף למומלצים"}
                title={item.featured ? "במומלצים" : "סמן כמומלץ"}
                onClick={() => toggleFeatured(item.id, !item.featured)}
                className={cn(
                  "w-8 h-8 rounded-lg grid place-items-center transition",
                  item.featured
                    ? "text-qf-yolk bg-qf-yolk-soft hover:bg-qf-yolk-soft/80"
                    : "text-qf-mute hover:bg-qf-line-soft",
                )}
              >
                <IcoStar
                  c="currentColor"
                  fill={item.featured ? "currentColor" : "none"}
                  s={18}
                />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                {item.featured && (
                  <span className="lg:hidden shrink-0" aria-label="מומלץ">
                    <IcoStar c="#e8a93b" fill="#e8a93b" s={14} />
                  </span>
                )}
                <div className="font-medium truncate">{item.name}</div>
              </div>
              {/* On mobile, surface key meta below the name since the columns are hidden */}
              <div className="lg:hidden text-xs text-qf-mute flex items-center gap-2 mt-0.5">
                <span className="truncate">{catMap[item.categoryId]}</span>
                <span>·</span>
                <span className="tnum font-medium text-qf-ink2">{formatPrice(item.basePrice)}</span>
              </div>
              {item.sku && <div className="hidden lg:block text-xs text-qf-mute" dir="ltr">{item.sku}</div>}
            </div>
            <div className="hidden lg:block text-sm text-qf-ink2 truncate">{catMap[item.categoryId]}</div>
            <div className="hidden lg:block text-sm tnum font-medium">{formatPrice(item.basePrice)}</div>
            <div className="hidden lg:block text-sm text-qf-ink2 tnum">{item.prepMinutes} דק&apos;</div>
            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
              <Toggle
                checked={item.available}
                onChange={(next) => toggleAvailability(item.id, next)}
                aria-label={item.available ? "השבת פריט" : "הפעל פריט"}
              />
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <RowActions
                item={item}
                onPreview={() => setPreviewId(item.id)}
                onDuplicate={() => duplicateItem(item)}
                onDelete={() => setPendingDelete(item)}
              />
            </div>
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
      {pdfImportOpen && <MenuFileImportModal onClose={() => setPdfImportOpen(false)} />}
      {bulkPriceOpen && (
        <BulkPriceModal
          categories={categories}
          onClose={() => setBulkPriceOpen(false)}
          onSuccess={(updated) => {
            setBulkPriceOpen(false);
            pushToast("ok", `${updated} מחירים עודכנו`);
            router.refresh();
          }}
        />
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
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
    <Modal open onClose={onClose} size="2xl" ariaLabel="ייבוא תפריט מ-CSV">
      <header className="sticky top-0 z-10 bg-white px-5 py-4 border-b border-qf-line-soft flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold">ייבוא תפריט מ-CSV</h2>
          <p className="text-xs text-qf-mute">
            עמודות נדרשות: name, category, base_price · אופציונליות: description, prep_minutes, available, tags
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 w-8 h-8 rounded-lg hover:bg-qf-line-soft grid place-items-center text-qf-mute"
          aria-label="סגור"
        >
          <IcoClose c="currentColor" s={16} />
        </button>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            className="block text-sm text-qf-mute file:me-3 file:px-3.5 file:py-2 file:rounded-xl file:border-2 file:border-black file:bg-[#F8CB1E] file:text-black file:font-bold file:cursor-pointer file:shadow-[0_2px_0_#000] hover:file:bg-[#FFD843] file:transition"
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
      <footer className="shrink-0 px-5 py-3 border-t border-qf-line-soft flex justify-end gap-2 bg-white">
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
    </Modal>
  );
}

function RowActions({
  item,
  onPreview,
  onDuplicate,
  onDelete,
}: {
  item: Item;
  onPreview: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const MENU_W = 160; // matches w-40

  // Recompute menu position whenever it opens or on viewport changes.
  useEffect(() => {
    if (!open) return;
    function place() {
      const btn = btnRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      setCoords({
        top: r.bottom + 4,
        // Anchor the menu's RIGHT edge to the button's RIGHT edge so it
        // unfolds to the left - the natural direction in RTL.
        left: Math.max(8, r.right - MENU_W),
      });
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
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

  const menu =
    open && coords && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ position: "fixed", top: coords.top, left: coords.left, width: MENU_W }}
            className="bg-white border border-qf-line-dash rounded-xl shadow-lg z-50 py-1 text-sm overflow-hidden"
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
                onDuplicate();
              }}
              className="w-full text-start px-3 py-2 hover:bg-qf-line-soft inline-flex items-center gap-2"
            >
              <IcoCopy s={16} c="#3a4a40" />
              <span>שכפל</span>
            </button>
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
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="פעולות"
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-8 h-8 rounded-lg hover:bg-qf-line-soft grid place-items-center text-qf-mute"
      >
        <IcoMore c="#7c8a82" s={18} />
      </button>
      {menu}
    </>
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
        "px-3.5 py-1.5 rounded-full border whitespace-nowrap text-sm transition inline-flex items-center gap-1.5",
        active
          ? "bg-(--qf-primary) text-white border-transparent"
          : "bg-white border-qf-line-dash text-qf-ink2 hover:border-(--qf-primary)",
      )}
    >
      {children}
    </button>
  );
}
