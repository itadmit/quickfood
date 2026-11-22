"use client";

import { useCart } from "@/components/customer/CartProvider";
import { useLocale } from "@/components/customer/LocaleProvider";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
import { formatPrice } from "@/lib/format";

/** The automatic gift line. No stepper, no remove, no edit - it follows the
 *  subtotal on its own. `compact` = sidebar / checkout summary rows. */
export function CartGiftLine({ compact = false, asListItem = false }: { compact?: boolean; asListItem?: boolean }) {
  const { freeGift, tenant } = useCart();
  const { t, tc } = useLocale();
  if (!freeGift) return null;
  const name = tc(`menu_item:${freeGift.itemId}:name`, freeGift.name);
  const size = compact ? 48 : 80;
  const Tag = asListItem ? "li" : "div";
  return (
    <Tag
      className={
        compact
          ? "py-3 flex gap-3 items-center"
          : "bg-white rounded-2xl border-2 border-dashed border-(--qf-primary)/50 p-3.5 flex gap-3.5 shadow-xs"
      }
      data-testid="cart-gift-line"
    >
      <div className={`${compact ? "w-12 h-12 rounded-lg" : "w-20 h-20 rounded-xl"} overflow-hidden shrink-0`}>
        <MenuItemImage
          src={freeGift.imageUrl}
          alt={name}
          businessType={(tenant.businessType as BusinessType) ?? "general"}
          size={size}
          rounded={compact ? "lg" : "xl"}
          className="w-full h-full"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-semibold leading-tight ${compact ? "text-sm" : ""}`}>{name}</span>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-(--qf-soft) text-(--qf-deep)">
            {t("gift.badge")}
          </span>
        </div>
        <div className="text-xs text-qf-mute mt-0.5">
          {t("gift.autoAdded")} {formatPrice(freeGift.minSubtotal)}
        </div>
      </div>
      <div className={`font-bold tnum shrink-0 ${compact ? "text-sm" : "text-base"}`}>{t("gift.free")}</div>
    </Tag>
  );
}

/** "עוד X ₪ ומקבלים Y במתנה" - shown while a gift tier is not reached yet. */
export function CartGiftHint({ className = "" }: { className?: string }) {
  const { nextFreeGift } = useCart();
  const { t, tc } = useLocale();
  if (!nextFreeGift) return null;
  return (
    <div className={`bg-(--qf-soft) rounded-xl px-3 py-2 text-xs text-qf-ink2 ${className}`}>
      {t("gift.hintPrefix")} <b className="tnum">{formatPrice(nextFreeGift.missing)}</b> {t("gift.hintMid")}{" "}
      <b>{tc(`menu_item:${nextFreeGift.itemId}:name`, nextFreeGift.itemName)}</b>{" "}
      {t("gift.hintSuffix")}
    </div>
  );
}
