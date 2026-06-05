"use client";

import { useEffect, useState } from "react";
import { MenuItemImage } from "@/components/shared/MenuItemImage";
import { formatPrice } from "@/lib/format";
import { IcoClose, IcoCheck } from "@/components/shared/Icons";
import { Modal } from "@/components/shared/Modal";
import { cn } from "@/lib/cn";

interface FullItem {
  id: string;
  name: string;
  description: string;
  base_price: number;
  art_type: string | null;
  tags: string[];
  images?: string[];
  sizes: Array<{ id: string; code: string; name: string; price_delta: number; is_default: boolean }>;
  option_groups: Array<{
    id: string;
    name: string;
    type: "single" | "multi";
    required: boolean;
    min_select: number;
    max_select: number;
    options: Array<{ id: string; name: string; price_delta: number; is_default: boolean }>;
  }>;
}

export function ItemPreviewModal({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const [item, setItem] = useState<FullItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/merchant/menu/items/${itemId}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error?.message ?? "טעינה נכשלה");
          return;
        }
        setItem(json.item);
      } catch {
        if (!cancelled) setError("טעינה נכשלה");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  const defaultSize = item?.sizes.find((s) => s.is_default) ?? item?.sizes[0] ?? null;
  const sizeDelta = defaultSize?.price_delta ?? 0;
  const defaultOptsDelta = item
    ? item.option_groups
        .flatMap((g) => g.options.filter((o) => o.is_default).map((o) => o.price_delta))
        .reduce((a, b) => a + b, 0)
    : 0;
  const totalBase = item ? item.base_price + sizeDelta + defaultOptsDelta : 0;

  return (
    <Modal open onClose={onClose} size="md" ariaLabel="תצוגה מקדימה של פריט">
      <button
        type="button"
        onClick={onClose}
        aria-label="סגור"
        className="absolute top-3 inset-e-3 z-20 w-9 h-9 rounded-full bg-white shadow grid place-items-center"
      >
        <IcoClose s={18} />
      </button>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {error ? (
          <div className="p-10 text-center text-sm text-qf-tomato">{error}</div>
        ) : !item ? (
          <div className="p-10 text-center text-sm text-qf-mute">טוען…</div>
        ) : (
          <>
            <div className="relative h-56 overflow-hidden">
              <MenuItemImage
                src={item.images?.[0]}
                alt={item.name}
                businessType="general"
                size={500}
                rounded="md"
                className="w-full h-full"
              />
            </div>

            <div className="px-5 -mt-5 relative pb-2">
              <div className="bg-white rounded-2xl border border-qf-line p-4 space-y-3">
                {item.tags.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {item.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] bg-qf-green-soft text-qf-green-deep px-1.5 py-0.5 rounded-md"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <h1 className="text-2xl font-bold">{item.name}</h1>
                {item.description && (
                  <p className="text-sm text-qf-ink2 leading-relaxed">{item.description}</p>
                )}
                <div className="text-xs text-qf-mute tnum">
                  מחיר בסיס {formatPrice(item.base_price)}
                  {sizeDelta !== 0 && ` · גודל ${sizeDelta > 0 ? "+" : ""}${sizeDelta}`}
                  {defaultOptsDelta !== 0 && ` · ברירת מחדל +${defaultOptsDelta}`}
                </div>
              </div>
            </div>

            {item.sizes.length > 0 && (
              <PreviewSection title="גודל">
                <div className="grid grid-cols-1 gap-2">
                  {item.sizes.map((s) => (
                    <PreviewRow
                      key={s.id}
                      active={s.is_default}
                      label={s.name}
                      hint={
                        s.price_delta === 0
                          ? "בסיס"
                          : s.price_delta > 0
                            ? `+${formatPrice(s.price_delta)}`
                            : `-${formatPrice(-s.price_delta)}`
                      }
                      radio
                    />
                  ))}
                </div>
              </PreviewSection>
            )}

            {item.option_groups.map((g) => (
              <PreviewSection
                key={g.id}
                title={g.name}
                hint={
                  g.required ? "חובה" : g.type === "multi" ? `עד ${g.max_select}` : undefined
                }
              >
                <div className="grid grid-cols-1 gap-2">
                  {g.options.map((o) => (
                    <PreviewRow
                      key={o.id}
                      active={o.is_default}
                      label={o.name}
                      hint={o.price_delta > 0 ? `+${formatPrice(o.price_delta)}` : undefined}
                      radio={g.type === "single"}
                    />
                  ))}
                </div>
              </PreviewSection>
            ))}

            <div className="px-5 py-4 mt-3 border-t border-qf-line bg-qf-bg-dash flex items-center justify-between text-sm">
              <span className="text-qf-mute">סה״כ בברירת מחדל</span>
              <span className="font-semibold tnum">{formatPrice(totalBase)}</span>
            </div>
            <div className="px-5 pb-5 pt-2 text-[11px] text-qf-mute text-center">
              תצוגה מקדימה - כך הלקוח יראה את הפריט באפליקציה
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function PreviewSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-5 mt-4">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="font-semibold">{title}</h2>
        {hint && <span className="text-xs text-qf-mute">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function PreviewRow({
  active,
  label,
  hint,
  radio,
}: {
  active: boolean;
  label: string;
  hint?: string;
  radio?: boolean;
}) {
  return (
    <div
      className={cn(
        "w-full flex items-center justify-between gap-3 bg-white border rounded-xl px-3.5 py-3 text-sm",
        active ? "border-(--qf-primary) ring-1 ring-(--qf-primary)/30" : "border-qf-line",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            radio ? "rounded-full" : "rounded-md",
            "w-5 h-5 border-2 grid place-items-center",
            active ? "border-(--qf-primary) bg-(--qf-primary)" : "border-qf-line-dash",
          )}
        >
          {active &&
            (radio ? (
              <span className="w-2 h-2 rounded-full bg-white" />
            ) : (
              <IcoCheck c="#fff" s={10} />
            ))}
        </span>
        <span>{label}</span>
      </div>
      {hint && <span className="text-xs text-qf-mute tnum">{hint}</span>}
    </div>
  );
}
