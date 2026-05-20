"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IcoChev, IcoReceipt, IcoUser } from "@/components/shared/Icons";
import { formatPrice, formatDate, formatPhone } from "@/lib/format";
import { cn } from "@/lib/cn";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  createdAt: string;
}

interface Order {
  id: string;
  number: string;
  status: string;
  total: number;
  createdAt: string;
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
}: {
  tenantSlug: string;
  customer: Customer;
  orders: Order[];
}) {
  const router = useRouter();
  const [name, setName] = useState(customer.name || "");
  const [savingName, setSavingName] = useState(false);

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.refresh();
  }

  async function saveName() {
    if (!name || name === customer.name) return;
    setSavingName(true);
    try {
      await fetch("/api/v1/customer/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      router.refresh();
    } finally {
      setSavingName(false);
    }
  }

  return (
    <>
      <header className="bg-gradient-to-b from-(--qf-primary) to-(--qf-deep) text-white px-5 pt-5 pb-7 rounded-b-3xl">
        <div className="flex items-center gap-3 mb-4">
          <Link
            href={`/${tenantSlug}`}
            className="w-9 h-9 rounded-full bg-white/15 grid place-items-center"
            aria-label="חזרה"
          >
            <IcoChev c="#fff" s={18} />
          </Link>
          <h1 className="font-bold text-lg">אזור אישי</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-white/15 grid place-items-center text-2xl font-bold">
            {(customer.name || "Q").slice(0, 1)}
          </div>
          <div>
            <div className="text-lg font-semibold">{customer.name || "אורח"}</div>
            <div className="text-xs opacity-85" dir="ltr">
              {formatPhone(customer.phone)}
            </div>
            <div className="text-xs opacity-70">חבר מאז {formatDate(customer.createdAt)}</div>
          </div>
        </div>
      </header>

      <section className="px-5 mt-4">
        <div className="bg-white rounded-2xl border border-qf-line p-4 space-y-3">
          <div className="text-sm font-semibold">פרטים אישיים</div>
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="שם מלא"
              className="flex-1 px-3 py-2 rounded-xl border border-qf-line text-sm outline-none focus:border-(--qf-primary)"
            />
            <button
              type="button"
              onClick={saveName}
              disabled={savingName || name === customer.name || !name}
              className="px-3 py-2 rounded-xl bg-(--qf-primary) text-white text-sm disabled:opacity-50"
            >
              שמור
            </button>
          </div>
        </div>
      </section>

      <section className="px-5 mt-4">
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
                href={`/${tenantSlug}/orders/${o.id}`}
                className="block bg-white rounded-2xl border border-qf-line p-3 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-qf-green-soft grid place-items-center">
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

      <section className="px-5 mt-4">
        <div className="bg-white rounded-2xl border border-qf-line divide-y divide-qf-line">
          <MenuRow icon={<IcoUser s={18} />} label="כתובות שמורות" hint="בקרוב" />
          <MenuRow icon={<IcoReceipt s={18} />} label="אמצעי תשלום" hint="בקרוב" />
          <button
            type="button"
            onClick={logout}
            className="w-full px-4 py-3 text-start text-qf-tomato text-sm font-medium hover:bg-qf-tomato-soft"
          >
            התנתקות
          </button>
        </div>
      </section>
    </>
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
