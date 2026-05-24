"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IcoBell, IcoEye, IcoLogout, IcoChevDown } from "@/components/shared/Icons";
import { cn } from "@/lib/cn";

interface Props {
  user: { name: string; email: string; role: string };
  branch: { id: string; status: "open" | "busy" | "closed" } | null;
  tenantSlug: string;
}

type Status = "open" | "busy" | "closed";

const STATUS_LABELS: Record<Status, string> = {
  open: "פתוח",
  busy: "עומס",
  closed: "סגור",
};

// Semantic status colors — green=open (ready), yellow=busy (slower
// but still accepting), black=closed (not accepting). Matches the
// universal POS convention so a glance at the chip = current state.
const STATUS_STYLES: Record<Status, string> = {
  open: "bg-[#16A34A] text-white",
  busy: "bg-[#F8CB1E] text-black",
  closed: "bg-black text-white",
};

const STATUS_DOT: Record<Status, string> = {
  open: "bg-white",
  busy: "bg-black",
  closed: "bg-[#F8CB1E]",
};

// Row-level swatch shown next to each label inside the dropdown so the
// merchant can pick by color at a glance.
const STATUS_SWATCH: Record<Status, string> = {
  open: "bg-[#16A34A]",
  busy: "bg-[#F8CB1E]",
  closed: "bg-black",
};

/**
 * V2 topbar — leaner than the live one (no full search palette, no
 * notifications dropdown — bell links straight to /dashboard/orders).
 * Reuses the same /api/v1/merchant/branches PATCH so status toggles
 * are real, not mocked. Wear the same bold black borders + hard
 * shadow as the rest of the v2 surface.
 */
export function TopbarV2({ user, branch, tenantSlug }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(branch?.status ?? "open");
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    function load() {
      fetch("/api/v1/merchant/notifications")
        .then((r) => r.json())
        .then((d) => {
          if (alive) setUnread(d.unread_count ?? 0);
        })
        .catch(() => {});
    }
    load();
    const id = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  async function changeStatus(next: Status) {
    if (!branch || next === status) {
      setStatusOpen(false);
      return;
    }
    const prev = status;
    setStatus(next);
    setStatusOpen(false);
    setStatusBusy(true);
    try {
      const res = await fetch(`/api/v1/merchant/branches/${branch.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) setStatus(prev);
      else router.refresh();
    } catch {
      setStatus(prev);
    } finally {
      setStatusBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/dashboard/login");
    router.refresh();
  }

  return (
    <header
      className="sticky top-0 z-30 border-b-2 border-black"
      style={{ backgroundColor: "#FFF2C9" }}
    >
      <div className="h-16 px-3 lg:px-5 flex items-center gap-2 lg:gap-3">
        {/* Brand chip — mirrors the welcome-overlay treatment */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 lg:hidden"
        >
          <span className="bg-black text-[#F8CB1E] px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide">
            QuickFood
          </span>
        </Link>

        <div className="ms-auto" />

        {/* Status pill */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setStatusOpen((v) => !v)}
            disabled={!branch || statusBusy}
            className={cn(
              "inline-flex items-center gap-2 px-3 h-10 rounded-xl border-2 border-black text-sm font-bold transition active:scale-[0.98] shadow-[0_2px_0_#000]",
              STATUS_STYLES[status],
              statusBusy && "opacity-60",
            )}
          >
            <span
              className={cn("w-2.5 h-2.5 rounded-full", STATUS_DOT[status])}
            />
            <span className="hidden sm:inline">{STATUS_LABELS[status]}</span>
            <IcoChevDown c="currentColor" s={14} />
          </button>
          {statusOpen && (
            <div className="absolute inset-e-0 mt-2 w-48 bg-white border-2 border-black rounded-2xl shadow-[0_4px_0_#000] p-1.5 z-50">
              {(["open", "busy", "closed"] as Status[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => changeStatus(s)}
                  className={cn(
                    "w-full text-start px-3 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2.5",
                    s === status
                      ? "bg-black/5 text-black"
                      : "text-black/80 hover:bg-black/5",
                  )}
                >
                  <span
                    className={cn(
                      "w-2.5 h-2.5 rounded-full border border-black/30 shrink-0",
                      STATUS_SWATCH[s],
                    )}
                  />
                  <span>{STATUS_LABELS[s]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bell — single click jumps straight to orders (no dropdown in v2) */}
        <Link
          href="/dashboard/orders"
          aria-label="התראות"
          className="relative w-10 h-10 rounded-xl border border-black/15 bg-white hover:border-black hover:bg-[#F8CB1E] grid place-items-center transition active:scale-95"
        >
          <IcoBell c="#000" s={18} />
          {unread > 0 && (
            <span className="absolute -top-1.5 -inset-e-1.5 min-w-5 h-5 px-1 rounded-full bg-black text-[#F8CB1E] text-[10px] font-black grid place-items-center tnum ring-2 ring-[#FFF2C9] pointer-events-none">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>

        {/* User */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 ps-1 pe-2.5 h-10 rounded-xl border border-black/15 bg-white hover:border-black transition"
          >
            <div className="w-7 h-7 rounded-lg bg-black text-[#F8CB1E] grid place-items-center text-xs font-black">
              {user.name.slice(0, 2)}
            </div>
            <div className="text-xs leading-tight ps-0.5 hidden lg:block">
              <div className="font-bold">{user.name}</div>
              <div className="text-black/60">{roleLabel(user.role)}</div>
            </div>
            <IcoChevDown c="currentColor" s={14} className="hidden lg:inline" />
          </button>
          {menuOpen && (
            <div className="absolute inset-e-0 mt-2 w-56 bg-white border-2 border-black rounded-2xl shadow-[0_4px_0_#000] p-1.5 text-sm z-50">
              <div className="px-3 py-2 text-xs text-black/60" dir="ltr">
                {user.email}
              </div>
              <hr className="border-black/10" />
              <Link
                href={`/${tenantSlug}`}
                target="_blank"
                rel="noopener"
                onClick={() => setMenuOpen(false)}
                className="w-full text-start px-3 py-2 rounded-lg hover:bg-black/5 flex items-center gap-2.5 font-bold"
              >
                <IcoEye c="#000" s={16} />
                <span>צפה בחנות</span>
              </Link>
              <button
                type="button"
                onClick={logout}
                className="w-full text-start px-3 py-2 rounded-lg hover:bg-black text-black hover:text-[#F8CB1E] flex items-center gap-2.5 font-bold transition"
              >
                <IcoLogout c="currentColor" s={16} />
                <span>התנתקות</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function roleLabel(role: string): string {
  return (
    {
      owner: "בעלים",
      manager: "מנהל",
      kitchen: "מטבח",
      courier_dispatch: "שילוח",
      platform_admin: "פלטפורמה",
    } as Record<string, string>
  )[role] ?? role;
}
