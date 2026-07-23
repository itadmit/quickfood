"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Crown } from "lucide-react";
import { IcoChev, IcoHeart, IcoReceipt, IcoUser } from "@/components/shared/Icons";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
import { formatPrice, formatDate, formatPhone, fullName } from "@/lib/format";
import { cn } from "@/lib/cn";

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  createdAt: string;
}

interface Loyalty {
  points: number;
  balance: number;
  balanceValueShekels: number;
  redemptionEnabled: boolean;
  tier: string;
  tierName: string;
  nextTierName: string | null;
  pointsToNext: number;
  progressPct: number;
}

// Mirrors the merchant dashboard tier palette (LoyaltyView TIER_STYLE).
const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  silver: { bg: "#E8EAED", text: "#5B6470", border: "#C2C8D0" },
  gold: { bg: "#FBE7A1", text: "#7A5B00", border: "#E6B800" },
  platinum: { bg: "#EAD7BE", text: "#6B4A23", border: "#C79256" },
};

interface Order {
  id: string;
  number: string;
  status: string;
  total: number;
  createdAt: string;
}

interface FavoriteItem {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  images: string[];
  artType: string | null;
  available: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "ממתינה",
  confirmed: "אושרה",
  preparing: "בהכנה",
  in_oven: "בתנור",
  ready: "מוכנה",
  out_for_delivery: "בדרך",
  delivered: "נמסרה",
  cancelled: "בוטלה",
  refunded: "הוחזרה",
};

