"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { usePos } from "@/components/pos/PosContext";
import { usePosCart } from "@/components/pos/PosCartProvider";
import { IcoBag, IcoUser, IcoReceipt, IcoSearch, IcoClose, IcoChev, IcoClock, IcoArrowRight } from "@/components/shared/Icons";
import { PosParkedTicketsModal } from "@/components/pos/PosParkedTicketsModal";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";

const NAV = [
  { href: "/pos", label: "קופה", Icon: IcoBag, exact: true },
  { href: "/pos/queue", label: "תור", Icon: IcoReceipt, exact: false },
  { href: "/pos/lookup", label: "חיפוש", Icon: IcoSearch, exact: false },
];

export function PosTopBar({ onCloseShift }: { onCloseShift: () => void }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { cashier, tenant, branch, shift } = usePos();
  const { parked } = usePosCart();
  const [queueCount, setQueueCount] = useState<number>(0);
  const [parkedOpen, setParkedOpen] = useState(false);

  // Pull initial queue count + poll every 5s as a fallback. The realtime
  // SSE wire-up in PosQueue keeps this in sync more responsively when the
  // cashier is on the queue page.
  useEffect(() => {
    let stopped = false;
    async function tick() {
      try {
        const res = await fetch("/api/v1/merchant/pos/queue?count_only=1", {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!stopped) setQueueCount(typeof data.count === "number" ? data.count : 0);
      } catch {
        // network blips are fine - next tick retries
      }
    }
    tick();
    const t = window.setInterval(tick, 5000);
    return () => {
      stopped = true;
      window.clearInterval(t);
    };
  }, []);

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
    router.push("/dashboard/login");
    router.refresh();
  }

  return (
    <header
      className="border-b-2 border-black bg-[#F8CB1E] px-4 py-3 flex items-center gap-4"
      style={{ minHeight: 64 }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-black grid place-items-center text-[#F8CB1E] text-base font-black border-2 border-black shadow-[0_2px_0_#000]">
          {tenant.logoLetter}
        </div>
        <div className="min-w-0 leading-tight">
          <div className="font-black text-sm truncate">{tenant.name}</div>
          <div className="text-[11px] text-black/60 truncate">{branch.name}</div>
        </div>
      </div>

      <nav className="flex items-center gap-1.5">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const showBadge = item.href === "/pos/queue" && queueCount > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-2 border-black font-bold text-sm transition shadow-[0_2px_0_#000]",
                active
                  ? "bg-black text-[#F8CB1E]"
                  : "bg-white text-black hover:bg-black/5",
              )}
            >
              <item.Icon s={16} c={active ? "#F8CB1E" : "#000"} />
              <span>{item.label}</span>
              {showBadge && (
                <span className="absolute -top-1.5 -end-1.5 min-w-[20px] h-5 px-1 rounded-full bg-qf-tomato text-white text-[11px] font-black grid place-items-center border-2 border-black">
                  {queueCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="ms-auto flex items-center gap-2">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border-2 border-black text-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/5"
          aria-label="חזרה לדשבורד"
          title="חזרה לדשבורד"
        >
          <IcoArrowRight s={14} c="#000" />
          <span className="hidden sm:inline">דשבורד</span>
        </Link>
        {parked.length > 0 && (
          <button
            type="button"
            onClick={() => setParkedOpen(true)}
            className="relative inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border-2 border-black text-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/5"
            aria-label="כרטיסיות מוחזקות"
            title="כרטיסיות מוחזקות"
          >
            <IcoClock s={14} c="#000" />
            <span className="hidden sm:inline">מוחזקות</span>
            <span className="absolute -top-1.5 -end-1.5 min-w-[20px] h-5 px-1 rounded-full bg-(--qf-primary) text-white text-[11px] font-black grid place-items-center border-2 border-black">
              {parked.length}
            </span>
          </button>
        )}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border-2 border-black text-sm">
          <IcoUser s={14} c="#000" />
          <span className="font-bold">{cashier.name}</span>
          {shift && (
            <span className="text-black/60 text-xs">
              · משמרת מ-{formatTime(shift.openedAt)}
            </span>
          )}
        </div>
        {shift && (
          <button
            type="button"
            onClick={onCloseShift}
            className="px-3 py-2 rounded-xl bg-white border-2 border-black text-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/5"
            title="סגירת משמרת"
          >
            <IcoChev s={14} />
          </button>
        )}
        <button
          type="button"
          onClick={logout}
          className="px-3 py-2 rounded-xl bg-white border-2 border-black text-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/5"
          aria-label="התנתק"
          title="התנתקות"
        >
          <IcoClose s={14} />
        </button>
      </div>

      {parkedOpen && <PosParkedTicketsModal onClose={() => setParkedOpen(false)} />}
    </header>
  );
}