export function ProfileLoggedIn({
  tenantSlug,
  customer,
  orders,
  loyalty,
  favorites = [],
  businessType = "general",
}: {
  tenantSlug: string;
  customer: Customer;
  orders: Order[];
  loyalty?: Loyalty | null;
  favorites?: FavoriteItem[];
  businessType?: BusinessType;
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(customer.firstName || "");
  const [lastName, setLastName] = useState(customer.lastName || "");
  const [savingName, setSavingName] = useState(false);

  const display = fullName(customer.firstName, customer.lastName);
  const dirty = firstName !== customer.firstName || lastName !== customer.lastName;

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.refresh();
  }

  async function saveName() {
    if (!firstName || !dirty) return;
    setSavingName(true);
    try {
      await fetch("/api/v1/customer/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ first_name: firstName, last_name: lastName }),
      });
      router.refresh();
    } finally {
      setSavingName(false);
    }
  }

  const tc = loyalty ? TIER_COLORS[loyalty.tier] ?? TIER_COLORS.silver : null;

  return (
    <div className="lg:max-w-2xl lg:mx-auto lg:pt-6 lg:pb-12">
      {loyalty && tc && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white border-b-2 border-black lg:rounded-t-2xl lg:border-2">
          <div className="flex items-center gap-2 min-w-0">
            <Crown size={20} color={tc.text} />
            <span className="text-base font-black truncate">שלום {firstName || "אורח"}</span>
            <span
              className="shrink-0 text-xs font-black px-2.5 py-1 rounded-full border"
              style={{ backgroundColor: tc.bg, color: tc.text, borderColor: tc.border }}
            >
              לקוח {loyalty.tierName}
            </span>
          </div>
          <div className="shrink-0 flex items-center gap-2.5">
            <div className="text-end leading-tight">
              <div className="text-xs text-qf-mute">
                {loyalty.redemptionEnabled ? "יתרת נקודות" : "נקודות שצברת"}
              </div>
              <div className="text-lg font-black tnum">
                {loyalty.redemptionEnabled ? loyalty.balance : loyalty.points}
                {loyalty.redemptionEnabled && loyalty.balanceValueShekels > 0 && (
                  <span className="text-xs font-bold text-qf-mute"> · ₪{loyalty.balanceValueShekels}</span>
                )}
              </div>
            </div>
            <div className="w-20">
              <div className="h-2 rounded-full bg-black/10 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${loyalty.progressPct}%`, backgroundColor: tc.border }}
                />
              </div>
              <div className="text-[11px] text-qf-mute mt-1 text-center whitespace-nowrap">
                {loyalty.nextTierName
                  ? `עוד ${loyalty.pointsToNext} ל${loyalty.nextTierName}`
                  : "הדרגה הגבוהה"}
              </div>
            </div>
          </div>
        </div>
      )}
      <header
        className={cn(
          "bg-linear-to-b from-(--qf-primary) to-(--qf-deep) text-white px-5 pt-5 pb-7 lg:px-8",
          // When the loyalty bar sits above, keep the top square so the blue
          // reads as one continuous card with the white strip. Standalone
          // (no loyalty) it keeps its rounded top on desktop.
          loyalty && tc ? "rounded-b-3xl" : "rounded-b-3xl lg:rounded-3xl",
        )}
      >
        <div className="flex items-center gap-3 mb-4">
          <Link
            href={`/s/${tenantSlug}`}
            className="w-9 h-9 rounded-full bg-white/15 grid place-items-center lg:hidden"
            aria-label="חזרה"
          >
            <IcoChev c="#fff" s={18} />
          </Link>
          <h1 className="font-bold text-lg lg:text-2xl">אזור אישי</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-white/15 grid place-items-center text-2xl font-bold">
            {(display || "Q").slice(0, 1)}
          </div>
          <div>
            <div className="text-lg font-semibold">{display || "אורח"}</div>
            <div className="text-xs opacity-85" dir="ltr">
              {formatPhone(customer.phone)}
            </div>
            <div className="text-xs opacity-70">חבר מאז {formatDate(customer.createdAt)}</div>
          </div>
        </div>
      </header>

      <section className="px-5 mt-4 lg:px-0 lg:mt-5">
        <div className="bg-white rounded-2xl border border-qf-line p-4 space-y-3">
          <div className="text-sm font-semibold">פרטים אישיים</div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="שם פרטי"
              autoComplete="given-name"
              className="px-3 py-2 rounded-xl border border-qf-line text-sm outline-none focus:border-(--qf-primary)"
            />
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="שם משפחה"
              autoComplete="family-name"
              className="px-3 py-2 rounded-xl border border-qf-line text-sm outline-none focus:border-(--qf-primary)"
            />
          </div>
          <button
            type="button"
            onClick={saveName}
            disabled={savingName || !dirty || !firstName}
            className="w-full px-3 py-2 rounded-xl bg-(--qf-primary) text-white text-sm font-semibold disabled:opacity-50"
          >
            שמור שינויים
          </button>
        </div>
      </section>

      <section className="px-5 mt-4 lg:px-0 lg:mt-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">ההזמנות שלי</h2>
          <span className="text-xs text-qf-mute tnum">{orders.length}</span>
        </div>
        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-qf-line p-6 text-center text-sm text-qf-mute">
            עדיין לא הזמנת. עיין בתפריט ובחר משהו טעים :)
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((o) => (
              <Link
                key={o.id}
                href={`/s/${tenantSlug}/orders/${o.id}`}
                className="block bg-white rounded-2xl border border-qf-line p-3 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-(--qf-soft) grid place-items-center">
                  <IcoReceipt c="var(--qf-primary)" s={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium font-mono text-sm">#{o.number}</div>
                    <div className="tnum font-semibold text-sm">{formatPrice(o.total)}</div>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <div className="text-xs text-qf-mute">{formatDate(o.createdAt)}</div>
                    <StatusChip status={o.status} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {favorites.length > 0 && (
        <section className="px-5 mt-4 lg:px-0 lg:mt-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold flex items-center gap-1.5">
              <IcoHeart s={16} c="#dc2626" fill="#dc2626" />
              המועדפים שלי
            </h2>
            <span className="text-xs text-qf-mute tnum">{favorites.length}</span>
          </div>
          <div className="space-y-2">
            {favorites.map((f) => (
              <Link
                key={f.id}
                href={`/s/${tenantSlug}?item=${f.id}`}
                className="bg-white rounded-2xl border border-qf-line p-3 flex items-center gap-3"
              >
                <MenuItemImage
                  src={f.images[0]}
                  alt={f.name}
                  businessType={businessType}
                  size={56}
                  rounded="xl"
                  className="w-14 h-14 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{f.name}</div>
                  {f.description && (
                    <div className="text-xs text-qf-mute truncate mt-0.5">{f.description}</div>
                  )}
                </div>
                <div className="shrink-0 text-end">
                  <div className="tnum font-semibold text-sm">{formatPrice(f.basePrice)}</div>
                  {!f.available && (
                    <div className="text-[10px] text-qf-tomato mt-0.5">לא זמין כרגע</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="px-5 mt-4 lg:px-0 lg:mt-5">
        <div className="bg-white rounded-2xl border border-qf-line divide-y divide-qf-line">
          <MenuRow icon={<IcoUser s={18} />} label="כתובות שמורות" hint="בקרוב" />
          <button
            type="button"
            onClick={logout}
            className="w-full px-4 py-3 text-start text-qf-tomato text-sm font-medium hover:bg-qf-tomato-soft"
          >
            התנתקות
          </button>
        </div>
      </section>
    </div>
  );
}

function MenuRow({
  icon,
  label,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 text-sm">
      {icon}
      <div className="flex-1">{label}</div>
      {hint && <div className="text-xs text-qf-mute">{hint}</div>}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const label = STATUS_LABEL[status] ?? status;
  const color =
    status === "delivered"
      ? "bg-qf-green-soft text-qf-green-deep"
      : status === "cancelled" || status === "refunded"
        ? "bg-qf-tomato-soft text-qf-tomato"
        : "bg-qf-yolk-soft text-qf-ink2";
  return (
    <span className={cn("text-[10px] px-2 py-0.5 rounded-md", color)}>{label}</span>
  );
}
